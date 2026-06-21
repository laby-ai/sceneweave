// 颜色主色调选项
export const COLOR_THEME_OPTIONS = [
  { id: 'none', name: '不指定', swatches: [], icon: '🎨' },
  { id: 'warm', name: '暖色调', swatches: ['#FF6B6B', '#FF8E53', '#FFC93F'], icon: '🔥' },
  { id: 'cool', name: '冷色调', swatches: ['#4ECDC4', '#45B7D1', '#96CEB4'], icon: '❄️' },
  { id: 'pastel', name: '柔和色调', swatches: ['#FFB6C1', '#DDA0DD', '#87CEEB'], icon: '🌸' },
  { id: 'vibrant', name: '鲜艳色调', swatches: ['#FF006E', '#8338EC', '#3A86FF'], icon: '🌈' },
  { id: 'monochrome', name: '单色调', swatches: ['#000000', '#666666', '#CCCCCC'], icon: '⬛' },
  { id: 'earth', name: '大地色调', swatches: ['#8B4513', '#D2691E', '#F4A460'], icon: '🌍' },
  { id: 'ocean', name: '海洋色调', swatches: ['#0077B6', '#00B4D8', '#90E0EF'], icon: '🌊' },
  { id: 'sunset', name: '日落色调', swatches: ['#FF6B35', '#F7931E', '#FFC857'], icon: '🌅' },
  { id: 'forest', name: '森林色调', swatches: ['#2D5016', '#4A7C23', '#7CB342'], icon: '🌲' },
  { id: 'lavender', name: '薰衣草', swatches: ['#E6E6FA', '#D8BFD8', '#C9A0DC'], icon: '💜' },
  { id: 'coral', name: '珊瑚色调', swatches: ['#FF6F61', '#FF8C69', '#FFAB8A'], icon: '🪸' },
];

// 颜色描述模板
export function generateColorThemePrompt(prompt: string, colorTheme: string): string {
  const colorDescriptions: Record<string, string> = {
    'warm': '整体色调温暖，以红色、橙色、黄色为主，给人热情、舒适的感觉',
    'cool': '整体色调清冷，以蓝色、青色、绿色为主，给人冷静、清爽的感觉',
    'pastel': '整体色调柔和，以马卡龙色系为主，色彩淡雅、饱和度低',
    'vibrant': '整体色调鲜艳夺目，饱和度高，色彩丰富有活力',
    'monochrome': '黑白灰单色调，极简风格，光影层次分明',
    'earth': '大地色系，以棕色、米色、土黄色为主，自然质朴',
    'ocean': '海洋色调，以深蓝、天蓝、青色为主，清新自然',
    'sunset': '日落色调，以橙红、金黄、暖紫色为主，浪漫温馨',
    'forest': '森林色调，以深绿、草绿、橄榄绿为主，生机勃勃',
    'lavender': '薰衣草色调，以淡紫、粉紫为主，浪漫优雅',
    'coral': '珊瑚色调，以橙红、橘粉色为主，温暖活泼',
  };

  if (colorTheme === 'none' || !colorDescriptions[colorTheme]) {
    return prompt;
  }

  return `${prompt}。${colorDescriptions[colorTheme]}`;
}
