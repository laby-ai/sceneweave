import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import { VISUAL_STYLE_MAP, buildStyleLockedPrompt, buildEnhancedNegative } from '@/lib/visual-style-map';
import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';

/**
 * 影视创作 - 场景生成
 * 从故事文本中提取场景描述，增强提示词后生成场景氛围图
 * 两步流程: LLM生成场景描述+英文提示词 → AI生图
 * 自动降级: Minimax → Coze（LLM和Image各自独立降级）
 * 
 * 风格一致性保障:
 * - LLM生成的prompt_en中注入风格锁定约束
 * - 生图时使用三重锁定机制+增强版negative prompt
 */

const SCENE_SYSTEM_PROMPT = `你是一位资深的影视场景设计师和AI绘画提示词工程师。

你的任务是根据用户提供的故事文本，提取并设计出每个场景的详细设定，并生成可用于AI图像生成的英文提示词。

【关键规则】风格一致性是最高优先级！
- 所有场景的英文提示词必须在最开头包含指定的风格锁定词组
- 所有场景的英文提示词必须在结尾包含风格后缀
- 禁止在不同场景之间切换风格（如一个写实一个卡通）
- 如果指定了写实风格，提示词中绝不能出现 anime/cartoon/illustration/painting 等词

【关键规则】场景图中不得出现人物！
- 场景图只展示环境、建筑、自然景观、氛围，不展示任何人物
- 英文提示词中必须包含 "empty scene, no people, no characters, devoid of human figures"
- 英文提示词中禁止出现任何人物描述词（如 girl, boy, man, woman, child, person 等）
- 场景描述中可以有对环境的拟人化描述，但生图提示词中不得包含人物

输出要求：
- 必须严格按照JSON格式输出
- 场景描述需包含：地点、时间、天气/光线、色调、氛围
- 英文提示词需包含：环境、光线、色调、氛围、风格，控制在80词以内
- 不要在JSON外面添加任何解释文字`;

export async function POST(request: NextRequest) {
  try {
    const { text, style = '真人写实风格', sceneCount, filmVisualStyle } = await request.json();
    const byokConnection = extractBYOKConnection(request.headers);

    if (!text?.trim()) {
      return NextResponse.json({ error: '请提供故事文本或场景描述' }, { status: 400 });
    }

    // Step 1: LLM生成场景描述和提示词（自动降级）
    const styleMap: Record<string, string> = {
      '真人写实风格': 'photorealistic, cinematic lighting, 8k',
      '宫崎骏水彩': 'Studio Ghibli style, watercolor, whimsical, soft colors',
      '赛博朋克': 'cyberpunk style, neon lights, dark atmosphere, futuristic',
      '复古胶片': 'vintage film look, grain, warm tones, 35mm film',
      '黑白艺术': 'black and white, high contrast, dramatic lighting',
      '动漫风格': 'anime style, cel shading, vibrant colors',
      '油画质感': 'oil painting style, rich textures, classical lighting',
      '极简现代': 'minimalist, clean lines, modern aesthetic, soft lighting',
    };

    const vsEntry = filmVisualStyle ? VISUAL_STYLE_MAP[filmVisualStyle] : null;
    const styleEn = vsEntry ? vsEntry.prefix : (styleMap[style] || 'cinematic, detailed, 8k');
    const lockPhrase = vsEntry ? vsEntry.lockPhrase : '';
    const sceneNegPrompt = vsEntry ? buildEnhancedNegative(filmVisualStyle!) : '';

    const userPrompt = `请从以下文本中提取场景设定，并为每个场景生成AI生图提示词：

【文本内容】
${text}

【风格要求】${style}
${lockPhrase ? `【风格锁定词组】每个场景的英文提示词必须在最开头包含: ${lockPhrase}` : ''}
${sceneCount ? `场景数量：不超过${sceneCount}个` : ''}

请按以下JSON格式输出：
{
  "scenes": [
    {
      "name": "场景名称",
      "location": "地点描述",
      "timeOfDay": "日/夜/晨/黄昏",
      "weather": "天气/光线",
      "mood": "氛围关键词",
      "description": "详细中文场景描述（环境、光线、色调、氛围，200字以上）",
      "prompt_en": "${lockPhrase ? lockPhrase + ', ' : ''}English scene image prompt (MUST include: empty scene, no people, no characters, devoid of human figures), ${styleEn}, under 80 words"
    }
  ]
}`;

    const llmResult = await aiService.chat({
      messages: [
        { role: 'system', content: SCENE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      byokConnection,
    });

    let scenes;
    try {
      const content = llmResult.data.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        scenes = parsed.scenes;
      }
    } catch {
      scenes = [];
    }

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未能从文本中提取到场景',
        rawContent: llmResult.data.content,
      });
    }

    // Step 2: 为每个场景生成氛围图（三重风格锁定 + 增强negative + 禁止人物）
    const sceneNegBase = 'person, people, character, human, figure, man, woman, child, boy, girl';
    const sceneResults = [];
    for (const scene of scenes) {
      try {
        // 三重风格锁定: lockPhrase + prompt + prefix, 场景图强制无人物
        const rawPrompt = scene.prompt_en || `${scene.location}, ${scene.mood}, ${scene.timeOfDay}`;
        // 确保场景prompt中包含无人物约束
        const noPeoplePrompt = rawPrompt.includes('no people') ? rawPrompt : `${rawPrompt}, empty scene, no people, no characters, devoid of human figures`;
        const lockedPrompt = vsEntry
          ? `${lockPhrase}, ${noPeoplePrompt}, ${vsEntry.prefix}, establishing shot, cinematic composition, concept art, ${lockPhrase}`
          : `${noPeoplePrompt}, ${styleEn}, establishing shot, cinematic composition, concept art`;

        const imgResult = await aiService.generateImage({
          prompt: lockedPrompt,
          negative_prompt: sceneNegPrompt ? `${sceneNegPrompt}, ${sceneNegBase}` : sceneNegBase,
        });

        sceneResults.push({
          ...scene,
          imageUrl: imgResult.data.url,
          imageProvider: imgResult.provider,
        });
      } catch (err) {
        console.error(`[SceneGenerate] Scene "${scene.name}" generation failed:`, err);
        sceneResults.push({ ...scene, imageUrl: null });
      }
    }

    return NextResponse.json({
      success: true,
      scenes: sceneResults,
      message: `已生成${sceneResults.filter(s => s.imageUrl).length}个场景氛围图`,
      llmProvider: llmResult.provider,
    });
  } catch (err) {
    if (isBYOKConfigError(err)) {
      return NextResponse.json(buildBYOKConfigErrorPayload(err), { status: 400 });
    }
    console.error('[SceneGenerate] Error:', err);
    const errorMsg = err instanceof DegradeError
      ? err.toUserMessage()
      : (err instanceof Error ? err.message : '场景生成失败');
    return NextResponse.json(
      { error: errorMsg },
      { status: err instanceof DegradeError ? 503 : 500 }
    );
  }
}
