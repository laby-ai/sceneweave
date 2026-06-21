import { NextRequest, NextResponse } from 'next/server';
import { optimizePrompt, splitComplexPrompt } from '@/lib/prompt-optimizer';
import { 
  createTask, 
  startTask, 
  completeTask, 
  failTask,
  updateTaskProgress 
} from '@/lib/task-manager';

/**
 * 智能视频生成API
 * 自动优化复杂提示词，分段生成长视频
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      prompt, 
      duration = 5, 
      resolution = '720p',
      ratio = '16:9',
      enableSmartOptimize = true,
      watermark,
      language,
      materials,
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供视频描述' },
        { status: 400 }
      );
    }

    // 判断是否为复杂提示词
    const isComplexPrompt = prompt.length > 200 || prompt.includes('秒：') || prompt.includes('分镜');
    
    // 优化提示词
    let optimizedPrompt = prompt;
    let promptSegments: Array<{timeRange: string; scene: string; duration: number}> = [];
    
    if (enableSmartOptimize && isComplexPrompt) {
      // 解析复杂提示词
      promptSegments = splitComplexPrompt(prompt);
      
      if (promptSegments.length > 1) {
        // 有多段描述，使用分段生成
        optimizedPrompt = promptSegments[0].scene; // 第一段作为主提示词
      } else {
        // 单段但复杂的提示词，进行压缩
        optimizedPrompt = optimizePrompt(prompt);
      }
    }

    // 创建主任务
    const taskId = createTask('video', {
      prompt,
      optimizedPrompt,
      duration,
      resolution,
      ratio,
      isComplexPrompt,
      promptSegments: promptSegments.map(s => s.timeRange),
      watermark,
      language,
      materials,
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
    });

    // 在后台执行生成
    executeSmartVideoTask(taskId, optimizedPrompt, duration, {
      resolution,
      ratio,
      promptSegments,
      originalPrompt: prompt,
      watermark,
      language,
      materials,
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: isComplexPrompt 
        ? `复杂视频任务已创建，已优化提示词${promptSegments.length > 1 ? '，将分段生成' : ''}`
        : '视频生成任务已创建',
      isOptimized: isComplexPrompt,
      optimizedPrompt: isComplexPrompt ? optimizedPrompt : undefined,
      segments: promptSegments.length > 1 ? promptSegments : undefined
    });

  } catch (error) {
    console.error('智能视频生成失败:', error);
    return NextResponse.json(
      { error: '创建任务失败，请重试' },
      { status: 500 }
    );
  }
}

/**
 * 执行智能视频生成任务
 */
async function executeSmartVideoTask(
  taskId: string,
  optimizedPrompt: string,
  duration: number,
  params: any
) {
  try {
    startTask(taskId);
    
    const { promptSegments, originalPrompt } = params;
    
    // 如果有多段描述，使用分段生成
    if (promptSegments && promptSegments.length > 1) {
      updateTaskProgress(
        taskId, 
        10, 
        '分析复杂提示词...', 
        `检测到${promptSegments.length}个场景，将分段生成`
      );
      
      // 调用分段生成逻辑
      const { generateSegmentedVideo } = await import('@/lib/generate-segmented-video');
      
      const result = await generateSegmentedVideo(
        optimizedPrompt,
        duration,
        params,
        (progress, stage) => {
          updateTaskProgress(taskId, progress, stage || '处理中...');
        }
      );
      
      if (result.success && result.videoUrl) {
        completeTask(taskId, { videoUrl: result.videoUrl });
      } else {
        failTask(taskId, result.error || '分段生成失败');
      }
    } else {
      // 单段生成
      updateTaskProgress(taskId, 10, '准备生成...', '使用优化后的提示词');
      
      // 调用标准视频生成
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/video/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: optimizedPrompt,
            duration,
            ...params
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('视频生成请求失败');
      }
      
      const data = await response.json();
      
      // 轮询等待子任务完成
      await pollSubTask(taskId, data.taskId);
    }
    
  } catch (error) {
    console.error(`[SmartVideo Task ${taskId}] 执行失败:`, error);
    failTask(
      taskId, 
      error instanceof Error ? error.message : '智能生成失败'
    );
  }
}

/**
 * 轮询子任务状态
 */
async function pollSubTask(parentTaskId: string, subTaskId: string) {
  const maxWaitTime = 20 * 60 * 1000; // 最多等待20分钟
  const pollInterval = 5000; // 每5秒查询一次
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/tasks/${subTaskId}`
      );
      
      if (!response.ok) continue;
      
      const { task } = await response.json();
      
      // 同步进度
      if (task.progress) {
        updateTaskProgress(parentTaskId, task.progress, task.stage || '生成中...');
      }
      
      // 检查完成状态
      if (task.status === 'completed') {
        completeTask(parentTaskId, task.result || {});
        return;
      }
      
      if (task.status === 'failed') {
        failTask(parentTaskId, task.error || '子任务失败');
        return;
      }
      
      if (task.status === 'cancelled') {
        failTask(parentTaskId, '任务已取消');
        return;
      }
      
    } catch (error) {
      console.error('轮询子任务失败:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  failTask(parentTaskId, '等待子任务超时');
}
