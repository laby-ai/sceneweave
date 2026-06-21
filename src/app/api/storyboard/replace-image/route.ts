import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { updateTask, getTask } from '@/lib/task-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      taskId, 
      shotId, 
      imageIndex, 
      newPrompt,
      referenceImage 
    } = body;

    if (!taskId || !shotId || imageIndex === undefined) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    console.log(`[Storyboard Replace Image] 替换图片: 任务${taskId}, 分镜头${shotId}, 图片索引${imageIndex}`);

    // 获取任务
    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 生成新图片（自动降级: Minimax → Coze）
    const prompt = newPrompt || '保持原有内容，重新生成';
    let newImageUrl: string;

    try {
      const result = await aiService.generateImage({
        prompt,
        model: 'image-01',
        width: 16,
        height: 9,
        n: 1,
        style: 'default',
      });
      
      if (!result.data.url) {
        return NextResponse.json(
          { error: '图片生成失败' },
          { status: 500 }
        );
      }
      
      newImageUrl = result.data.url;
      console.log(`[Storyboard Replace Image] 图片生成成功 (${result.provider}${result.degraded ? ', 降级' : ''})`);
    } catch (err) {
      console.error('[Storyboard Replace Image] 图片生成失败:', err);
      return NextResponse.json(
        { error: `图片生成失败: ${err instanceof Error ? err.message : '未知错误'}` },
        { status: 500 }
      );
    }

    // 更新任务中的分镜头数据
    if (task.result && task.result.shots) {
      const updatedShots = [...task.result.shots];
      const shotIndex = updatedShots.findIndex((s: any) => s.id === shotId);
      
      if (shotIndex !== -1 && updatedShots[shotIndex].nineGridImages) {
        const updatedImages = [...updatedShots[shotIndex].nineGridImages];
        updatedImages[imageIndex] = newImageUrl;
        
        updatedShots[shotIndex] = {
          ...updatedShots[shotIndex],
          nineGridImages: updatedImages
        };
        
        // 更新任务
        updateTask(taskId, {
          result: {
            ...task.result,
            shots: updatedShots
          }
        });
      }
    }

    console.log(`[Storyboard Replace Image] 图片替换成功`);

    return NextResponse.json({
      success: true,
      imageUrl: newImageUrl,
      message: '图片替换成功'
    });

  } catch (error) {
    console.error('[Storyboard Replace Image] 替换图片失败:', error);
    return NextResponse.json(
      { error: `替换图片失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
