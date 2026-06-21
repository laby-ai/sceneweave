import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import { VISUAL_STYLE_MAP, buildStyleLockedPrompt, buildEnhancedNegative } from '@/lib/visual-style-map';

/**
 * 影视创作 - 角色设计参考图生成（单图多视角）
 * 生成一张包含头特写+正面全身+侧面全身+背面全身的角色设计参考图
 * 自动降级: Minimax Image → Coze Image
 * 
 * 风格一致性保障:
 * - 三重锁定机制: lockPhrase(开头) + 原始prompt(中间) + prefix(结尾)
 * - 增强版negative prompt: 覆盖所有对立风格
 * - prompt中多次重复风格关键词
 */

interface CharacterViewRequest {
  characterName: string;
  promptEn: string;
  appearance: string;
  style?: string;
  filmVisualStyle?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { characterName, promptEn, appearance, style = '写实风格', filmVisualStyle } = await request.json() as CharacterViewRequest;

    if (!promptEn?.trim() && !appearance?.trim()) {
      return NextResponse.json({ error: '请提供角色描述或英文提示词' }, { status: 400 });
    }

    const basePrompt = promptEn || appearance;

    // 优先使用 filmVisualStyle 确保全局风格一致
    const vsEntry = filmVisualStyle ? VISUAL_STYLE_MAP[filmVisualStyle] : null;

    // 构建风格锁定的提示词和负面提示词
    let styleSuffix: string;
    let negativePrompt: string;
    let lockPhrase: string;

    if (vsEntry) {
      styleSuffix = vsEntry.prefix;
      negativePrompt = buildEnhancedNegative(filmVisualStyle!);
      lockPhrase = vsEntry.lockPhrase;
    } else if (style === '动漫风格') {
      styleSuffix = 'anime style, cel shading, clean lines';
      negativePrompt = 'photorealistic, real photo, cinematic, live action, photography, realistic face, realistic skin';
      lockPhrase = '2D CARTOON illustration style, NOT photorealistic NOT real photo';
    } else if (style === '赛博朋克') {
      styleSuffix = 'cyberpunk style, neon lighting, futuristic';
      negativePrompt = 'cartoon, anime, cheerful, bright, natural';
      lockPhrase = 'CYBERPUNK photorealistic, NOT cartoon NOT anime';
    } else {
      styleSuffix = 'photorealistic, cinematic lighting, detailed, 8k';
      negativePrompt = 'cartoon, anime, illustration, painting, sketch, 2d, cel shading, manga, comic, drawn, anime face, anime eyes, stylized';
      lockPhrase = 'PHOTOREALISTIC cinematic photography, real person, NOT cartoon NOT anime NOT illustration';
    }

    // 单图多视角提示词 — 三重风格锁定
    // 第1重: lockPhrase在开头强制声明风格
    // 第2重: 原始角色描述在中间
    // 第3重: styleSuffix在结尾补充风格细节
    const sheetPrompt = [
      `${lockPhrase},`,
      `Character design reference sheet of ${basePrompt},`,
      `showing 4 views in a single image arranged horizontally:`,
      `1) close-up head portrait facing camera,`,
      `2) full body front view facing camera,`,
      `3) full body three-quarter side view,`,
      `4) full body back view,`,
      `all views of the same character with consistent appearance,`,
      `plain white background, character turnaround sheet,`,
      `professional character design, ${styleSuffix},`,
      `${lockPhrase}`, // 第4重: 结尾再次锁定
    ].join(' ');

    try {
      const result = await aiService.generateImage({
        prompt: sheetPrompt,
        negative_prompt: negativePrompt || undefined,
      });

      return NextResponse.json({
        success: true,
        characterName,
        imageUrl: result.data.url,
        prompt: sheetPrompt,
        negativePrompt,
        provider: result.provider,
      });
    } catch (imgErr) {
      console.error('[CharacterViews] Image generation failed:', imgErr);
      throw imgErr;
    }
  } catch (err) {
    console.error('[CharacterViews] Error:', err);
    const errorMsg = err instanceof DegradeError
      ? err.toUserMessage()
      : (err instanceof Error ? err.message : '角色参考图生成失败');
    return NextResponse.json(
      { error: errorMsg },
      { status: err instanceof DegradeError ? 503 : 500 }
    );
  }
}
