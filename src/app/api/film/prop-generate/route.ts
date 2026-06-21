import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';

/**
 * 影视创作 - 道具生成
 * 从故事文本中提取道具描述，增强提示词后生成道具参考图
 * 两步流程: LLM提取道具描述+英文提示词 → AI生图
 * 自动降级: Minimax → Coze（LLM和Image各自独立降级）
 */

const PROP_SYSTEM_PROMPT = `你是一位资深的影视道具设计师和AI绘画提示词工程师。

你的任务是根据用户提供的故事文本，提取并设计出重要道具的详细设定，并生成可用于AI图像生成的英文提示词。

输出要求：
- 必须严格按照JSON格式输出
- 道具描述需包含：名称、材质、颜色、大小、特殊细节
- 只提取对剧情有推动作用或有象征意义的重要道具，不要提取普通日常物品
- 英文提示词需包含：道具外观、材质、光线、风格，控制在60词以内
- 不要在JSON外面添加任何解释文字`;

export async function POST(request: NextRequest) {
  try {
    const { text, style = '真人写实风格', propCount } = await request.json();
    const byokConnection = extractBYOKConnection(request.headers);

    if (!text?.trim()) {
      return NextResponse.json({ error: '请提供故事文本或道具描述' }, { status: 400 });
    }

    const styleMap: Record<string, string> = {
      '真人写实风格': 'photorealistic, studio lighting, product photography',
      '宫崎骏水彩': 'Studio Ghibli style, watercolor, whimsical',
      '赛博朋克': 'cyberpunk style, neon glow, futuristic tech',
      '复古胶片': 'vintage, warm tones, antique look',
      '动漫风格': 'anime style, cel shading, vibrant',
      '油画质感': 'oil painting style, classical still life',
      '极简现代': 'minimalist, clean white background, modern design',
    };

    const styleEn = styleMap[style] || 'photorealistic, studio lighting, detailed';

    const userPrompt = `请从以下文本中提取重要道具设定，并为每个道具生成AI生图提示词：

【文本内容】
${text}

【风格要求】${style}
${propCount ? `道具数量：不超过${propCount}个` : ''}

请按以下JSON格式输出：
{
  "props": [
    {
      "name": "道具名称",
      "material": "材质",
      "color": "颜色",
      "size": "大致尺寸",
      "significance": "在剧情中的意义",
      "description": "详细中文道具描述（外观、材质、细节，100字以上）",
      "prompt_en": "English prop image prompt, ${styleEn}, under 60 words"
    }
  ]
}`;

    // Step 1: LLM提取道具描述（自动降级）
    const llmResult = await aiService.chat({
      messages: [
        { role: 'system', content: PROP_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      byokConnection,
    });

    let props;
    try {
      const content = llmResult.data.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        props = parsed.props;
      }
    } catch {
      props = [];
    }

    if (!props || props.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未能从文本中提取到道具',
        rawContent: llmResult.data.content,
      });
    }

    // Step 2: 为每个道具生成参考图（自动降级）
    const propResults = [];
    for (const prop of props) {
      try {
        const propPrompt = `${prop.prompt_en}, ${styleEn}, isolated on neutral background, detailed, high quality`;

        const imgResult = await aiService.generateImage({
          prompt: propPrompt,
        });

        propResults.push({
          ...prop,
          imageUrl: imgResult.data.url,
          imageProvider: imgResult.provider,
        });
      } catch (err) {
        console.error(`[PropGenerate] Prop "${prop.name}" generation failed:`, err);
        propResults.push({ ...prop, imageUrl: null });
      }
    }

    return NextResponse.json({
      success: true,
      props: propResults,
      message: `已生成${propResults.filter(p => p.imageUrl).length}个道具参考图`,
      llmProvider: llmResult.provider,
    });
  } catch (err) {
    if (isBYOKConfigError(err)) {
      return NextResponse.json(buildBYOKConfigErrorPayload(err), { status: 400 });
    }
    console.error('[PropGenerate] Error:', err);
    const errorMsg = err instanceof DegradeError
      ? err.toUserMessage()
      : (err instanceof Error ? err.message : '道具生成失败');
    return NextResponse.json(
      { error: errorMsg },
      { status: err instanceof DegradeError ? 503 : 500 }
    );
  }
}
