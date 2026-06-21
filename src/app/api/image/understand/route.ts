import { NextRequest, NextResponse } from 'next/server';
import { CozeAPI } from '@/lib/coze-api';

// 简化消息类型，避免复杂泛型导致 TS 语法错误
type MessageContent = string | Array<Record<string, unknown>>;
interface ChatMessage {
  role: string;
  content: MessageContent;
}

/**
 * 调用多模态视觉模型生成理解结果
 */
async function generateUnderstanding(messages: ChatMessage[]): Promise<NextResponse> {
  let fullContent = '';
  let provider = 'coze-vision';

  try {
    // 使用LLM模型（支持多模态image_url），模型由 visionChat 内部管理降级链
    const visionResult = await CozeAPI.visionChat(
      messages as any,
      { temperature: 0.7 }
    );
    fullContent = typeof visionResult === 'string' ? visionResult : (visionResult as { content: string }).content || String(visionResult);

    if (!fullContent || fullContent.trim().length === 0) {
      throw new Error('视觉模型返回空结果');
    }
  } catch (visionError) {
    // 视觉模型失败时，降级到文本描述
    console.error('视觉模型调用失败，降级到文本模式:', visionError);
    try {
      const questionText = typeof messages[0]?.content === 'string'
        ? messages[0].content
        : Array.isArray(messages[0]?.content)
          ? ((messages[0].content as Array<Record<string, unknown>>).find(c => c.type === 'text') as Record<string, string> | undefined)?.text || ''
          : '';
      const textMessages = [
        {
          role: 'user' as const,
          content: `用户上传了一张图片，但视觉模型暂时不可用。请根据以下问题给出通用回答：${questionText}`,
        },
      ];
      const textStream = CozeAPI.chatStream(textMessages);
      const reader = textStream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
      provider = 'coze-text-fallback';
    } catch {
      throw new Error('图片理解服务暂时不可用');
    }
  }

  return NextResponse.json({
    success: true,
    description: fullContent,
    provider,
  });
}

export async function POST(request: NextRequest) {
  try {
    let imageUrl: string;
    let question = '请详细描述这张图片的内容，包括：\n1. 图片中的主要物体和场景\n2. 图片的整体风格和氛围\n3. 图片中可能包含的文字信息\n4. 任何值得注意的细节特征\n请用简洁清晰的语言描述。';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // FormData 格式：支持文件上传
      const formData = await request.formData();
      const imageFile = formData.get('image');
      const questionField = formData.get('question') as string | null;
      if (questionField) question = questionField;

      if (!imageFile || typeof imageFile === 'string') {
        return NextResponse.json(
          { error: '请提供图片文件' },
          { status: 400 }
        );
      }

      if (imageFile instanceof File) {
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = imageFile.type || 'image/jpeg';
        imageUrl = `data:${mimeType};base64,${base64}`;
      } else {
        return NextResponse.json(
          { error: '无效的图片格式' },
          { status: 400 }
        );
      }
    } else if (contentType.includes('application/json')) {
      // JSON 格式：支持URL方式
      const body = await request.json();
      const url = body.imageUrl || body.url || body.image;
      if (!url) {
        return NextResponse.json(
          { error: '请提供图片URL(imageUrl)或上传图片文件' },
          { status: 400 }
        );
      }
      imageUrl = url;
      if (body.question) question = body.question;

      // 支持对比验证模式：同时传入参考图
      const referenceImageUrl = body.referenceImageUrl as string | undefined;
      if (referenceImageUrl) {
        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: question || '请对比这两张图片。' },
              {
                type: 'image_url',
                image_url: { url: referenceImageUrl, detail: 'high' },
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
            ],
          },
        ];
        return await generateUnderstanding(messages);
      }
    } else {
      return NextResponse.json(
        { error: '请使用 multipart/form-data 或 application/json 格式' },
        { status: 400 }
      );
    }

    // 标准单图理解模式
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: question },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
        ],
      },
    ];

    return await generateUnderstanding(messages);
  } catch (error) {
    console.error('图片理解错误:', error);

    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      { error: `图片理解失败: ${errorMessage}` },
      { status: 500 }
    );
  }
}
