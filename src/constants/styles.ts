// 视频和图片风格选项
export const STYLE_OPTIONS = [
  { value: 'realistic', label: '写实风格', description: '真实感强，细节丰富' },
  { value: 'anime', label: '动漫风格', description: '日系动漫风格' },
  { value: 'cartoon', label: '卡通风格', description: '简洁可爱的卡通' },
  { value: 'cinematic', label: '电影风格', description: '大片质感，光影丰富' },
  { value: 'watercolor', label: '水彩风格', description: '柔和的水彩画效果' },
  { value: 'oil-painting', label: '油画风格', description: '厚重的油画质感' },
  { value: 'pixel-art', label: '像素风格', description: '复古像素艺术' },
  { value: '3d-render', label: '3D渲染', description: '精致的3D建模效果' },
  { value: 'sketch', label: '素描风格', description: '手绘草图效果' },
  { value: 'minimalist', label: '极简风格', description: '简洁现代的设计' },
  { value: 'vintage', label: '复古风格', description: '怀旧复古质感' },
  { value: 'cyberpunk', label: '赛博朋克', description: '未来科技感' },
];

// 视频和图片氛围选项
export const MOOD_OPTIONS = [
  { value: 'happy', label: '快乐', description: '轻松愉快的氛围' },
  { value: 'romantic', label: '浪漫', description: '温馨浪漫的感觉' },
  { value: 'mysterious', label: '神秘', description: '神秘悬疑的氛围' },
  { value: 'epic', label: '史诗', description: '宏大史诗感' },
  { value: 'peaceful', label: '宁静', description: '平静祥和的氛围' },
  { value: 'exciting', label: '激动', description: '充满活力和激情' },
  { value: 'dramatic', label: '戏剧', description: '强烈的戏剧冲突' },
  { value: 'whimsical', label: '奇幻', description: '奇幻异想天开' },
  { value: 'nostalgic', label: '怀旧', description: '怀旧回忆感' },
  { value: 'tense', label: '紧张', description: '紧张刺激的氛围' },
  { value: 'heartwarming', label: '温馨', description: '温暖人心的感觉' },
  { value: 'futuristic', label: '未来', description: '科技未来感' },
];

// 根据风格和氛围生成提示词模板
export function generateEnhancedPrompt(
  basePrompt: string,
  style?: string,
  mood?: string
): string {
  let enhancedPrompt = basePrompt;

  // 添加风格描述
  if (style && style !== 'none') {
    const styleInfo = STYLE_OPTIONS.find(s => s.value === style);
    if (styleInfo) {
      switch (style) {
        case 'realistic':
          enhancedPrompt += `，超写实风格，照片级真实感，丰富的细节`;
          break;
        case 'anime':
          enhancedPrompt += `，日系动漫风格，精美细腻的画风`;
          break;
        case 'cartoon':
          enhancedPrompt += `，卡通风格，简洁可爱，色彩鲜艳`;
          break;
        case 'cinematic':
          enhancedPrompt += `，电影大片风格，专业电影级光影，宽屏构图`;
          break;
        case 'watercolor':
          enhancedPrompt += `，水彩画风格，柔和的水彩质感，清透明快`;
          break;
        case 'oil-painting':
          enhancedPrompt += `，油画风格，厚重的油画笔触，丰富的色彩层次`;
          break;
        case 'pixel-art':
          enhancedPrompt += `，像素艺术风格，复古8-bit像素风`;
          break;
        case '3d-render':
          enhancedPrompt += `，3D渲染风格，高质量3D建模，逼真的材质渲染`;
          break;
        case 'sketch':
          enhancedPrompt += `，素描风格，手绘质感，铅笔线条`;
          break;
        case 'minimalist':
          enhancedPrompt += `，极简风格，简洁现代，留白设计`;
          break;
        case 'vintage':
          enhancedPrompt += `，复古风格，怀旧质感，胶片色调`;
          break;
        case 'cyberpunk':
          enhancedPrompt += `，赛博朋克风格，霓虹灯光，未来都市，科技感`;
          break;
      }
    }
  }

  // 添加氛围描述
  if (mood && mood !== 'none') {
    const moodInfo = MOOD_OPTIONS.find(m => m.value === mood);
    if (moodInfo) {
      switch (mood) {
        case 'happy':
          enhancedPrompt += `，明亮欢快的氛围，温暖的阳光，愉悦的心情`;
          break;
        case 'romantic':
          enhancedPrompt += `，浪漫温馨的氛围，柔和的光线，温暖的色调`;
          break;
        case 'mysterious':
          enhancedPrompt += `，神秘悬疑的氛围，暗色调，阴影层次，神秘感`;
          break;
        case 'epic':
          enhancedPrompt += `，宏大史诗感，壮阔的场景，震撼的视觉效果`;
          break;
        case 'peaceful':
          enhancedPrompt += `，宁静祥和的氛围，柔和的光线，平和的感觉`;
          break;
        case 'exciting':
          enhancedPrompt += `，充满活力和激情，动感的画面，热烈的氛围`;
          break;
        case 'dramatic':
          enhancedPrompt += `，强烈的戏剧感，戏剧性的光影，情感饱满`;
          break;
        case 'whimsical':
          enhancedPrompt += `，奇幻异想天开的氛围，梦幻色彩，想象力丰富`;
          break;
        case 'nostalgic':
          enhancedPrompt += `，怀旧回忆感，复古色调，温暖的记忆`;
          break;
        case 'tense':
          enhancedPrompt += `，紧张刺激的氛围，紧凑的节奏，悬念感`;
          break;
        case 'heartwarming':
          enhancedPrompt += `，温暖人心的感觉，柔和的光线，温馨的场景`;
          break;
        case 'futuristic':
          enhancedPrompt += `，未来科技感，现代设计，科幻元素`;
          break;
      }
    }
  }

  return enhancedPrompt;
}
