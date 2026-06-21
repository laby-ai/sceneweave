import { NextRequest, NextResponse } from 'next/server';
import { aiService, type ImageGenResult } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import { createTask, startTask, updateTaskProgress, completeTask, failTask } from '@/lib/task-manager';
import { extractBYOKConnection, type BYOKConnection } from '@/lib/byok-provider';
import { BYOKApiBaseError } from '@/lib/byok-url';

interface ImageGenerateBody {
  prompt?: string;
  model?: string;
  size?: string;
  watermark?: boolean;
  materials?: string[];
  n?: number;
  image?: string | string[];
  negative_prompt?: string;
  async?: boolean;
}

// 同步模式的图像生成（用于向后兼容）
async function generateImageSync(body: ImageGenerateBody, byokConnection?: BYOKConnection) {
  const {
    prompt,
    model,
    size = '1024x1024',
    watermark = true,
    materials = [],
    n = 1,
    image,  // 角色参考图，确保人物视觉一致性
    negative_prompt,  // 负面提示词
  } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
    return NextResponse.json(
      { error: '请提供至少2个字符的描述' },
      { status: 400 }
    );
  }

  console.log('[Image Generate] 开始生成图像（自动降级模式）, image:', image ? 'provided' : 'none', 'materials:', materials.length);

  try {
    const result = await aiService.generateImage({
      prompt: prompt.trim(),
      model,
      size,
      n: Math.min(n, 9),
      image: image || (materials.length > 0 ? materials[0] : undefined),  // 传递角色参考图
      negative_prompt: negative_prompt || undefined,  // 传递负面提示词
      byokConnection,
    });

    const imageResult: ImageGenResult = result.data;
    const imageUrl = imageResult.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: '图像生成失败，未返回图像' },
        { status: 500 }
      );
    }

    const imageUrls = [imageUrl];

    const degradedInfo = result.degraded
      ? ` (已降级到${result.provider}，原始服务暂时不可用)`
      : '';

    console.log(`[Image Generate] 图像生成成功，provider: ${result.provider}${degradedInfo}`);

    return NextResponse.json({
      success: true,
      imageUrls,
      prompt: prompt.trim(),
      size: size,
      materials: materials,
      provider: result.provider,
      degraded: result.degraded,
    });
  } catch (error) {
    if (error instanceof BYOKApiBaseError) {
      return NextResponse.json(
        { error: `用户供应商配置失败：${error.message}`, provider: 'byok' },
        { status: 400 }
      );
    }

    if (byokConnection && error instanceof Error && error.message.startsWith('BYOK 图片调用失败')) {
      return NextResponse.json(
        { error: error.message, provider: 'byok' },
        { status: 502 }
      );
    }

    if (error instanceof DegradeError) {
      return NextResponse.json(
        { error: error.toUserMessage() },
        { status: 503 }
      );
    }
    throw error;
  }
}

/**
 * POST /api/image/generate
 * 提交图像生成任务
 * 
 * 请求体：
 * {
 *   prompt: string,
 *   size: string,
 *   materials: string[],
 *   n: number,
 *   async?: boolean // 是否使用后台生成，默认false（向后兼容）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImageGenerateBody;
    const byokConnection = extractBYOKConnection(request.headers);
    console.log(
      '[Image Generate] BYOK connection:',
      byokConnection ? `${byokConnection.provider}/${byokConnection.model || 'default-model'}` : 'none'
    );
    const useBackground = body.async === true;

    if (!useBackground) {
      // 向后兼容：同步模式
      return await generateImageSync(body, byokConnection);
    }

    // 后台生成模式
    const {
      prompt,
      model,
      size = '1024x1024',
      watermark = true,
      materials = [],
      n = 1,
      image,  // 角色参考图
      negative_prompt,
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
      return NextResponse.json(
        { error: '请提供至少2个字符的描述' },
        { status: 400 }
      );
    }

    // 创建后台任务
    const taskId = createTask({
      type: 'image',
      params: { prompt, size, materials, n, image },
    });

    // 启动后台任务
    startTask(taskId);

    // 异步执行图像生成（带自动降级）
    (async () => {
      try {
        updateTaskProgress(taskId, 10, '正在调用图像生成API（自动降级模式）...');

        console.log(`[Image Background] 开始后台生成图像, image:`, image ? 'provided' : 'none');

        const result = await aiService.generateImage({
          prompt: prompt.trim(),
          model,
          size,
          n: Math.min(n, 9),
          image: image || (materials.length > 0 ? materials[0] : undefined),  // 传递角色参考图
          negative_prompt: negative_prompt || undefined,
          byokConnection,
        });

        updateTaskProgress(taskId, 80, '图像生成完成，处理中...');

        const imageResult: ImageGenResult = result.data;
        const imageUrl = imageResult.url;

        if (!imageUrl) {
          throw new Error('图像生成失败，未返回图像');
        }

        // 完成任务
        completeTask(taskId, {
          imageUrls: [imageUrl],
          provider: result.provider,
          degraded: result.degraded,
        });

        console.log(`[Image Background] 后台图像生成完成，provider: ${result.provider}`);
      } catch (error) {
        console.error('[Image Background] 后台图像生成失败:', error);
        const msg = error instanceof DegradeError
          ? error.toUserMessage()
          : (error instanceof Error ? error.message : '未知错误');
        failTask(taskId, msg);
      }
    })();

    return NextResponse.json({
      success: true,
      taskId,
      message: '图像生成任务已提交，请使用任务ID查询进度',
    });

  } catch (error) {
    console.error('[Image Generate] 图像生成错误:', error);

    if (error instanceof BYOKApiBaseError) {
      return NextResponse.json(
        { error: `用户供应商配置失败：${error.message}`, provider: 'byok' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `图像生成失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
