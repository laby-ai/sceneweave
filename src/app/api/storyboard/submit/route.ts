import { NextRequest, NextResponse } from 'next/server';
import { createTask, startTask, getTask } from '@/lib/task-manager';
import { executeStoryboardTask } from '@/lib/storyboard-submit-executor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 解构参数，包括音频和字幕的启用状态
    const { 
      storyboard, 
      async: runAsync = true, 
      audioEnabled = false,
      audioPrompt,
      subtitleEnabled = false,
      subtitlePrompt,
      backgroundBgm = 'none',
      customAudio,
      libraryTrack,
      globalNineGridImages,
      qualityMode = 'balanced',  // ★ 优化模式: 'fast'(2张) | 'balanced'(4张) | 'quality'(9张)
      sfxConfig  // ★ 特效音配置: { enabled, mode, bindings, globalVolume }
    } = body;
    
    console.log('[Storyboard] POST请求参数:', {
      runAsync,
      audioEnabled,
      audioPrompt: audioPrompt?.substring(0, 50) + '...',
      subtitleEnabled,
      subtitlePrompt: subtitlePrompt?.substring(0, 50) + '...',
      backgroundBgm,
      globalNineGridImagesCount: globalNineGridImages?.length || 0
    });

    if (!storyboard) {
      return NextResponse.json(
        { error: '分镜头数据不能为空' },
        { status: 400 }
      );
    }

    // 验证分镜头数据
    if (!storyboard.shots || storyboard.shots.length === 0) {
      return NextResponse.json(
        { error: '至少需要1个分镜头' },
        { status: 400 }
      );
    }

    const totalDuration = storyboard.shots.reduce((sum: number, shot: any) => sum + shot.duration, 0);
    if (totalDuration <= 10) {
      return NextResponse.json(
        { error: '总时长必须超过10秒' },
        { status: 400 }
      );
    }

    for (const shot of storyboard.shots) {
      if (shot.duration > 10) {
        return NextResponse.json(
          { error: '每段分镜头时长不能超过10秒' },
          { status: 400 }
        );
      }
    }

    // 创建任务
    const taskId = createTask({
      type: 'storyboard',
      params: {
        prompt: storyboard.title || '分镜头视频',
        storyboardId: storyboard.id,
        totalShots: storyboard.shots.length,
        totalDuration: totalDuration,
        // 音频和字幕参数
        audioPrompt,
        subtitlePrompt,
        backgroundBgm,
        customAudio,
        // 全局九宫格参数
        globalNineGridImages,
      }
    });

    // 标记任务开始
    startTask(taskId);

    if (runAsync) {
      // 在后台执行任务（传递全局九宫格图片 + 优化模式）
      executeStoryboardTask(
        taskId,
        storyboard,
        audioEnabled,
        audioPrompt,
        subtitleEnabled,
        subtitlePrompt,
        backgroundBgm,
        customAudio,
        libraryTrack,  // ★ 音乐库曲目
        globalNineGridImages,  // 新增：全局九宫格图片
        qualityMode,  // ★ 新增：优化模式
        sfxConfig  // ★ 新增：特效音配置
      );
      return NextResponse.json({ taskId });
    } else {
      // 同步执行（不推荐，仅用于开发调试）
      await executeStoryboardTask(
        taskId,
        storyboard,
        audioEnabled,
        audioPrompt,
        subtitleEnabled,
        subtitlePrompt,
        backgroundBgm,
        customAudio,
        libraryTrack,  // ★ 音乐库曲目
        globalNineGridImages,  // 新增：全局九宫格图片
        qualityMode,  // ★ 新增：优化模式
        sfxConfig  // ★ 新增：特效音配置
      );
      const task = getTask(taskId);
      return NextResponse.json({ taskId, task });
    }
    
  } catch (error) {
    console.error('[Storyboard API] 分镜头生成请求失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
