import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';

/**
 * 影视创作 - 人物提示词生成
 * 从故事文本中提取角色设定，生成可用于AI生图的详细人物描述提示词
 * 自动降级: Minimax LLM → Coze LLM
 */

const CHARACTER_PROMPT_SYSTEM = `你是一位资深的影视角色设计师和AI绘画提示词工程师。

你的任务是根据用户提供的故事文本，提取并设计出每个角色的详细设定，包含：
1. 角色基本信息（姓名、年龄、性别）
2. 详细外貌描述（五官、发型、体型、肤色等，需具体可视觉化）
3. 服装造型描述（日常穿着、标志性配饰等）
4. 性格特征与气质
5. AI生图提示词（英文，用于AI图像生成，确保角色一致性）

输出要求：
- 必须严格按照JSON格式输出
- 外貌描述要极其具体，避免抽象词汇，使用具体的五官、发型、服装等描述
- 每个角色的英文提示词需包含：角色外貌关键词+服装关键词+风格关键词
- 确保不同角色之间有明确的视觉区分度
- 英文提示词控制在80词以内，以逗号分隔关键词`;

export async function POST(request: NextRequest) {
  try {
    const { text, style = '真人写实风格', characterCount, filmVisualStyle } = await request.json();
    const byokConnection = extractBYOKConnection(request.headers);

    if (!text?.trim()) {
      return NextResponse.json({ error: '请提供故事文本' }, { status: 400 });
    }

    // 风格一致性约束 — filmVisualStyle 优先（三重锁定）
    const styleConsistency = filmVisualStyle
      ? `【全局视觉风格锁定 - 最高优先级】
1. 所有角色的prompt_en必须以"${filmVisualStyle}"风格关键词开头
2. 如果风格为写实/电影感：prompt_en中严禁出现anime/cartoon/illustration/painting/2d/cel shading等词
3. 如果风格为卡通/动画：prompt_en中严禁出现photorealistic/cinematic/real photo/live action等词
4. 所有角色必须统一视觉风格，不允许一个角色写实另一个角色卡通
5. prompt_en末尾必须包含风格后缀关键词`
      : '';

    const userPrompt = `请从以下故事文本中提取角色设定，并为每个角色生成详细的AI生图提示词：

【故事文本】
${text}

【风格要求】
- 整体风格：${style}
${styleConsistency}
${characterCount ? `- 角色数量：不超过${characterCount}个主要角色` : ''}

请按以下JSON格式输出：

{
  "characters": [
    {
      "name": "角色姓名",
      "age": "年龄",
      "gender": "性别",
      "appearance": "详细中文外貌描述（五官、发型、体型、肤色等，200字以上）",
      "personality": "性格特征与气质描述",
      "outfit": "服装造型描述",
      "prompt_en": "English AI image generation prompt, comma-separated keywords, under 80 words",
      "seed_keywords": "用于固定角色的3-5个核心关键词"
    }
  ]
}`;

    // 使用适配器自动降级: Minimax → Coze
    const result = await aiService.chat({
      messages: [
        { role: 'system', content: CHARACTER_PROMPT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      byokConnection,
    });

    // 解析LLM返回的JSON
    let characters;
    try {
      const content = result.data.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        characters = parsed.characters;
      }
    } catch {
      // JSON解析失败时返回原始文本
      characters = [];
    }

    return NextResponse.json({
      success: true,
      characters: characters || [],
      rawContent: result.data.content,
      provider: result.provider,
      degraded: result.degraded,
    });
  } catch (err) {
    if (isBYOKConfigError(err)) {
      return NextResponse.json(buildBYOKConfigErrorPayload(err), { status: 400 });
    }
    console.error('[CharacterPrompt] Error:', err);
    const errorMsg = err instanceof DegradeError
      ? err.toUserMessage()
      : (err instanceof Error ? err.message : '人物提示词生成失败');
    return NextResponse.json(
      { error: errorMsg },
      { status: err instanceof DegradeError ? 503 : 500 }
    );
  }
}
