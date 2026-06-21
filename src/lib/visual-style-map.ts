/**
 * 全局视觉风格映射（角色/场景/分镜统一使用，确保全场画风一致）
 * 
 * 每种风格包含:
 * - prefix: 正面提示词前缀，注入到所有图像生成prompt开头
 * - negative: 负面提示词，排除与目标风格冲突的画风
 * - lockPhrase: 强制锁定短语，放在prompt最前面和最后面，三重锁定确保模型不会偏离风格
 * - styleEn: 英文风格名，用于LLM生成promptEn时注入
 * 
 * 所有生成链路（角色三视图/场景四宫格/分镜画面/单卡生成）必须使用此映射，
 * 确保不会出现"一会动画一会真人写实"的风格不一致问题。
 */
export const VISUAL_STYLE_MAP: Record<string, {
  prefix: string;
  negative: string;
  lockPhrase: string;
  styleEn: string;
}> = {
  '电影感': {
    prefix: 'cinematic, film grain, dramatic lighting, anamorphic lens, movie still',
    negative: 'cartoon, anime, illustration, painting, sketch, 2d, cel shading, chibi, manga, comic, drawn, anime face, anime eyes, anime hair, stylized, anime style',
    lockPhrase: 'PHOTOREALISTIC cinematic photography, real person, NOT cartoon NOT anime NOT illustration',
    styleEn: 'cinematic photorealistic',
  },
  '卡通': {
    prefix: 'cartoon style, colorful, playful, cel shading, animated',
    negative: 'photorealistic, real photo, cinematic, live action, photography, realistic face, realistic skin',
    lockPhrase: '2D CARTOON illustration style, NOT photorealistic NOT real photo NOT live action',
    styleEn: 'cartoon animation',
  },
  '优雅': {
    prefix: 'elegant, refined, soft pastels, graceful composition, luxurious',
    negative: 'cartoon, anime, rough, sloppy, messy, ugly, distorted',
    lockPhrase: 'ELEGANT photorealistic portrait, high fashion, NOT cartoon NOT anime',
    styleEn: 'elegant refined',
  },
  '治愈': {
    prefix: 'healing, warm tones, cozy atmosphere, soft lighting, peaceful',
    negative: 'dark, horror, violent, cartoon, anime, scary, grotesque',
    lockPhrase: 'WARM HEALING photorealistic scene, soft natural lighting, NOT cartoon NOT anime',
    styleEn: 'warm healing',
  },
  '现代简约': {
    prefix: 'modern minimalist, clean lines, geometric, monochrome accents',
    negative: 'cartoon, anime, ornate, cluttered, busy, messy',
    lockPhrase: 'MODERN MINIMALIST photorealistic, clean composition, NOT cartoon NOT anime',
    styleEn: 'modern minimalist',
  },
  '霓虹': {
    prefix: 'neon lights, cyberpunk glow, vibrant colors, urban night',
    negative: 'cartoon, anime, daylight, natural, bright cheerful, pastel',
    lockPhrase: 'NEON LIT photorealistic night scene, real lighting, NOT cartoon NOT anime',
    styleEn: 'neon cyberpunk',
  },
  '复古': {
    prefix: 'vintage, retro film, warm tones, nostalgic, aged texture',
    negative: 'cartoon, anime, modern, clean, digital, sharp, crisp',
    lockPhrase: 'VINTAGE FILM photorealistic photography, retro aesthetic, NOT cartoon NOT anime',
    styleEn: 'vintage retro',
  },
  '水墨': {
    prefix: 'chinese ink wash, traditional painting, monochrome, flowing brushstrokes',
    negative: 'photorealistic, real photo, cartoon, anime, 3d render, digital art, hyperrealistic',
    lockPhrase: 'CHINESE INK WASH traditional painting, NOT photorealistic NOT cartoon NOT 3d',
    styleEn: 'chinese ink painting',
  },
  '赛博朋克': {
    prefix: 'cyberpunk, neon, dystopian, high-tech low-life, rain-soaked streets',
    negative: 'cartoon, anime, cheerful, bright, natural, pastel, cute',
    lockPhrase: 'CYBERPUNK photorealistic, dark dystopian, NOT cartoon NOT anime',
    styleEn: 'cyberpunk dystopian',
  },
  '极简黑白': {
    prefix: 'minimalist black and white, high contrast, stark composition',
    negative: 'cartoon, anime, colorful, bright, saturated',
    lockPhrase: 'BLACK AND WHITE photorealistic photography, high contrast, NOT cartoon NOT anime',
    styleEn: 'monochrome minimalist',
  },
};

/**
 * 根据 filmVisualStyle 获取风格提示词
 * @param style 视觉风格名称
 * @returns { styledPrompt, negativePrompt, lockPhrase, styleEn } 或 null（无匹配风格时）
 */
export function getStylePrompt(style: string): {
  styledPrompt: string;
  negativePrompt: string;
  lockPhrase: string;
  styleEn: string;
} | null {
  const entry = VISUAL_STYLE_MAP[style];
  if (!entry) return null;
  return {
    styledPrompt: entry.prefix,
    negativePrompt: entry.negative,
    lockPhrase: entry.lockPhrase,
    styleEn: entry.styleEn,
  };
}

/**
 * 构建风格锁定的完整prompt（三重锁定机制）
 * 1. 开头放置lockPhrase（最强指令）
 * 2. 中间保留原始prompt
 * 3. 结尾放置prefix（风格补充）
 * 
 * @param rawPrompt 原始提示词
 * @param style 视觉风格名称
 * @returns 风格锁定后的提示词
 */
export function buildStyleLockedPrompt(rawPrompt: string, style: string): string {
  const entry = VISUAL_STYLE_MAP[style];
  if (!entry) return rawPrompt;
  
  return `${entry.lockPhrase}, ${rawPrompt}, ${entry.prefix}`;
}

/**
 * 构建风格锁定的negative prompt（增强版）
 * 在基础negative基础上追加通用对立风格关键词
 * 
 * @param style 视觉风格名称
 * @returns 增强版negative prompt
 */
export function buildEnhancedNegative(style: string): string {
  const entry = VISUAL_STYLE_MAP[style];
  if (!entry) return '';
  
  // 通用对立风格关键词（确保所有方向都被覆盖）
  const universalNegatives = [
    'low quality', 'blurry', 'distorted', 'deformed', 'bad anatomy',
    'watermark', 'text', 'logo', 'signature', 'frame', 'border',
  ];
  
  return `${entry.negative}, ${universalNegatives.join(', ')}`;
}
