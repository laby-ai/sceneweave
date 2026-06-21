export interface ThemeConfig {
  id: string;
  name: string;
  gradient: string;
  primaryColor: string;
  accentColor: string;
  description: string;
}

export const DEFAULT_THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: '绘影蓝紫',
    gradient: 'from-[#4F6CFF] to-[#8B5CF6]',
    primaryColor: '#4F6CFF',
    accentColor: '#8b5cf6',
    description: '适合黑色创作工作台的品牌蓝紫'
  },
  {
    id: 'sunset',
    name: '日落橙红',
    gradient: 'from-red-500 to-pink-500',
    primaryColor: '#f97316',
    accentColor: '#ec4899',
    description: '温暖的日落色调，充满活力'
  },
  {
    id: 'forest',
    name: '赤焰红金',
    gradient: 'from-red-500 to-red-500',
    primaryColor: '#EF4444',
    accentColor: '#f59e0b',
    description: '热烈的赤焰色调，激情创作'
  },
  {
    id: 'ocean',
    name: '海洋蓝青',
    gradient: 'from-blue-600 to-sky-600',
    primaryColor: '#0891b2',
    accentColor: '#0d9488',
    description: '深邃的海洋色调，冷静睿智'
  },
  {
    id: 'rose',
    name: '玫瑰粉金',
    gradient: 'from-rose-500 to-pink-500',
    primaryColor: '#f43f5e',
    accentColor: '#ec4899',
    description: '优雅的玫瑰色调，浪漫甜美'
  },
  {
    id: 'midnight',
    name: '午夜靛蓝',
    gradient: 'from-indigo-700 to-slate-800',
    primaryColor: '#4f46e5',
    accentColor: '#6366f1',
    description: '神秘的午夜色调，高端大气'
  },
  {
    id: 'sunrise',
    name: '晨曦黄橙',
    gradient: 'from-red-500 to-red-500',
    primaryColor: '#f59e0b',
    accentColor: '#f97316',
    description: '明亮的晨曦色调，充满希望'
  },
  {
    id: 'lavender',
    name: '薰衣草紫',
    gradient: 'from-red-500 to-red-500',
    primaryColor: '#8b5cf6',
    accentColor: '#a855f7',
    description: '温柔的薰衣草色，梦幻唯美'
  }
];

export interface UserSettings {
  themeId: string;
  compactMode: boolean;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  autoSave: boolean;
  language: 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'fr-FR' | 'de-DE' | 'es-ES' | 'zh-TW' | 'pt-BR' | 'ru-RU' | 'it-IT' | 'th-TH' | 'vi-VN' | 'id-ID' | 'ar-SA' | 'hi-IN';
  defaultQuality: 'standard' | 'high' | 'ultra';
  defaultResolution: string;
  showTips: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  fontStyle: 'default' | 'rounded' | 'serif' | 'monospace' | 'noto-sans' | 'noto-serif' | 'lxgw-wenkai' | 'ma-shan-zheng' | 'zcoolkuaile';
}

// 语言选项
export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { value: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { value: 'en-US', label: 'English', flag: '🇺🇸' },
  { value: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { value: 'ko-KR', label: '한국어', flag: '🇰🇷' },
  { value: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { value: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { value: 'pt-BR', label: 'Português', flag: '🇧🇷' },
  { value: 'ru-RU', label: 'Русский', flag: '🇷🇺' },
  { value: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
  { value: 'th-TH', label: 'ไทย', flag: '🇹🇭' },
  { value: 'vi-VN', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'id-ID', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { value: 'ar-SA', label: 'العربية', flag: '🇸🇦' },
  { value: 'hi-IN', label: 'हिन्दी', flag: '🇮🇳' },
];

// 字体大小选项
export const FONT_SIZE_OPTIONS = [
  { value: 'small', label: '小', size: '0.875rem' },
  { value: 'medium', label: '中', size: '1rem' },
  { value: 'large', label: '大', size: '1.125rem' },
  { value: 'extra-large', label: '特大', size: '1.25rem' },
];

// 字体风格选项
export const FONT_STYLE_OPTIONS = [
  // === 中文基础 ===
  { value: 'default', label: '默认无衬线', fontClass: 'font-sans', preview: 'Aa 你好世界', category: '中文基础' },
  { value: 'notoSans', label: '思源黑体', fontClass: 'font-noto-sans', preview: 'Aa 思源黑体', category: '中文基础' },
  { value: 'notoSerif', label: '思源宋体', fontClass: 'font-noto-serif', preview: 'Aa 思源宋体', category: '中文基础' },
  // === 中文手写/艺术 ===
  { value: 'lxgwWenkai', label: '霞鹜文楷', fontClass: 'font-lxgw-wenkai', preview: 'Aa 霞鹜文楷', category: '中文艺术' },
  { value: 'maShanZheng', label: '马善政楷体', fontClass: 'font-ma-shan-zheng', preview: 'Aa 马善政楷', category: '中文艺术' },
  { value: 'zcoolkuaile', label: '站酷快乐体', fontClass: 'font-zcoolkuaile', preview: 'Aa 站酷快乐', category: '中文艺术' },
  { value: 'zcoolQingke', label: '站酷庆科黄油', fontClass: 'font-zcool-qingke', preview: 'Aa 庆科黄油', category: '中文艺术' },
  { value: 'zhimangxing', label: '志莽行书', fontClass: 'font-zhimangxing', preview: 'Aa 志莽行书', category: '中文艺术' },
  { value: 'liujianmaocao', label: '刘建毛草', fontClass: 'font-liujianmaocao', preview: 'Aa 刘建毛草', category: '中文艺术' },
  { value: 'longcang', label: '龙藏体', fontClass: 'font-longcang', preview: 'Aa 龙藏体', category: '中文艺术' },
  // === 日文字体 ===
  { value: 'notoSansJp', label: 'Noto Sans JP', fontClass: 'font-noto-sans-jp', preview: 'Aa こんにちは', category: '日本語' },
  { value: 'notoSerifJp', label: 'Noto Serif JP', fontClass: 'font-noto-serif-jp', preview: 'Aa こんにちは', category: '日本語' },
  { value: 'zenMaru', label: 'Zen Maru Gothic', fontClass: 'font-zen-maru', preview: 'Aa 丸ゴシック', category: '日本語' },
  { value: 'kosugiMaru', label: 'Kosugi Maru', fontClass: 'font-kosugi-maru', preview: 'Aa 小杉丸', category: '日本語' },
  // === 韩文字体 ===
  { value: 'notoSansKr', label: 'Noto Sans KR', fontClass: 'font-noto-sans-kr', preview: 'Aa 안녕하세요', category: '한국어' },
  { value: 'blackHanSans', label: 'Black Han Sans', fontClass: 'font-black-han-sans', preview: 'Aa 블랙한', category: '한국어' },
  { value: 'doHyeon', label: 'Do Hyeon', fontClass: 'font-do-hyeon', preview: 'Aa 도현', category: '한국어' },
  // === 英文/西文 ===
  { value: 'inter', label: 'Inter', fontClass: 'font-inter', preview: 'Aa HuiYing', category: 'Western' },
  { value: 'poppins', label: 'Poppins', fontClass: 'font-poppins', preview: 'Aa HuiYing', category: 'Western' },
  { value: 'spaceGrotesk', label: 'Space Grotesk', fontClass: 'font-space-grotesk', preview: 'Aa HuiYing', category: 'Western' },
  { value: 'playfair', label: 'Playfair Display', fontClass: 'font-playfair', preview: 'Aa HuiYing', category: 'Western' },
  // === 编程等宽 ===
  { value: 'firaCode', label: 'Fira Code', fontClass: 'font-fira-code', preview: 'Aa => {}', category: '编程' },
  { value: 'sourceCode', label: 'Source Code Pro', fontClass: 'font-source-code', preview: 'Aa => {}', category: '编程' },
  { value: 'monospace', label: '系统等宽', fontClass: 'font-mono', preview: 'Aa => {}', category: '编程' },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  themeId: 'default',
  compactMode: false,
  animationsEnabled: true,
  soundEnabled: true,
  autoSave: true,
  language: 'zh-CN',
  defaultQuality: 'standard',
  defaultResolution: '1024x1024',
  showTips: true,
  fontSize: 'medium',
  fontStyle: 'default',
};
