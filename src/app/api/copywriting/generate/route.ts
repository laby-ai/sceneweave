import { NextRequest } from 'next/server';
// LLMClient 使用动态导入以避免 RSC 环境下的 React Class Component 兼容性问题

// 平台对应的特性提示
const PLATFORM_PROMPTS: Record<string, string> = {
  general: '',
  xiaohongshu: `\n\n【小红书平台特性】
- 大量使用 emoji 表情，增强亲和力和视觉效果
- 使用"姐妹们"、"集美们"等称呼拉近距离
- 标题要吸睛，可以使用疑问句、感叹句
- 内容要有体验感和分享感
- 使用话题标签格式：#话题
- 语气亲切、热情，像在跟朋友聊天
- 字数控制在1000字以内
- 多用短句，节奏轻快`,

  douyin: `\n\n【抖音平台特性】
- 适合短视频脚本，要有画面感和动作描述
- 开头3秒要抓住注意力
- 节奏紧凑，短句为主
- 使用网络热词和流行梗
- 添加音效、转场等画面提示
- 适合口播和旁白两种形式
- 长度控制在60秒内（约200-300字）
- 要有明确的互动引导`,

  weibo: `\n\n【微博平台特性】
- 话题性强，适合热点传播
- 使用话题标签格式：#话题#
- 可以@相关账号
- 适合配图或短视频
- 文字简洁有力，适合快速阅读
- 可以使用转发、评论等互动引导
- 字数控制在140字以内
- 适合突发事件、热点评论`,

  wechat: `\n\n【微信公众号平台特性】
- 专业、深度、有教育价值
- 结构清晰，逻辑严密
- 可以引用数据、案例
- 适合长篇深度内容（2000-5000字）
- 使用专业术语但不过度
- 图文并茂，排版美观
- 可以添加引导关注、点赞、在看
- 适合知识分享、产品评测、行业分析`,

  kuaishou: `\n\n【快手平台特性】
- 接地气，口语化表达
- 使用"老铁们"、"家人们"等称呼
- 真实、不做作
- 内容贴近生活
- 可以使用方言特色
- 节奏明快，简单直接
- 字数控制在300字以内
- 适合日常分享、技能展示`,

  bilibili: `\n\n【B站平台特性】
- 二次元风格，年轻化
- 使用网络流行语和梗
- 可以使用"UP主"、"UP"等称呼
- 适合ACG内容、知识科普、生活分享
- 可以添加UP主专属标签
- 使用"三连"（点赞、投币、收藏）引导
- 可以添加弹幕提示
- 内容有趣、有梗、有深度`
};

// 风格对应的系统提示词
const STYLE_SYSTEM_PROMPTS: Record<string, string> = {
  marketing: `你是一位专业的营销文案专家，擅长撰写具有说服力和吸引力的营销文案。
你的任务是根据用户提供的产品或主题描述，生成3个不同版本的营销文案。

每个文案版本应该包含：
1. 引人注目的标题
2. 产品/服务亮点
3. 价值主张
4. 行动号召

文案特点：
- 使用emoji增强视觉效果
- 突出产品的独特卖点
- 使用简洁有力的短句
- 创造紧迫感和吸引力
- 适合社交媒体和广告投放

请直接返回3个文案版本，每个版本之间用"=== 版本分隔 ==="分隔。`,

  emotional: `你是一位情感文案专家，擅长触动人心、引发共鸣的情感文案。
你的任务是根据用户提供的产品或主题描述，生成3个不同版本的情感文案。

每个文案版本应该包含：
1. 温馨或感人的开场
2. 产品与情感的连接
3. 情感共鸣点
4. 余韵悠长的结尾

文案特点：
- 语气温暖、真诚
- 关注用户的情感需求
- 用生活场景引发共鸣
- 营造氛围感和代入感
- 简洁而富有诗意

请直接返回3个文案版本，每个版本之间用"=== 版本分隔 ==="分隔。`,

  professional: `你是一位专业的商务文案专家，擅长撰写专业、严谨的商务文案。
你的任务是根据用户提供的产品或主题描述，生成3个不同版本的专业文案。

每个文案版本应该包含：
1. 明确的产品介绍
2. 核心优势和技术特点
3. 应用场景和解决方案
4. 专业的服务承诺

文案特点：
- 语言专业、准确
- 结构清晰、逻辑严密
- 突出技术优势
- 强调专业性和可靠性
- 适合B2B和专业场景

请直接返回3个文案版本，每个版本之间用"=== 版本分隔 ==="分隔。`,

  humorous: `你是一位幽默风趣的文案专家，擅长用轻松幽默的方式传递信息。
你的任务是根据用户提供的产品或主题描述，生成3个不同版本的幽默文案。

每个文案版本应该包含：
1. 幽默的开场或标题
2. 有趣的产品介绍
3. 轻松的表达方式
4. 令人会心一笑的结尾

文案特点：
- 语气轻松、幽默
- 使用网络热梗或俏皮话
- 避免低俗，保持适度
- 让用户在笑声中记住产品
- 适合年轻受众和社交媒体

请直接返回3个文案版本，每个版本之间用"=== 版本分隔 ==="分隔。`,
};

export async function POST(request: NextRequest) {
  // 动态导入 LLMClient（避免 RSC 兼容性问题）— 放在函数作用域使 catch 块可访问 APIError
  const { LLMClient, Config, HeaderUtils, APIError } = await import('coze-coding-dev-sdk');

  try {
    const { prompt, style = 'marketing', platform = 'general' } = await request.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: '请提供产品或主题描述' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取对应风格的系统提示词
    let systemPrompt = STYLE_SYSTEM_PROMPTS[style] || STYLE_SYSTEM_PROMPTS.marketing;

    // 添加平台特性提示
    if (platform !== 'general') {
      systemPrompt += PLATFORM_PROMPTS[platform] || '';
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建消息
    const platformInfo = platform !== 'general' ? `\n\n【目标平台】${platform}` : '';
    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: `请为以下产品或主题生成3个不同风格的文案版本：\n\n${prompt}${platformInfo}`,
      },
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.8,
          });

          let fullContent = '';

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              fullContent += text;

              // 发送内容块
              const data = JSON.stringify({
                type: 'content',
                content: text,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // 解析完整的文案
          const variations = fullContent.split('=== 版本分隔 ===')
            .map(v => v.trim())
            .filter(v => v.length > 0);
          const finalVariations = variations.length > 0 ? variations : [fullContent];

          // 发送完成信号
          const doneData = JSON.stringify({
            type: 'done',
            variations: finalVariations,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));

          controller.close();
        } catch (error) {
          console.error('Error in stream:', error);

          let errorMessage = '文案生成失败';
          if (error instanceof APIError) {
            errorMessage = error.message;
          }

          const errorData = JSON.stringify({
            type: 'error',
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error) {
    console.error('Error generating copywriting:', error);

    let errorMessage = '文案生成失败';
    if (error instanceof APIError) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
