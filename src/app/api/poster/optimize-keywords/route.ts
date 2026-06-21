import { NextRequest, NextResponse } from 'next/server';
import {
  LLMClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json();

    if (!keywords) {
      return NextResponse.json(
        { error: '请提供关键字' },
        { status: 400 }
      );
    }

    // 提取并转发请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建系统提示词
    const systemPrompt = `你是一位专业的海报文案优化专家，擅长提炼和优化产品或主题的关键信息，使其更适合海报设计和视觉传达。

你的任务是根据用户提供的关键信息，优化并提炼出更加精炼、有力、适合视觉展示的关键字。

优化原则：
1. 突出核心卖点和独特价值
2. 使用简洁有力的词汇
3. 增强表现力和感染力
4. 适合视觉传达和排版设计
5. 保留所有重要信息
6. 使用更具吸引力的表达方式

请直接返回优化后的关键字，不要添加任何解释或说明。`;

    // 调用 LLM
    const response = await client.invoke(
      [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        {
          role: 'user' as const,
          content: `请优化以下关键字，使其更适合海报设计：\n\n${keywords}`,
        },
      ],
      {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7,
      }
    );

    const optimizedKeywords = response.content.trim() || keywords;

    return NextResponse.json({
      optimizedKeywords,
    });

  } catch (error) {
    console.error('Error optimizing keywords:', error);

    let errorMessage = '关键字优化失败';
    if (error instanceof APIError) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
