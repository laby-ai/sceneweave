/**
 * 媒体理解 API — 图片/视频内容分析
 * POST /api/analyze/media
 * 支持图片URL和视频URL，返回SSE流式分析结果
 */

import { NextRequest } from 'next/server';
import { cozeChatStream, type MultimodalMessage } from '@/lib/coze-api';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 分析类型对应的系统提示词
const ANALYSIS_PROMPTS: Record<string, string> = {
  // 图片分析
  describe: `你是一个专业的视觉内容分析师。请详细描述这张图片的内容，包括：
1. 主体内容：场景、人物、物体
2. 视觉风格：色彩、构图、光影
3. 情感氛围：整体传达的感觉
4. 创作要素：如果用于AI创作，可提取的提示词要素
请用中文回答，内容详尽专业。`,

  prompt: `你是一个AI创作提示词专家。请根据这张图片，生成可用于AI图像生成的详细提示词。
要求：
1. 提取图片中的核心视觉要素（主体、风格、色彩、构图、光影、材质等）
2. 用英文生成一段完整的AI绘图提示词（prompt）
3. 同时提供中文描述版本
4. 标注建议的负面提示词（negative prompt）
格式：
【英文提示词】...
【中文描述】...
【负面提示词】...`,

  tag: `你是一个内容标签专家。请为这张图片提取标签，包括：
1. 内容标签：场景、物体、人物特征等
2. 风格标签：艺术风格、视觉风格等  
3. 情感标签：氛围、情绪等
4. 创作标签：可用于AI创作的关键要素
请用逗号分隔，每类最多10个标签。`,

  video_describe: `你是一个专业的视频内容分析师。请详细分析这个视频的内容，包括：
1. 视频主题与场景描述
2. 画面风格与视觉要素
3. 运镜方式与节奏感
4. 如果用于AI视频创作，可提取的关键提示词要素
请用中文回答，内容详尽专业。`,

  video_prompt: `你是一个AI视频创作提示词专家。请根据这个视频，生成可用于AI视频生成的详细提示词。
要求：
1. 提取视频中的核心视觉和动态要素
2. 用英文生成一段完整的AI视频生成提示词
3. 同时提供中文描述版本
4. 建议运镜方式和时长
格式：
【英文提示词】...
【中文描述】...
【运镜建议】...
【建议时长】...`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mediaUrl, mediaType, analysisType, customPrompt } = body as {
      mediaUrl: string;
      mediaType: 'image' | 'video';
      analysisType: 'describe' | 'prompt' | 'tag';
      customPrompt?: string;
    };

    if (!mediaUrl) {
      return Response.json({ error: '请提供媒体URL (mediaUrl)' }, { status: 400 });
    }

    // 确定系统提示词
    const promptKey = mediaType === 'video' ? `video_${analysisType}` : analysisType;
    const systemPrompt = customPrompt || ANALYSIS_PROMPTS[promptKey] || ANALYSIS_PROMPTS.describe;

    // 构建多模态消息
    const messages: MultimodalMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: mediaType === 'video'
              ? '请分析以下视频内容：'
              : '请分析以下图片内容：',
          },
          ...(mediaType === 'image'
            ? [{
                type: 'image_url' as const,
                image_url: {
                  url: mediaUrl,
                  detail: 'high' as const,
                },
              }]
            : [{
                type: 'video_url' as const,
                video_url: {
                  url: mediaUrl,
                },
              }]
          ),
        ],
      },
    ];

    // 使用流式LLM对话（带降级：优先doubao-seed-2.0-pro → doubao-1.5-pro → 豆包lite）
    const llmModels = ['doubao-seed-2-0-pro-260215', 'doubao-1.5-pro-256k', 'doubao-lite-32k'];
    let stream: ReadableStream<Uint8Array> | null = null;
    let lastError: Error | null = null;

    for (const model of llmModels) {
      try {
        stream = cozeChatStream(messages, {
          model,
          temperature: 0.7,
        });
        console.log(`[analyze/media] 使用模型: ${model}`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[analyze/media] 模型 ${model} 不可用:`, lastError.message);
        continue;
      }
    }

    if (!stream) {
      throw lastError || new Error('所有LLM模型不可用');
    }

    // 返回SSE流
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '媒体分析失败';
    console.error('[analyze/media] Error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
