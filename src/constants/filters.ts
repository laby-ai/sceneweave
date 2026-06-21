// 视频分辨率选项
export const VIDEO_RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p', description: '高清 (1280x720)' },
  { value: '1080p', label: '1080p', description: '全高清 (1920x1080)' },
  { value: '2k', label: '2K', description: '2K 超清 (2560x1440)' },
  { value: '4k', label: '4K', description: '4K 超高清 (3840x2160)' },
];

// 视频比例选项
export const VIDEO_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9', description: '宽屏 (16:9)' },
  { value: '9:16', label: '9:16', description: '竖屏 (9:16)' },
  { value: '1:1', label: '1:1', description: '方形 (1:1)' },
  { value: '4:3', label: '4:3', description: '传统 (4:3)' },
];

// 图片分辨率选项
export const IMAGE_RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p', description: '高清 (1280x720)' },
  { value: '1080p', label: '1080p', description: '全高清 (1920x1080)' },
  { value: '2k', label: '2K', description: '2K 超清 (2560x1440)' },
  { value: '4k', label: '4K', description: '4K 超高清 (3840x2160)' },
  { value: '8k', label: '8K', description: '8K 极致 (7680x4320)' },
];

// 图片尺寸选项
export const IMAGE_SIZE_OPTIONS = [
  { value: '1024x1024', label: '1024x1024', description: '方形 (1:1)' },
  { value: '1280x720', label: '1280x720', description: '宽屏 (16:9)' },
  { value: '720x1280', label: '720x1280', description: '竖屏 (9:16)' },
  { value: '1920x1080', label: '1920x1080', description: '全高清 (16:9)' },
  { value: '1080x1920', label: '1080x1920', description: '全高清竖屏 (9:16)' },
  { value: '2560x1440', label: '2560x1440', description: '2K (16:9)' },
  { value: '3840x2160', label: '3840x2160', description: '4K (16:9)' },
];

// 图片质量选项
export const IMAGE_QUALITY_OPTIONS = [
  { value: 'standard', label: '标准', description: '平衡质量和速度' },
  { value: 'high', label: '高清', description: '高质量，推荐使用' },
  { value: 'ultra', label: '超清', description: '最高质量，生成较慢' },
];

// 滤镜效果选项
export const FILTER_OPTIONS = [
  { value: 'none', label: '无滤镜', description: '原始效果' },
  { value: 'vintage', label: '复古', description: '怀旧老照片风格' },
  { value: 'black-white', label: '黑白', description: '经典黑白效果' },
  { value: 'warm', label: '暖色调', description: '温暖的黄色调' },
  { value: 'cool', label: '冷色调', description: '清爽的蓝色调' },
  { value: 'vivid', label: '鲜艳', description: '增强饱和度和对比度' },
  { value: 'soft', label: '柔和', description: '柔和朦胧效果' },
  { value: 'dramatic', label: '戏剧', description: '强烈的戏剧效果' },
  { value: 'film', label: '胶片', description: '电影胶片质感' },
  { value: 'dreamy', label: '梦幻', description: '梦幻柔和效果' },
];

// 滤镜效果描述模板
export const FILTER_DESCRIPTIONS: Record<string, string> = {
  'vintage': '复古怀旧风格，带有老照片的颗粒感和泛黄色调',
  'black-white': '经典黑白效果，高对比度，富有艺术感',
  'warm': '温暖的暖色调，增加黄色和红色，营造温馨氛围',
  'cool': '清爽的冷色调，增加蓝色和青色，营造宁静感',
  'vivid': '鲜艳色彩，增强饱和度和对比度，让颜色更生动',
  'soft': '柔和朦胧，降低对比度，增加柔焦效果',
  'dramatic': '戏剧效果，高对比度，强烈的色彩和明暗对比',
  'film': '电影胶片质感，细腻的颗粒感和电影色调',
  'dreamy': '梦幻效果，柔和的光晕和朦胧感，营造梦幻氛围',
};

// 生成包含滤镜的增强描述
export function generateFilterPrompt(prompt: string, filter: string): string {
  if (filter === 'none') {
    return prompt;
  }

  const filterDesc = FILTER_DESCRIPTIONS[filter] || '';
  const filterOption = FILTER_OPTIONS.find(f => f.value === filter);
  
  if (!filterDesc) {
    return prompt;
  }

  return `${prompt}，${filterDesc}`;
}

// 主题选项
export const THEME_OPTIONS = [
  { value: 'default', label: '默认蓝紫', color: 'from-blue-600 to-purple-600' },
  { value: 'sunset', label: '日落橙红', color: 'from-red-500 to-red-500' },
  { value: 'forest', label: '森林青绿', color: 'from-green-500 to-emerald-600' },
  { value: 'ocean', label: '海洋蓝绿', color: 'from-red-500 to-blue-600' },
  { value: 'sunrise', label: '日出粉紫', color: 'from-pink-500 to-red-500' },
  { value: 'midnight', label: '午夜深蓝', color: 'from-indigo-600 to-slate-800' },
  { value: 'autumn', label: '秋日金棕', color: 'from-red-500 to-orange-600' },
  { value: 'spring', label: '春日粉绿', color: 'from-rose-400 to-green-500' },
];

// 获取主题颜色类
export function getThemeGradient(theme: string): string {
  const themeOption = THEME_OPTIONS.find(t => t.value === theme);
  return themeOption?.color || 'from-blue-600 to-purple-600';
}

// 获取主题主色调
export function getThemePrimaryColor(theme: string): string {
  const colorMap: Record<string, string> = {
    'default': 'blue',
    'sunset': 'orange',
    'forest': 'green',
    'ocean': 'cyan',
    'sunrise': 'pink',
    'midnight': 'indigo',
    'autumn': 'amber',
    'spring': 'rose',
  };
  return colorMap[theme] || 'blue';
}
