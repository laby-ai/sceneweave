import { NextRequest, NextResponse } from 'next/server';
import { createTask, startTask, updateTaskProgress, completeTask, failTask } from '@/lib/task-manager';
import { aiService } from '@/lib/ai-service-adapter';

/**
 * POST /api/film/bridge-generate
 * 三宫格桥接图异步生成
 *
 * 相邻两个镜头之间生成 3 张过渡图：
 *   图1：前镜头画面参考图（基于前镜头视频/图片+描述）
 *   图2：衔接帧（前镜头尾帧 → 当前镜头首帧的过渡画面）
 *   图3：当前镜头画面参考图（基于当前镜头视频/图片+描述）
 *
 * 请求体：
 * {
 *   prevShot: { id, name, imageUrl?, videoUrl?, lastFrameUrl?, promptCn?, description? },
 *   currentShot: { id, name, imageUrl?, videoUrl?, lastFrameUrl?, promptCn?, description? },
 *   sceneContext?: string,   // 场景描述，增强一致性
 *   characters?: string,     // 角色外观描述
 * }
 *
 * 返回：{ taskId, message }
 * 任务结果：{ bridgeImages: [url1, url2, url3] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prevShot, currentShot, sceneContext, characters } = body;

    if (!prevShot || !currentShot) {
      return NextResponse.json(
        { error: '请提供 prevShot 和 currentShot 信息' },
        { status: 400 }
      );
    }

    // 创建后台任务
    const taskId = createTask({
      type: 'image',
      params: {
        prompt: `桥接图: ${prevShot.name || '前镜头'} → ${currentShot.name || '后镜头'}`,
        prevShotId: prevShot.id,
        currentShotId: currentShot.id,
      },
    });

    startTask(taskId);
    console.log('[Bridge Generate] 三宫格桥接任务已创建:', taskId);

    // 异步执行
    (async () => {
      try {
        const bridgeImages: string[] = [];
        const characterDesc = characters ? `Characters: ${characters}. ` : '';
        const sceneDesc = sceneContext ? `Scene: ${sceneContext}. ` : '';

        // ====== 图1：前镜头画面参考图 ======
        updateTaskProgress(taskId, 10, '生成前镜头画面参考图...');
        console.log('[Bridge Generate] 生成图1: 前镜头画面');

        const prevPrompt = `${characterDesc}${sceneDesc}Cinematic still frame from a film scene: ${prevShot.promptCn || prevShot.description || prevShot.name || 'previous shot'}. High quality, detailed, film grain.`;
        const prevImageParam = prevShot.lastFrameUrl || prevShot.imageUrl || undefined;

        try {
          const prevResult = await aiService.generateImage({
            prompt: prevPrompt,
            image: prevImageParam,
          });
          if (prevResult.data?.url) {
            bridgeImages.push(prevResult.data.url);
          } else {
            bridgeImages.push('');
          }
        } catch (imgErr) {
          console.warn('[Bridge Generate] 图1生成失败:', imgErr);
          bridgeImages.push('');
        }

        // ====== 图2：衔接帧（前镜头尾帧=当前镜头首帧）======
        updateTaskProgress(taskId, 40, '生成衔接过渡帧...');
        console.log('[Bridge Generate] 生成图2: 衔接帧');

        // 衔接帧：用前镜头尾帧作为参考图，加入当前镜头的描述元素
        // 描述从前一场景向下一场景过渡的画面
        const bridgePrompt = `${characterDesc}${sceneDesc}Smooth cinematic transition frame between two shots. Starting from: ${prevShot.promptCn || prevShot.description || 'previous'}. Transitioning to: ${currentShot.promptCn || currentShot.description || 'next'}. The image should blend visual elements from both shots, maintaining continuity in style, lighting, and character appearance. High quality, detailed.`;

        // 优先使用前镜头尾帧作为参考（这是最关键的衔接参考）
        const bridgeImageParam = prevShot.lastFrameUrl || prevShot.imageUrl || currentShot.imageUrl || undefined;

        try {
          const bridgeResult = await aiService.generateImage({
            prompt: bridgePrompt,
            image: bridgeImageParam,
          });
          if (bridgeResult.data?.url) {
            bridgeImages.push(bridgeResult.data.url);
          } else {
            bridgeImages.push('');
          }
        } catch (imgErr) {
          console.warn('[Bridge Generate] 图2生成失败:', imgErr);
          bridgeImages.push('');
        }

        // ====== 图3：当前镜头画面参考图 ======
        updateTaskProgress(taskId, 70, '生成当前镜头画面参考图...');
        console.log('[Bridge Generate] 生成图3: 当前镜头画面');

        const currPrompt = `${characterDesc}${sceneDesc}Cinematic still frame from a film scene: ${currentShot.promptCn || currentShot.description || currentShot.name || 'current shot'}. High quality, detailed, film grain.`;
        const currImageParam = currentShot.imageUrl || currentShot.lastFrameUrl || undefined;

        try {
          const currResult = await aiService.generateImage({
            prompt: currPrompt,
            image: currImageParam,
          });
          if (currResult.data?.url) {
            bridgeImages.push(currResult.data.url);
          } else {
            bridgeImages.push('');
          }
        } catch (imgErr) {
          console.warn('[Bridge Generate] 图3生成失败:', imgErr);
          bridgeImages.push('');
        }

        // 统计成功数量
        const successCount = bridgeImages.filter(Boolean).length;
        if (successCount === 0) {
          throw new Error('所有桥接图生成失败');
        }

        updateTaskProgress(taskId, 95, '桥接图生成完成...');

        // 完成任务
        completeTask(taskId, {
          bridgeImages,
          prevShotId: prevShot.id,
          currentShotId: currentShot.id,
          successCount,
          totalCount: 3,
        });

        console.log(`[Bridge Generate] 三宫格桥接完成: ${successCount}/3 张成功`);
      } catch (error) {
        console.error('[Bridge Generate] 桥接图生成失败:', error);
        const msg = error instanceof Error ? error.message : '生成失败';
        failTask(taskId, msg);
      }
    })();

    return NextResponse.json({
      taskId,
      message: '三宫格桥接图生成任务已创建',
    });

  } catch (error) {
    console.error('[Bridge Generate] 请求处理失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
