// 字幕分段类型 - 基础版
export interface SubtitleSegment {
  id: string;
  text: string;
  startTime: number; // 秒
  endTime: number; // 秒
  // 多人访谈扩展（可选）
  speakerId?: string;
}

// ========== 多角色/多人访谈支持 ==========
// 说话人信息
export interface SpeakerInfo {
  id: string;
  name: string;           // 显示名称 (如 "主持人", "嘉宾A")
  label?: string;         // 短标签 (如 "A", "B")
  color: string;          // 角色颜色
  position: 'left' | 'right' | 'center'; // 显示位置
}

// 多角色字幕分段
export interface MultiSpeakerSegment extends SubtitleSegment {
  speakerId: string;
  speakerName: string;
  speakerStyle?: {
    color: string;
    position: 'left' | 'right' | 'center';
  };
}

// ========== ASR 语音识别支持 ==========
// ASR 识别结果
export interface ASRResult {
  segments: ASRSegment[];
  language: string;
  confidence: number;
  duration: number;
  speakers?: SpeakerInfo[]; // 说话人列表（如果启用说话人检测）
}

// ASR 单条识别结果
export interface ASRSegment extends SubtitleSegment {
  confidence: number;      // 置信度 0-1
  speakerId?: string;      // 说话人ID
  speakerLabel?: string;   // 说话人标签
  words?: ASRWord[];       // 词级时间戳
}

// 词级时间戳
export interface ASRWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// ========== SRT/ASS 格式支持 ==========
// SRT 格式选项
export interface SRTExportOptions {
  encoding?: 'utf-8' | 'utf-8-bom' | 'gbk';
  lineEnding?: '\n' | '\r\n';
  includeBOM?: boolean;
}

// ASS 样式定义
export interface ASSStyleDefinition {
  name: string;
  fontname: string;
  fontsize: number;
  primaryColour: string;   // &HBBGGRR&
  secondaryColour: string;
  outlineColour: string;   // 描边颜色
  backColour: string;      // 背景颜色
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeOut: boolean;
  scalex: number;
  scaley: number;
  spacing: number;
  angle: number;
  borderStyle: number;     // 1=描边+阴影, 3=不透明背景
  outline: number;         // 描边宽度
  shadow: number;          // 阴影深度
  alignment: number;       // ASS对齐方式 1-9
  marginL: number;
  marginR: number;
  marginV: number;
}

// ========== 提示词解析引擎 (QClaw兼容) ==========
// 解析后的提示词结构
export interface ParsedSubtitlePrompt {
  action: 'generate' | 'add' | 'embed' | 'extract' | 'proofread' | 'batch';
  source: {
    videoPath?: string;
    textContent?: string;
    textFilePath?: string;
    directoryPath?: string;
    srtFilePath?: string;
  };
  language: string;
  constraints: {
    maxCharsPerLine: number;
    maxCharsDoubleLine: number;
    minDurationPerSegment: number;
    format: 'srt' | 'ass' | 'hard' | 'soft';
    singleLineMode: boolean;
  };
  style: SubtitleStyleAdvanced;
  postProcess: {
    proofread: boolean;
    alignAV: boolean;
    removeFillerWords: boolean;
    boldKeywords: boolean;
    normalizePunctuation: boolean;
    fillerWordList: string[];
  };
  speakerDetection: boolean;
  output: {
    format: string;
    path?: string;
    sameDirectory?: boolean;
  };
  rawPrompt: string;
  parseConfidence: number; // 0-1, 解析置信度
  warnings: string[];      // 解析警告
}

// ========== 高级字幕样式配置 ==========
// 字幕样式配置 - 增强版
export interface SubtitleStyle {
  position: 'top' | 'upper-third' | 'middle' | 'lower-third' | 'bottom' | 'custom';
  customPositionY?: number; // 自定义Y轴百分比
  customPositionX?: number; // 自定义X轴百分比
  fontSize: 'small' | 'medium' | 'large' | 'xlarge' | 'custom';
  fontSizeCustom?: number;  // 自定义字体大小(px)
  fontFamily: string;       // 字体族
  color: string;
  backgroundColor?: string;
  backgroundOpacity?: number; // 背景透明度 0-1
  hasBorder?: boolean;
  borderColor?: string;
  borderWidth?: number;     // 描边宽度(px)
  hasShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;      // 阴影模糊度(px)
  opacity?: number;
  fontWeight?: 'normal' | 'bold';
  alignment?: 'left' | 'center' | 'right';
  bottomMargin?: number;    // 下距百分比
  // 视频文字专用样式
  isVideoText?: boolean;
  videoTextFontSize?: number;
  animation?: 'none' | 'fade' | 'slide' | 'scale' | 'typewriter';
  animationDuration?: number;
}

// 高级样式（用于提示词解析输出）
export interface SubtitleStyleAdvanced extends Omit<SubtitleStyle, 'fontSize'> {
  fontSize: number;         // 精确像素值
  strokeWidth: number;      // 描边宽度
  strokeColor: string;      // 描边颜色
}

// 字幕配置 - 增强版
export interface SubtitleConfig {
  enabled: boolean;
  segments: SubtitleSegment[];
  multiSpeakerSegments?: MultiSpeakerSegment[]; // 多角色字幕
  speakers?: SpeakerInfo[];                     // 说话人列表
  style: SubtitleStyle;
  generateVoice: boolean;
  voiceType: 'female' | 'male';
  voiceLanguage: string;
  speechSpeed: number;
  // 视频文字模式（合并字幕和视频文字编辑）
  enableVideoText: boolean;
  videoTextSegments: VideoTextSegment[];
  useMultiSegmentVideoText: boolean;
  // ★ 标题/标注动画效果
  videoTextAnimation?: 'none' | 'fade-in' | 'slide-up' | 'slide-left' | 'zoom-in' | 'typewriter' | 'bounce' | 'glow';
  // ★ 单段标题/标注模式字段（useMultiSegmentVideoText=false时使用）
  videoText?: string;
  videoTextPosition?: 'top' | 'upper-third' | 'middle' | 'lower-third' | 'bottom' | 'custom';
  videoTextFontSize?: number;
  videoTextFontWeight?: 'normal' | 'bold';
  // 音频相关配置
  aiAudioPrompt?: string;
  audioUrl?: string;
  audioPrompt?: string;
  // 语音旁白时是否同时显示字幕
  showSubtitleWithVoice?: boolean;
  // 智能定位配置
  autoPosition?: boolean;
  smartPositionResult?: SmartPositionResult | null;
  // 样式模式：auto=全自动(根据视频内容推荐) / manual=纯手动 / hybrid=自动推荐+手动微调
  styleMode?: 'auto' | 'manual' | 'hybrid';
  // 自动样式推荐结果（auto/hybrid 模式下使用）
  autoStyleRecommendation?: SubtitleStyle | null;
  // ========== 新增：高级功能 ==========
  // SRT/ASS 导入导出
  importFormat?: 'srt' | 'ass' | 'auto';
  exportFormat?: 'srt' | 'ass' | 'hard' | 'soft';
  // ASR 配置
  asrLanguage?: string;
  asrEnableSpeakerDetection?: boolean;
  asrEnableWordTimestamp?: boolean;
  // 断句规则
  maxCharsPerLine?: number;       // 单行最大字数 (默认18)
  maxCharsDoubleLine?: number;    // 双行最大字数 (默认32)
  minDurationPerSegment?: number; // 最小时长/条 (默认0.8秒)
  // 校对配置
  enableProofread?: boolean;
  removeFillerWords?: boolean;
  fillerWords?: string[];
  boldKeywords?: boolean;
  keywords?: string[];
}

// 视频文字分段类型
export interface VideoTextSegment {
  id: string;
  text: string;
  position: 'top' | 'upper-third' | 'middle' | 'lower-third' | 'bottom' | 'custom';
  startTime: number; // 秒
  endTime: number; // 秒
  // 样式选项
  fontSize?: number; // 字体大小
  fontColor?: string; // 字体颜色
  fontWeight?: 'normal' | 'bold'; // 字体粗细
  backgroundColor?: string; // 背景颜色
  backgroundOpacity?: number; // 背景透明度 0-1
  borderColor?: string; // 边框颜色
  borderWidth?: number; // 边框宽度
  shadowColor?: string; // 阴影颜色
  shadowEnabled?: boolean; // 是否启用阴影
  alignment?: 'left' | 'center' | 'right'; // 对齐方式（水平）
  customPositionX?: number; // 自定义X轴百分比 (0-100)
  customPositionY?: number; // 自定义Y轴百分比 (0-100)
  // 动画效果
  animation?: 'none' | 'fade' | 'slide' | 'scale'; // 动画类型
  animationDuration?: number; // 动画持续时间（秒）
}

// 默认字幕样式 - 增强版
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  position: 'bottom',
  customPositionY: 90,
  customPositionX: 50,
  fontSize: 'medium',
  fontSizeCustom: 28,
  fontFamily: 'Microsoft YaHei, "微软雅黑", sans-serif',
  color: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backgroundOpacity: 0.6,
  hasBorder: true,
  borderColor: '#000000',
  borderWidth: 2,
  hasShadow: true,
  shadowColor: 'rgba(0, 0, 0, 0.8)',
  shadowBlur: 2,
  opacity: 1,
  fontWeight: 'normal',
  alignment: 'center',
  bottomMargin: 6,
  isVideoText: false,
  videoTextFontSize: 48,
  animation: 'fade',
  animationDuration: 0.5,
};

// 字体大小映射
export const FONT_SIZE_MAP: Record<string, string> = {
  small: '16px',
  medium: '24px',
  large: '32px',
  xlarge: '48px',
};

// 视频文字字体大小映射
export const VIDEO_TEXT_FONT_SIZE_MAP: Record<string, string> = {
  small: '24px',
  medium: '36px',
  large: '48px',
  xlarge: '64px',
};

// 字幕颜色选项
export const SUBTITLE_COLOR_OPTIONS = [
  { value: '#FFFFFF', label: '白色', hex: '#FFFFFF' },
  { value: '#FFFF00', label: '黄色', hex: '#FFFF00' },
  { value: '#000000', label: '黑色', hex: '#000000' },
  { value: '#00FFFF', label: '青色', hex: '#00FFFF' },
  { value: '#FF00FF', label: '洋红色', hex: '#FF00FF' },
  { value: '#FF0000', label: '红色', hex: '#FF0000' },
  { value: '#00FF00', label: '绿色', hex: '#00FF00' },
  { value: '#0000FF', label: '蓝色', hex: '#0000FF' },
  { value: '#FFA500', label: '橙色', hex: '#FFA500' },
  { value: '#FFC0CB', label: '粉色', hex: '#FFC0CB' },
];

// 字幕背景颜色选项
export const SUBTITLE_BG_COLOR_OPTIONS = [
  { value: 'rgba(0, 0, 0, 0.5)', label: '半透明黑' },
  { value: 'rgba(0, 0, 0, 0.7)', label: '深色半透明' },
  { value: 'rgba(0, 0, 0, 0.3)', label: '浅色半透明' },
  { value: 'transparent', label: '无背景' },
  { value: 'rgba(255, 255, 255, 0.2)', label: '半透明白' },
];

// 生成唯一ID
export function generateId(): string {
  return `subtitle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 创建默认字幕分段
export function createDefaultSubtitleSegment(text: string = '', duration: number = 10): SubtitleSegment {
  return {
    id: generateId(),
    text,
    startTime: 0,
    endTime: duration,
  };
}

// 创建默认视频文字分段
export function createDefaultVideoTextSegment(duration: number = 10): VideoTextSegment {
  return {
    id: generateId(),
    text: '',
    position: 'middle',
    startTime: 0,
    endTime: duration,
    fontSize: 48,
    fontColor: '#FFFFFF',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backgroundOpacity: 0.6,
    borderColor: '#FFFFFF',
    borderWidth: 0,
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowEnabled: true,
    alignment: 'center',
    customPositionX: 50, // 默认水平居中
    customPositionY: 50, // 默认垂直居中
    animation: 'fade',
    animationDuration: 0.5,
  };
}

// 格式化时间显示
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}

// 解析时间字符串
export function parseTime(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    const ms = parseInt(parts[2], 10) || 0;
    return mins * 60 + secs + ms / 100;
  }
  return 0;
}

// 验证字幕分段
export function validateSubtitleSegments(segments: SubtitleSegment[], totalDuration: number): boolean {
  if (segments.length === 0) return true;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    // 检查时间范围
    if (seg.startTime < 0 || seg.endTime > totalDuration) {
      return false;
    }
    
    // 检查开始时间小于结束时间
    if (seg.startTime >= seg.endTime) {
      return false;
    }
    
    // 检查与其他分段的重叠
    for (let j = i + 1; j < segments.length; j++) {
      const other = segments[j];
      if (!(seg.endTime <= other.startTime || other.endTime <= seg.startTime)) {
        return false;
      }
    }
  }
  
  return true;
}

// ========== 智能定位相关类型和函数 ==========

// 场景类型
export type SceneType = 
  | 'people'       // 人物对话/访谈
  | 'landscape'    // 风景自然
  | 'product'      // 产品展示
  | 'action'       // 动作运动
  | 'text'         // 文字/PPT
  | 'food'         // 美食
  | 'general';     // 通用

// 智能定位结果
export interface SmartPositionResult {
  recommendedPosition: 'top' | 'upper-third' | 'middle' | 'lower-third' | 'bottom';
  sceneType: SceneType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  // 视频文字专用（支持XY坐标）
  suggestedX?: number; // 0-100
  suggestedY?: number; // 0-100
}

// 场景关键词映射
const SCENE_KEYWORDS: Record<SceneType, { keywords: string[]; weight: number }> = {
  people: {
    keywords: ['人', '人物', '对话', '采访', '演讲', '主持人', '演员', '模特', '脸', '面部', '表情', 'portrait', 'person', 'interview', 'talk', 'speak'],
    weight: 1.0,
  },
  landscape: {
    keywords: ['海', '山', '风景', '日落', '日出', '天空', '云', '自然', '森林', '湖泊', 'ocean', 'mountain', 'sunset', 'sunrise', 'sky', 'cloud', 'nature', 'landscape', 'scenery'],
    weight: 0.9,
  },
  product: {
    keywords: ['产品', '商品', '手机', '汽车', '广告', '展示', '物品', 'device', 'phone', 'car', 'product', 'advertisement', 'showcase', 'item'],
    weight: 0.85,
  },
  action: {
    keywords: ['跑步', '跳舞', '运动', '战斗', '追逐', '动作', '跑', '跳', '打', 'run', 'dance', 'sport', 'fight', 'chase', 'action', 'jump'],
    weight: 0.95,
  },
  text: {
    keywords: ['PPT', '文字', '标题', '说明', '教程', '演示', 'slide', 'presentation', 'title', 'tutorial', 'demo', 'text'],
    weight: 0.8,
  },
  food: {
    keywords: ['美食', '食物', '烹饪', '餐厅', '菜', '饭', 'food', 'cooking', 'restaurant', 'dish', 'cuisine', 'meal', 'delicious'],
    weight: 0.85,
  },
  general: {
    keywords: [], // 通用场景无特定关键词
    weight: 0.1,
  },
};

// 场景类型到推荐位置的映射
const POSITION_RECOMMENDATIONS: Record<SceneType, SmartPositionResult> = {
  people: {
    recommendedPosition: 'bottom',
    sceneType: 'people',
    confidence: 'high',
    reason: '人物场景：字幕放置底部，避免遮挡面部表情和眼神交流',
    suggestedX: 50,
    suggestedY: 88,
  },
  landscape: {
    recommendedPosition: 'lower-third',
    sceneType: 'landscape',
    confidence: 'high',
    reason: '风景场景：字幕放置下三分之一处，保留画面美感同时确保可读性',
    suggestedX: 50,
    suggestedY: 75,
  },
  product: {
    recommendedPosition: 'top',
    sceneType: 'product',
    confidence: 'medium',
    reason: '产品展示：字幕放置顶部，避免遮挡产品细节和卖点',
    suggestedX: 50,
    suggestedY: 12,
  },
  action: {
    recommendedPosition: 'top',
    sceneType: 'action',
    confidence: 'high',
    reason: '动作场景：字幕放置顶部，避免遮挡主要动作和运动轨迹',
    suggestedX: 50,
    suggestedY: 10,
  },
  text: {
    recommendedPosition: 'bottom',
    sceneType: 'text',
    confidence: 'high',
    reason: '文字/PPT场景：字幕放置底部，符合阅读习惯，不干扰主要内容',
    suggestedX: 50,
    suggestedY: 90,
  },
  food: {
    recommendedPosition: 'upper-third',
    sceneType: 'food',
    confidence: 'medium',
    reason: '美食场景：字幕放置上三分之一处，避免遮挡食物主体和摆盘',
    suggestedX: 50,
    suggestedY: 28,
  },
  general: {
    recommendedPosition: 'bottom',
    sceneType: 'general',
    confidence: 'low',
    reason: '通用场景：使用默认底部位置，适用于大多数视频内容',
    suggestedX: 50,
    suggestedY: 90,
  },
};

/**
 * 智能定位分析 - 根据提示词内容推荐最佳字幕位置
 * @param prompt 用户的视频描述/提示词
 * @param style 风格标签（可选）
 * @param mood 氛围标签（可选）
 * @returns 智能定位结果
 */
export function analyzeSmartPosition(
  prompt: string,
  style?: string,
  mood?: string
): SmartPositionResult {
  const text = `${prompt} ${style || ''} ${mood || ''}`.toLowerCase();
  
  // 计算每个场景类型的匹配分数
  const scores: Array<{ type: SceneType; score: number }> = [];
  
  for (const [sceneType, config] of Object.entries(SCENE_KEYWORDS)) {
    let score = 0;
    
    for (const keyword of config.keywords) {
      // 完全匹配得分更高
      if (text.includes(keyword)) {
        score += config.weight * (keyword.length > 2 ? 1.5 : 1.0);
      }
      
      // 部分匹配（包含关键词的一部分）
      if (keyword.length > 2 && text.includes(keyword.substring(0, 2))) {
        score += config.weight * 0.3;
      }
    }
    
    scores.push({ type: sceneType as SceneType, score });
  }
  
  // 排序找出最佳匹配
  scores.sort((a, b) => b.score - a.score);
  
  const bestMatch = scores[0];
  
  // 如果没有明显匹配，返回通用配置
  if (!bestMatch || bestMatch.score < 0.3) {
    return {
      ...POSITION_RECOMMENDATIONS.general,
      confidence: 'low',
      reason: '未检测到特定场景类型，使用默认底部位置',
    };
  }
  
  // 获取推荐位置并调整置信度
  const recommendation = POSITION_RECOMMENDATIONS[bestMatch.type];
  
  let confidence: 'high' | 'medium' | 'low';
  if (bestMatch.score >= 2.0) {
    confidence = 'high';
  } else if (bestMatch.score >= 1.0) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return {
    ...recommendation,
    confidence,
    reason: recommendation.reason + ` (匹配度: ${bestMatch.score.toFixed(1)})`,
  };
}

/**
 * 基于图片URL分析画面亮度分布（用于智能定位）
 * 注意：这是一个前端辅助函数，实际分析需要在后端完成
 * @param imageUrl 图片URL
 * @returns 亮度分布信息
 */
export interface ImageBrightnessAnalysis {
  averageBrightness: number; // 0-255
  darkAreaRatio: number; // 暗区占比 0-1
  brightAreaRatio: number; // 亮区占比 0-1
  recommendedTextColor: string; // 推荐的文字颜色
  recommendedBgColor: string; // 推荐的背景颜色
}

/**
 * 分析图片亮度分布（简化版 - 使用Canvas）
 * 在浏览器环境中可用
 */
export async function analyzeImageBrightness(imageUrl: string): Promise<ImageBrightnessAnalysis> {
  // 默认返回值（如果无法分析）
  const defaultResult: ImageBrightnessAnalysis = {
    averageBrightness: 128,
    darkAreaRatio: 0.5,
    brightAreaRatio: 0.5,
    recommendedTextColor: '#FFFFFF',
    recommendedBgColor: 'rgba(0, 0, 0, 0.6)',
  };
  
  // 检查是否在浏览器环境
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return defaultResult;
  }
  
  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve(defaultResult);
            return;
          }
          
          // 缩小图片以提高性能
          const scale = Math.min(1, 100 / Math.max(img.width, img.height));
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          let totalBrightness = 0;
          let darkPixels = 0;
          let brightPixels = 0;
          const pixelCount = data.length / 4;
          
          for (let i = 0; i < data.length; i += 4) {
            // 计算亮度 (使用加权平均)
            const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            totalBrightness += brightness;
            
            if (brightness < 85) darkPixels++;
            else if (brightness > 170) brightPixels++;
          }
          
          const avgBrightness = totalBrightness / pixelCount;
          const darkRatio = darkPixels / pixelCount;
          const brightRatio = brightPixels / pixelCount;
          
          // 根据亮度推荐颜色
          let textColor: string;
          let bgColor: string;
          
          if (avgBrightness > 170) {
            // 亮色图片 - 使用深色文字
            textColor = '#000000';
            bgColor = 'rgba(255, 255, 255, 0.7)';
          } else if (avgBrightness < 85) {
            // 暗色图片 - 使用亮色文字
            textColor = '#FFFFFF';
            bgColor = 'rgba(0, 0, 0, 0.5)';
          } else {
            // 中等亮度 - 使用白色文字+半透明背景
            textColor = '#FFFFFF';
            bgColor = 'rgba(0, 0, 0, 0.6)';
          }
          
          resolve({
            averageBrightness: avgBrightness,
            darkAreaRatio: darkRatio,
            brightAreaRatio: brightRatio,
            recommendedTextColor: textColor,
            recommendedBgColor: bgColor,
          });
        } catch (error) {
          console.error('[SmartPosition] 图片分析失败:', error);
          resolve(defaultResult);
        }
      };
      
      img.onerror = () => {
        console.warn('[SmartPosition] 图片加载失败');
        resolve(defaultResult);
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('[SmartPosition] 分析过程出错:', error);
    return defaultResult;
  }
}

/**
 * 综合智能定位 - 结合语义分析和视觉分析
 */
export async function getComprehensiveSmartPosition(
  prompt: string,
  options?: {
    style?: string;
    mood?: string;
    referenceImageUrl?: string;
  }
): Promise<SmartPositionResult & { brightnessAnalysis?: ImageBrightnessAnalysis }> {
  // 1. 语义分析
  const semanticResult = analyzeSmartPosition(prompt, options?.style, options?.mood);
  
  const result: SmartPositionResult & { brightnessAnalysis?: ImageBrightnessAnalysis } = {
    ...semanticResult,
  };
  
  // 2. 如果有参考图片，进行视觉分析
  if (options?.referenceImageUrl) {
    try {
      const brightnessAnalysis = await analyzeImageBrightness(options.referenceImageUrl);
      result.brightnessAnalysis = brightnessAnalysis;
      
      // 根据亮度调整推荐理由
      if (brightnessAnalysis.averageBrightness > 180) {
        result.reason += ' | 画面偏亮，建议使用深色文字增强可读性';
      } else if (brightnessAnalysis.averageBrightness < 75) {
        result.reason += ' | 画面偏暗，建议使用亮色文字增强可读性';
      }
    } catch (error) {
      console.warn('[SmartPosition] 视觉分析跳过:', error);
    }
  }
  
  return result;
}

// 智能分段配置选项
export interface SplitOptions {
  maxCharsPerSegment?: number;  // 每段最大字数 (默认 22)
  speechRate?: number;          // 语速：字/秒 (默认 4.5)
  minDuration?: number;         // 最短时长秒 (默认 1.0)
  maxDuration?: number;         // 最长时长秒 (默认 8)
  gap?: number;                 // 段间间隙秒 (默认 0.3)
  preferSingleLine?: boolean;   // 优先单行显示 (默认 true)
}

// 智能分段结果（含统计信息）
export interface SplitResult {
  segments: SubtitleSegment[];
  stats: {
    totalSegments: number;
    avgChars: number;
    maxChars: number;
    minChars: number;
    totalDuration: number;
    warnings: string[];
  };
}

// 自动分割字幕（增强版）
export function autoSplitSubtitle(
  text: string,
  duration: number,
  options: SplitOptions | number = {}
): SubtitleSegment[] {
  // 兼容旧签名：autoSplitSubtitle(text, duration, maxChars)
  const opts: SplitOptions = typeof options === 'number'
    ? { maxCharsPerSegment: options }
    : options;

  const {
    maxCharsPerSegment = 22,
    speechRate = 4.5,
    minDuration = 1.0,
    maxDuration = 8,
    gap = 0.3,
    preferSingleLine = true,
  } = opts;

  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!cleanedText) {
    return [createDefaultSubtitleSegment('', duration)];
  }

  // Step 1: 智能断句（多级分割策略）
  const rawSentences = splitIntoSentencesEnhanced(cleanedText);

  // Step 2: 合并/拆分以符合字数限制
  const lines = balanceSegments(rawSentences, maxCharsPerSegment, preferSingleLine);

  if (lines.length === 0) {
    return [createDefaultSubtitleSegment(cleanedText, duration)];
  }

  // Step 3: 基于语速计算每段时长 + 分配时间轴
  const segments = assignTimelinesEnhanced(lines, duration, {
    speechRate, minDuration, maxDuration, gap,
  });

  return segments;
}

// 带统计信息的智能分段（供 UI 展示预览）
export function autoSplitSubtitleWithStats(
  text: string,
  duration: number,
  options: SplitOptions = {}
): SplitResult {
  const segments = autoSplitSubtitle(text, duration, options);

  const charCounts = segments.map(s => s.text.replace(/\s/g, '').length);
  const avgChars = charCounts.length > 0
    ? Math.round(charCounts.reduce((a, b) => a + b, 0) / charCounts.length)
    : 0;

  const warnings: string[] = [];
  if (Math.max(...charCounts, 0) > 30) warnings.push('存在超长字幕段(>30字)，建议拆分');
  if (Math.min(...charCounts, 999) < 4 && charCounts.length > 3) warnings.push('存在过短字幕段(<4字)，可考虑合并');

  return {
    segments,
    stats: {
      totalSegments: segments.length,
      avgChars,
      maxChars: Math.max(...charCounts, 0),
      minChars: Math.min(...charCounts, 999),
      totalDuration: segments.length > 0 ? segments[segments.length - 1].endTime : 0,
      warnings,
    },
  };
}

// ========== 内部工具函数 ==========

/**
 * 增强版断句：多级标点分割
 * - 第一级：句末标点（。！？.!?\n）
 * - 第二级：逗号分号（，,；;\n）用于长句回退
 * - 第三级：空格/停顿词（的/了/是/在 等）用于极端长句
 */
function splitIntoSentencesEnhanced(text: string): string[] {
  // 第一级：按句末标点分割
  let parts = text.split(/([。！？.!?\n])/);
  const sentences: string[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const content = (parts[i] || '').trim();
    const punct = (parts[i + 1] || '').trim();
    if (content) {
      sentences.push(content + punct);
    }
  }

  // 如果只得到一个超长句子，降级用逗号分割
  if (sentences.length <= 1 && text.length > 40) {
    const fallback = text.split(/(?<=[，,；；\n])/).map(s => s.trim()).filter(Boolean);
    if (fallback.length > 1) return fallback;
  }

  // 如果仍然只有一个极长串，按固定长度+边界切割
  if (sentences.length <= 1 && text.length > 60) {
    return splitByBoundary(text, 25);
  }

  return sentences.filter(s => s.trim().length > 0);
}

/**
 * 按自然语言边界切割超长文本
 * 优先在：标点 > 空格 > 常见停顿助词处切断
 */
function splitByBoundary(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 优先级1：句末标点
    let cut = findLastMatch(remaining, /[。！？.!?，,；；]/, maxLength);
    // 优先级2：空格
    if (cut === -1) cut = findLastMatch(remaining, /\s/, maxLength);
    // 优先级3：常见助词（避免在中间切断词语）
    if (cut === -1) cut = findLastMatch(remaining, /(的|了|是|在|和|与|对|把|被|让|给|为|由|从|到|向|往|按|根据|通过|以及|或者|但是|然而|因为|所以|如果|虽然|可以|需要|应该|能够|进行|实现|使用|采用|包括|关于|对于|由于|除了|而且|并且|然后|之后|之前|期间|之中|之上|之下|之内|之外|之间|这里|那里|其中|其他|每个|所有|一些|这个|那个|什么|怎么|如何|为什么|多少|几个|哪些|能否|是否|已经|正在|将要|可能|也许|一定|必须|非常|特别|比较|更加|最|更|不|没|别|勿|莫|请|希望|觉得|认为|知道|了解|明白|理解|记得|忘记|想起|发现|注意|观察|看到|听到|感觉|想到|遇到|碰到|找到|得到|拿到|收到|发出|提出|给出|做出|产生|引起|导致|造成|带来|形成|建立|创建|开发|设计|制作|完成|开始|结束|停止|继续|保持|维持|改变|调整|修改|改进|优化|提升|增加|减少|降低|提高|扩大|缩小|延伸|扩展|深入|加强|减弱|增强|减弱)/, maxLength);
    // 兜底：强制截断
    if (cut === -1) cut = maxLength;

    chunks.push(remaining.substring(0, cut + 1));
    remaining = remaining.substring(cut + 1).trim();
  }

  return chunks;
}

/** 在maxLength内查找最后一个匹配位置 */
function findLastMatch(text: string, regex: RegExp, maxLength: number): number {
  const searchArea = text.substring(0, maxLength);
  const match = searchArea.match(regex);
  if (!match) return -1;
  // 找最后一个匹配
  let lastIdx = -1;
  let re = new RegExp(regex.source, regex.flags.replace('g', '') + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(searchArea)) !== null) {
    lastIdx = m.index + (m[0]?.length ?? 1) - 1;
  }
  return lastIdx >= 0 ? lastIdx : -1;
}

/**
 * 平衡分段：合并过短、拆分过长
 */
function balanceSegments(sentences: string[], maxChars: number, preferSingle: boolean): string[] {
  const result: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // 单行模式：优先保持单行
    if (preferSingle) {
      if (trimmed.length <= maxChars) {
        if (buffer) result.push(buffer);
        result.push(trimmed);
        buffer = '';
      } else if (buffer.length + trimmed.length + 1 <= maxChars * 2) {
        // 合并为双行
        buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
      } else {
        if (buffer) result.push(buffer);
        // 超长句子二次拆分
        const subParts = splitByBoundary(trimmed, maxChars);
        result.push(...subParts.slice(0, 3));
        buffer = subParts.length > 3 ? subParts.slice(3).join('') : '';
      }
    } else {
      // 双行优先模式
      if (buffer.length + trimmed.length + 1 <= maxChars * 2) {
        buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
      } else {
        if (buffer) result.push(buffer);
        buffer = trimmed;
      }
    }
  }

  if (buffer) result.push(buffer);
  return result.filter(s => s.length > 0);
}

/**
 * 增强版时间轴分配：基于语速计算时长
 */
function assignTimelinesEnhanced(
  texts: string[],
  totalDuration: number,
  opts: {
    speechRate: number;
    minDuration: number;
    maxDuration: number;
    gap: number;
  }
): SubtitleSegment[] {
  const { speechRate, minDuration, maxDuration, gap } = opts;
  const segments: SubtitleSegment[] = [];

  // 计算每段的"自然时长"
  const naturalDurations = texts.map(t => {
    const charCount = t.replace(/\s/g, '').length;
    return Math.min(maxDuration, Math.max(minDuration, charCount / speechRate));
  });

  const totalNatural = naturalDurations.reduce((a, b) => a + b, 0) + gap * (texts.length - 1);
  const scaleRatio = totalNatural > 0 ? Math.min(1, totalDuration / totalNatural) : 1;

  let currentTime = 0;

  for (let i = 0; i < texts.length; i++) {
    if (currentTime >= totalDuration) break;

    const scaledDuration = naturalDurations[i] * scaleRatio;
    const endTime = Math.min(currentTime + scaledDuration, totalDuration);

    segments.push({
      id: generateId(),
      text: texts[i],
      startTime: parseFloat(currentTime.toFixed(3)),
      endTime: parseFloat(endTime.toFixed(3)),
    });

    currentTime = endTime + gap;
  }

  // 确保最后一段不超出总时长
  if (segments.length > 0 && segments[segments.length - 1].endTime > totalDuration) {
    segments[segments.length - 1].endTime = parseFloat(totalDuration.toFixed(3));
  }

  return segments;
}

// 获取字幕样式CSS
export function getSubtitleStyleCSS(style: SubtitleStyle): React.CSSProperties {
  const fontSize = FONT_SIZE_MAP[style.fontSize] || FONT_SIZE_MAP.medium;
  
  const css: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize,
    color: style.color,
    fontWeight: style.fontWeight,
    opacity: style.opacity,
    textAlign: 'center',
    maxWidth: '80%',
    padding: '8px 16px',
    borderRadius: '4px',
    zIndex: 10,
  };
  
  // 位置
  switch (style.position) {
    case 'top':
      css.top = '10%';
      break;
    case 'middle':
      css.top = '50%';
      css.transform = 'translate(-50%, -50%)';
      break;
    case 'bottom':
    default:
      css.bottom = '10%';
      break;
  }
  
  // 背景色
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    css.backgroundColor = style.backgroundColor;
  }
  
  // 边框
  if (style.hasBorder && style.borderColor) {
    css.border = `2px solid ${style.borderColor}`;
  }
  
  // 阴影
  if (style.hasShadow && style.shadowColor) {
    css.textShadow = `2px 2px 4px ${style.shadowColor}`;
  }
  
  return css;
}

// ============================================================
// ========== 新增：字体族选项 ==========
// ============================================================
export const FONT_FAMILY_OPTIONS = [
  { value: 'Microsoft YaHei, "微软雅黑", sans-serif', label: '微软雅黑', category: '中文' },
  { value: '"PingFang SC", "苹方", sans-serif', label: '苹方', category: '中文' },
  { value: '"Source Han Sans CN", "思源黑体", sans-serif', label: '思源黑体', category: '中文' },
  { value: '"Noto Sans CJK SC", sans-serif', label: 'Noto Sans SC', category: '中文' },
  { value: '"SimHei", "黑体", sans-serif', label: '黑体', category: '中文' },
  { value: '"SimSun", "宋体", serif', label: '宋体', category: '中文' },
  { value: '"KaiTi", "楷体", serif', label: '楷体', category: '中文' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', category: '西文' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica Neue', category: '西文' },
  { value: 'Georgia, serif', label: 'Georgia', category: '西文' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', category: '西文' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana', category: '西文' },
  { value: 'system-ui, -apple-system, sans-serif', label: '系统默认', category: '系统' },
];

// 精确字号映射 (px)
export const FONT_SIZE_OPTIONS = [
  { value: 20, label: '20号 (小)', category: '短视频' },
  { value: 24, label: '24号', category: '标准' },
  { value: 28, label: '28号 (中)', category: '标准' },
  { value: 32, label: '32号', category: '标准' },
  { value: 36, label: '36号 (大)', category: '标准' },
  { value: 42, label: '42号', category: '大屏' },
  { value: 48, label: '48号 (特大)', category: '短视频/抖音' },
  { value: 56, label: '56号', category: '大屏' },
  { value: 64, label: '64号 (超大)', category: '特殊' },
];

// 字号预设映射
export const FONT_SIZE_PRESET_MAP: Record<string, number> = {
  small: 20,
  medium: 28,
  large: 36,
  xlarge: 48,
};

// 描边宽度选项
export const STROKE_WIDTH_OPTIONS = [0, 1, 1.5, 2, 2.5, 3, 4];

// 语言选项
export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '普通话 (简体)' },
  { value: 'zh-TW', label: '繁體中文 (台灣)' },
  { value: 'zh-HK', label: '粵語 (香港)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
];

// 默认语气词列表
export const DEFAULT_FILLER_WORDS = [
  '嗯', '啊', '呃', '额', '哦',
  '那个', '就是说', '然后呢', '对吧', '你知道',
  '就是', '这个', '那个', '的话', '其实',
  'basically', 'actually', 'like', 'you know', 'um', 'uh',
  'so yeah', 'I mean', 'right', 'okay so',
];