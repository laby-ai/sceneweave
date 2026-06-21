import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { updateTask, getTask, updateTaskProgress } from '@/lib/task-manager';
import { throwStoryboardVideoPathDisabled } from '@/lib/video-generation-path-guidance';

// 生成九宫格图片（自动降级: Minimax → Coze）
async function generateNineGridImages(
  prompt: string,
  referenceImage?: string,
  previousLastFrame?: string
): Promise<string[]> {
  const images: string[] = [];
  
  // 确定基础参考图片：优先使用用户上传的referenceImage，否则使用前一段的lastFrame
  const baseReferenceImage = referenceImage || previousLastFrame;
  
  for (let i = 0; i < 9; i++) {
    let enhancedPrompt = prompt;
    
    const timingDescriptions = [
      '，初始状态，画面开始',
      '，动作开始展开',
      '，动作进行中',
      '，动作接近高潮',
      '，动作高潮时刻',
      '，动作开始回落',
      '，动作接近结束',
      '，动作收尾阶段',
      '，最终状态，画面定格'
    ];
    
    enhancedPrompt += timingDescriptions[i];
    
    if (i === 0 && baseReferenceImage) {
      enhancedPrompt = `${enhancedPrompt}，与参考图风格和内容保持连贯`;
    }
    
    try {
      const result = await aiService.generateImage({
        prompt: enhancedPrompt,
        model: 'image-01',
        width: 16,
        height: 9,
        n: 1,
        style: 'default',
      });
      
      if (result.data.url) {
        images.push(result.data.url);
        console.log(`[Storyboard] 第${i + 1}张图片生成成功 (${result.provider}${result.degraded ? ', 降级' : ''})`);
      } else {
        throw new Error(`第${i + 1}张图片生成失败`);
      }
    } catch (err) {
      console.error(`[Storyboard] 第${i + 1}张图片生成失败:`, err instanceof Error ? err.message : String(err));
      throw new Error(`第${i + 1}张图片生成失败`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return images;
}

// 生成视频：旧入口只给出明确指引，避免绕过 BYOK/assembly 可恢复任务链路。
async function generateVideo(
  prompt: string,
  duration: number,
  firstFrameImage: string
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  void prompt;
  void duration;
  void firstFrameImage;
  throwStoryboardVideoPathDisabled('storyboard regenerate-shot video generation');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      taskId, 
      shotId,
      async: runAsync = true
    } = body;

    if (!taskId || !shotId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    console.log(`[Storyboard Regenerate Shot] 再生成分镜头: 任务${taskId}, 分镜头${shotId}`);

    // 获取任务
    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 找到要再生成的分镜头
    if (!task.result || !task.result.shots) {
      return NextResponse.json(
        { error: '任务数据不完整' },
        { status: 400 }
      );
    }

    const shots = [...task.result.shots];
    const shotIndex = shots.findIndex((s: any) => s.id === shotId);
    
    if (shotIndex === -1) {
      return NextResponse.json(
        { error: '分镜头不存在' },
        { status: 404 }
      );
    }

    const shot = shots[shotIndex];
    const previousShot = shotIndex > 0 ? shots[shotIndex - 1] : null;
    const previousLastFrame = previousShot?.lastFrameUrl;

    if (!runAsync) {
      // 同步模式（不推荐）
      const nineGridImages = await generateNineGridImages(
        shot.prompt, 
        shot.referenceImage, 
        previousLastFrame
      );
      const { videoUrl, lastFrameUrl } = await generateVideo(
        shot.prompt, 
        shot.duration, 
        nineGridImages[0]
      );
      
      shots[shotIndex] = {
        ...shot,
        nineGridImages,
        videoUrl,
        lastFrameUrl,
        status: 'video_generated'
      };
      
      updateTask(taskId, {
        result: {
          ...task.result,
          shots
        }
      });
      
      return NextResponse.json({
        success: true,
        shot: shots[shotIndex],
        message: '分镜头再生成成功'
      });
    }

    // 异步模式
    (async () => {
      try {
        updateTaskProgress(taskId, 0, `正在再生成第${shotIndex + 1}个分镜头...`);
        
        // 生成九宫格图片
        updateTaskProgress(taskId, 20, '正在生成九宫格图片...');
        const nineGridImages = await generateNineGridImages(
          shot.prompt, 
          shot.referenceImage, 
          previousLastFrame
        );
        
        // 更新中间状态
        shots[shotIndex] = {
          ...shot,
          nineGridImages,
          status: 'images_generated'
        };
        
        updateTask(taskId, {
          result: {
            ...task.result,
            shots
          }
        });
        
        updateTaskProgress(taskId, 60, '九宫格图片生成完成，正在生成视频...');
        
        // 生成视频
        const { videoUrl, lastFrameUrl } = await generateVideo(
          shot.prompt, 
          shot.duration, 
          nineGridImages[0]
        );
        
        // 更新最终状态
        shots[shotIndex] = {
          ...shots[shotIndex],
          videoUrl,
          lastFrameUrl,
          status: 'video_generated'
        };
        
        updateTask(taskId, {
          result: {
            ...task.result,
            shots
          }
        });
        
        updateTaskProgress(taskId, 100, '分镜头再生成完成！');
        
        console.log(`[Storyboard Regenerate Shot] 分镜头再生成成功`);
        
      } catch (error) {
        console.error('[Storyboard Regenerate Shot] 再生成失败:', error);
        
        shots[shotIndex] = {
          ...shot,
          status: 'failed',
          error: error instanceof Error ? error.message : '再生成失败'
        };
        
        updateTask(taskId, {
          result: {
            ...task.result,
            shots
          }
        });
      }
    })();

    return NextResponse.json({
      success: true,
      message: '分镜头再生成任务已开始',
      taskId
    });

  } catch (error) {
    console.error('[Storyboard Regenerate Shot] 再生成失败:', error);
    return NextResponse.json(
      { error: `再生成失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
