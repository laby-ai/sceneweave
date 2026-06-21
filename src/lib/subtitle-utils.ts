/**
 * 字幕工具函数集合
 * 
 * 包含：
 * - SRT/ASS 格式解析与导出
 * - QClaw 兼容的提示词解析引擎
 * - 校对与优化工具
 * - 智能断句与时间轴分配
 */

// ============================================================
// ========== SRT 解析器 ==========
// ============================================================

export interface SubtitleSegment {
  id: string;
  text: string;
  startTime: number; // 秒
  endTime: number; // 秒
}

export interface SRTExportOptions {
  encoding?: 'utf-8' | 'utf-8-bom' | 'gbk';
  lineEnding?: '\n' | '\r\n';
  includeBOM?: boolean;
}

/**
 * 解析 SRT 格式字幕文件
 * 支持标准格式:
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * 第一行字幕内容
 */
export function parseSRT(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  
  // 标准化换行符
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // 按空行分割字幕块
  const blocks = normalizedContent.trim().split(/\n\n+/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // 第1行：序号（可选验证）
    const indexLine = lines[0].trim();
    if (!/^\d+$/.test(indexLine)) continue;
    
    // 第2行：时间轴
    const timeLine = lines[1].trim();
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!timeMatch) continue;
    
    const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
    const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
    
    // 剩余行：字幕文本
    const textLines = lines.slice(2).map(line => line.trim()).filter(line => line.length > 0);
    if (textLines.length === 0) continue;
    
    segments.push({
      id: `srt-${indexLine}`,
      text: textLines.join('\n'),
      startTime,
      endTime,
    });
  }
  
  return segments;
}

/**
 * 导出为 SRT 格式
 */
export function exportToSRT(
  segments: SubtitleSegment[],
  options: SRTExportOptions = {}
): string {
  const { lineEnding = '\r\n' } = options;
  
  let srt = '';
  
  segments.forEach((segment, index) => {
    srt += `${index + 1}${lineEnding}`;
    srt += `${formatSRTTime(segment.startTime)} --> ${formatSRTTime(segment.endTime)}${lineEnding}`;
    srt += `${segment.text}${lineEnding}`;
    srt += lineEnding; // 空行分隔
  });
  
  return srt.trim();
}

/**
 * 格式化时间为 SRT 格式
 */
function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// ============================================================
// ========== ASS 解析器与导出 ==========
// ============================================================

/**
 * 解析 ASS 格式字幕文件（简化版，主要提取事件）
 */
export function parseASS(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const lines = content.split('\n');
  let inEvents = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('[Events]')) {
      inEvents = true;
      continue;
    }
    
    if (trimmed.startsWith('[') && inEvents) {
      break; // 进入下一个section
    }
    
    if (inEvents && trimmed.startsWith('Dialogue:')) {
      // 解析 Dialogue 行
      // Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      const match = trimmed.match(/^Dialogue:\s*[^,]*,([^,]*),([^,]*),[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,(.*)$/);
      if (match) {
        const startTime = parseASSTime(match[1]);
        const endTime = parseASSTime(match[2]);
        const text = match[3].replace(/\\N/g, '\n').replace(/\\n/g, '\n');
        
        segments.push({
          id: `ass-${segments.length}`,
          text,
          startTime,
          endTime,
        });
      }
    }
  }
  
  return segments;
}

/**
 * 导出为 ASS 格式
 */
export interface SubtitleStyleAdvanced {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  strokeWidth?: number;
  strokeColor?: string;
  backgroundColor?: string;
  position?: string;
  alignment?: string;
  bottomMargin?: number;
}

export function exportToASS(
  segments: SubtitleSegment[],
  style?: Partial<SubtitleStyleAdvanced>,
  styleName: string = 'Default'
): string {
  const assStyle = createASSStyle(styleName, style);
  
  let ass = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${assStyle}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const segment of segments) {
    const start = formatASSTime(segment.startTime);
    const end = formatASSTime(segment.endTime);
    const text = segment.text.replace(/\n/g, '\\N');
    ass += `Dialogue: 0,${start},${end},${styleName},,0000,0000,0000,,${text}\n`;
  }
  
  return ass;
}

/**
 * 创建 ASS 样式定义
 */
function createASSStyle(name: string, style?: Partial<SubtitleStyleAdvanced>): string {
  const fontFamily = style?.fontFamily || 'Microsoft YaHei';
  const fontSize = style?.fontSize || 28;
  const color = style?.color || '#FFFFFF';
  const strokeColor = style?.strokeColor || '#000000';
  const strokeWidth = style?.strokeWidth || 2;
  const bgColor = style?.backgroundColor || '&H80000000';
  
  // 转换颜色为 ASS 格式 (&HBBGGRR&)
  const primaryColor = hexToASSColor(color);
  const outlineColor = hexToASSColor(strokeColor);
  
  return `Format: ${name},${fontFamily},${fontSize},${primaryColor},&H00FFFFFF,${outlineColor},${bgColor},0,0,0,0,100,100,0,0,1,${strokeWidth},1,2,10,10,10,1`;
}

/**
 * 十六进制颜色转 ASS 颜色格式
 */
function hexToASSColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return '&H00FFFFFF';
  const r = cleanHex.substring(4, 6);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(0, 2);
  return `&H00${r}${g}${b}`;
}

/**
 * 解析 ASS 时间格式
 */
function parseASSTime(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

/**
 * 格式化为 ASS 时间格式
 */
function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

// ============================================================
// ========== 提示词解析引擎 (QClaw兼容) ==========
// ============================================================

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
  parseConfidence: number;
  warnings: string[];
}

export const FONT_FAMILY_OPTIONS = [
  { value: 'Microsoft YaHei, "微软雅黑", sans-serif', label: '微软雅黑', category: '中文' },
  { value: '"PingFang SC", "苹方", sans-serif', label: '苹方', category: '中文' },
  { value: '"Source Han Sans CN", "思源黑体", sans-serif', label: '思源黑体', category: '中文' },
  { value: '"SimHei", "黑体", sans-serif', label: '黑体', category: '中文' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', category: '西文' },
];

export const DEFAULT_FILLER_WORDS = [
  '嗯', '啊', '呃', '额', '哦',
  '那个', '就是说', '然后呢', '对吧', '你知道',
  '就是', '这个', '那个', '的话', '其实',
  'basically', 'actually', 'like', 'you know', 'um', 'uh',
];

/**
 * 解析 QClaw 风格的字幕提示词
 * 
 * 示例输入:
 * "生成视频字幕：文件路径"D:\视频\demo.mp4"；语言=普通话；断句=单行≤18字、双行≤32字；时长≥0.8秒/条；格式=SRT+硬字幕；样式=白字#FFFFFF+黑描边2px、底部居中、下距6%；校对错别字、对齐音画误差≤0.2秒；输出到同目录。"
 */
export function parseSubtitlePrompt(prompt: string): ParsedSubtitlePrompt {
  const warnings: string[] = [];
  let confidence = 1.0;
  
  // 初始化默认值
  const result: ParsedSubtitlePrompt = {
    action: 'generate',
    source: {},
    language: 'zh-CN',
    constraints: {
      maxCharsPerLine: 18,
      maxCharsDoubleLine: 32,
      minDurationPerSegment: 0.8,
      format: 'hard',
      singleLineMode: false,
    },
    style: {
      fontSize: 28,
      strokeWidth: 2,
      strokeColor: '#000000',
      fontFamily: 'Microsoft YaHei, "微软雅黑", sans-serif',
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      position: 'bottom',
      alignment: 'center',
      bottomMargin: 6,
    },
    postProcess: {
      proofread: false,
      alignAV: false,
      removeFillerWords: false,
      boldKeywords: false,
      normalizePunctuation: false,
      fillerWordList: [...DEFAULT_FILLER_WORDS],
    },
    speakerDetection: false,
    output: { format: 'hard' },
    rawPrompt: prompt,
    parseConfidence: 1.0,
    warnings: [],
  };
  
  // ===== 1. 识别动作类型 =====
  if (/^(生成|识别|提取|自动)/.test(prompt)) {
    result.action = 'generate';
  } else if (/^(添加|嵌入|加入|加)/.test(prompt)) {
    result.action = 'add';
  } else if (/^(导入|粘贴|写入|嵌入)/.test(prompt)) {
    result.action = 'embed';
  } else if (/^(校对|修正|规范|优化|检查)/.test(prompt)) {
    result.action = 'proofread';
  } else if (/^(批量|目录|全部)/.test(prompt)) {
    result.action = 'batch';
  } else {
    warnings.push('未识别动作类型，默认使用"生成"');
    confidence -= 0.05;
  }
  
  // ===== 2. 提取路径/文件名 =====
  const pathPatterns = [
    /(?:文件|视频|路径)\s*[:：]?\s*["""]([^"""]+\.(?:mp4|avi|mov|mkv|flv|webm))["""]/gi,
    /["""]([^"""]+\.(?:mp4|avi|mov|mkv|flv|webm))["""]/g,
  ];
  
  for (const pattern of pathPatterns) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      result.source.videoPath = match[1];
      break;
    }
  }
  
  // 文本文件路径
  const textFilePattern = /(?:文本|文案|文件|txt)\s*[:：]?\s*["""]([^"""]+\.(?:txt|docx|doc|srt|ass))["""]/gi;
  const textFileMatch = prompt.match(textFilePattern);
  if (textFileMatch) {
    result.source.textFilePath = textFileMatch[1];
  }
  
  // 直接粘贴的文案内容
  const directTextPattern = /(?:文案|内容|文本)\s*[:：]?\s*[「""]([\s\S]{10,})[」""]/gi;
  const directTextMatch = prompt.match(directTextPattern);
  if (directTextMatch) {
    result.source.textContent = directTextMatch[1].trim();
  }
  
  // ===== 3. 提取语言 =====
  const langMap: Record<string, string> = {
    '普通话': 'zh-CN', '中文': 'zh-CN', '简体': 'zh-CN',
    '繁体': 'zh-TW', '粤语': 'zh-HK', '广东话': 'zh-HK',
    '英语': 'en-US', '英文': 'en-US', 'english': 'en-US',
    '日语': 'ja-JP', '日文': 'ja-JP', '日本語': 'ja-JP',
    '韩语': 'ko-KR', '韩文': 'ko-KR', '한국어': 'ko-KR',
  };
  
  for (const [key, value] of Object.entries(langMap)) {
    if (prompt.includes(key)) {
      result.language = value;
      break;
    }
  }
  
  // ===== 4. 提取断句规则 =====
  const singleCharMatch = prompt.match(/单行\s*[≤<=]\s*(\d+)\s*字?/);
  if (singleCharMatch) {
    result.constraints.maxCharsPerLine = parseInt(singleCharMatch[1]);
  }
  
  const doubleCharMatch = prompt.match(/双行\s*[≤<=]\s*(\d+)\s*字?/);
  if (doubleCharMatch) {
    result.constraints.maxCharsDoubleLine = parseInt(doubleCharMatch[1]);
  }
  
  const durationMatch = prompt.match(/时长\s*[>=]\s*(\d+\.?\d*)\s*秒?[\/\/条]?/);
  if (durationMatch) {
    result.constraints.minDurationPerSegment = parseFloat(durationMatch[1]);
  }
  
  if (/短句|单行模式|单行显示/.test(prompt)) {
    result.constraints.singleLineMode = true;
  }
  
  // ===== 5. 提取格式 =====
  if (/SRT/.test(prompt)) {
    result.constraints.format = 'srt';
    result.output.format = 'srt';
  }
  if (/ASS/.test(prompt)) {
    result.constraints.format = 'ass';
    result.output.format = 'ass';
  }
  if (/硬字幕|烧录|burn.?in|hard.?sub/i.test(prompt)) {
    result.constraints.format = 'hard';
    result.output.format = 'hard';
  }
  if (/软字幕|soft.?sub/i.test(prompt)) {
    result.constraints.format = 'soft';
    result.output.format = 'soft';
  }
  
  // ===== 6. 提取样式配置 =====
  for (const font of FONT_FAMILY_OPTIONS) {
    if (prompt.includes(font.label) || prompt.includes(font.value.split(',')[0])) {
      result.style.fontFamily = font.value;
      break;
    }
  }
  
  const fontSizeMatch = prompt.match(/(\d+)\s*(?:号|px|像素)/);
  if (fontSizeMatch) {
    result.style.fontSize = parseInt(fontSizeMatch[1]);
  }
  
  const colorMatch = prompt.match(/(?:白字|字体)?#([0-9A-Fa-f]{6})/);
  if (colorMatch) {
    result.style.color = `#${colorMatch[1]}`;
  } else if (/白字/.test(prompt)) {
    result.style.color = '#FFFFFF';
  } else if (/黄字/.test(prompt)) {
    result.style.color = '#FFFF00';
  }
  
  const strokeMatch = prompt.match(/(?:描边|边框|border)\s*(\d+)px?/);
  if (strokeMatch) {
    result.style.strokeWidth = parseInt(strokeMatch[1]);
  }
  if (/黑描边|黑边|深色描边/.test(prompt)) {
    result.style.strokeColor = '#000000';
  }
  
  if (/底部|bottom|下/.test(prompt)) {
    result.style.position = 'bottom';
  } else if (/顶部|top|上/.test(prompt)) {
    result.style.position = 'top';
  } else if (/居中|中间|middle|center/.test(prompt)) {
    result.style.position = 'middle';
  }
  
  const marginMatch = prompt.match(/下距\s*(\d+)%?/);
  if (marginMatch) {
    result.style.bottomMargin = parseInt(marginMatch[1]);
  }
  
  if (/左对齐|left/.test(prompt)) {
    result.style.alignment = 'left';
  } else if (/右对齐|right/.test(prompt)) {
    result.style.alignment = 'right';
  } else if (/居中|center/.test(prompt)) {
    result.style.alignment = 'center';
  }
  
  // ===== 7. 提取后处理选项 =====
  if (/校对|修正.*错|proofread/i.test(prompt)) {
    result.postProcess.proofread = true;
  }
  if (/音画.*对齐|align|同步/i.test(prompt)) {
    result.postProcess.alignAV = true;
  }
  if (/删除.*语气词|去除.*嗯|remove.*filler/i.test(prompt)) {
    result.postProcess.removeFillerWords = true;
  }
  if (/关键词.*加粗|bold.*keyword/i.test(prompt)) {
    result.postProcess.boldKeywords = true;
  }
  if (/标点.*规范|normalize.*punct/i.test(prompt)) {
    result.postProcess.normalizePunctuation = true;
  }
  
  // ===== 8. 说话人检测 =====
  if (/说话人|多角色|分角色|访谈|speaker|A\/B/i.test(prompt)) {
    result.speakerDetection = true;
  }
  
  // ===== 9. 输出路径 =====
  if (/同目录|同文件夹|same.*dir/i.test(prompt)) {
    result.output.sameDirectory = true;
  }
  
  // 计算最终置信度
  result.parseConfidence = Math.max(0.3, confidence - warnings.length * 0.05);
  result.warnings = warnings;
  
  return result;
}

// ============================================================
// ========== 校对工具函数 ==========
// ============================================================

/**
 * 校对字幕文本（基础版）
 * - 修正常见错别字
 * - 规范标点符号
 * - 删除语气词
 */
export function proofreadSubtitle(
  text: string,
  options: {
    removeFillers?: boolean;
    fillerWords?: string[];
    normalizePunctuation?: boolean;
  } = {}
): string {
  let result = text;
  
  // 1. 删除语气词
  if (options.removeFillers) {
    const fillers = options.fillerWords || DEFAULT_FILLER_WORDS;
    for (const filler of fillers) {
      const regex = new RegExp(`\\s*${filler}\\s*`, 'g');
      result = result.replace(regex, ' ');
    }
    result = result.replace(/\s+/g, ' ').trim();
  }
  
  // 2. 规范标点符号
  if (options.normalizePunctuation !== false) {
    result = normalizePunctuation(result);
  }
  
  return result;
}

/**
 * 规范标点符号
 */
export function normalizePunctuation(text: string): string {
  let result = text;
  
  const punctuationMap: Record<string, string> = {
    ',': '，',
    '.': '。',
    '!': '！',
    '?': '？',
    ':': '：',
    ';': '；',
    '(': '（',
    ')': '）',
  };
  
  for (const [eng, cn] of Object.entries(punctuationMap)) {
    result = result.replace(new RegExp(`\\${eng}`, 'g'), cn);
  }
  
  result = result.replace(/\s+/g, ' ').trim();
  result = result.replace(/^[，。！？；：、\s]+/, '').replace(/[，。！？；：、\s]+$/, '');
  
  return result;
}

// ============================================================
// ========== 智能断句与时间轴分配 ==========
// ============================================================

/**
 * 智能断句
 */
export function smartSplitText(
  text: string,
  options: {
    maxCharsPerLine?: number;
    maxCharsDoubleLine?: number;
    preferSingleLine?: boolean;
  } = {}
): string[] {
  const maxSingle = options.maxCharsPerLine || 18;
  const maxDouble = options.maxCharsDoubleLine || 32;
  const preferSingle = options.preferSingleLine || false;
  
  const sentences = splitIntoSentences(text);
  const lines: string[] = [];
  
  let currentLine = '';
  
  for (const sentence of sentences) {
    if (preferSingle) {
      if (sentence.length <= maxSingle) {
        if (currentLine) lines.push(currentLine);
        lines.push(sentence);
        currentLine = '';
      } else if (currentLine.length + sentence.length + 1 <= maxDouble) {
        currentLine = currentLine ? `${currentLine} ${sentence}` : sentence;
      } else {
        if (currentLine) lines.push(currentLine);
        const chunks = splitLongText(sentence, maxSingle);
        lines.push(...chunks.slice(0, 2));
        currentLine = chunks.length > 2 ? chunks[2] : '';
      }
    } else {
      if (currentLine.length + sentence.length + 1 <= maxDouble) {
        currentLine = currentLine ? `${currentLine} ${sentence}` : sentence;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = sentence;
      }
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  return lines.filter(line => line.length > 0);
}

/**
 * 将文本按句子分割
 */
function splitIntoSentences(text: string): string[] {
  const sentenceEnders = /[。！？.!?\n]+/;
  const sentences = text.split(sentenceEnders).filter(s => s.trim().length > 0);
  
  if (sentences.length <= 1 && text.length > 36) {
    return text.split(/[,，;；]+/).filter(s => s.trim().length > 0);
  }
  
  return sentences.map(s => s.trim());
}

/**
 * 拆分超长文本
 */
function splitLongText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    let breakPoint = remaining.lastIndexOf('，', maxLength);
    if (breakPoint === -1) breakPoint = remaining.lastIndexOf('、', maxLength);
    if (breakPoint === -1) breakPoint = remaining.lastIndexOf(' ', maxLength);
    if (breakPoint === -1) breakPoint = maxLength;
    
    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }
  
  return chunks;
}

/**
 * 根据文本长度和语速计算时长
 */
export function calculateDuration(
  text: string,
  speechRate: number = 4,
  minDuration: number = 0.8,
  maxDuration: number = 10
): number {
  const charCount = text.replace(/\s/g, '').length;
  const duration = charCount / speechRate;
  return Math.min(maxDuration, Math.max(minDuration, duration));
}

/**
 * 为字幕分段分配时间轴
 */
export function assignTimelines(
  texts: string[],
  totalDuration: number,
  options: {
    minDuration?: number;
    gap?: number;
    speechRate?: number;
  } = {}
): SubtitleSegment[] {
  const minDur = options.minDuration || 0.8;
  const gap = options.gap || 0.2;
  const rate = options.speechRate || 4;
  
  const segments: SubtitleSegment[] = [];
  let currentTime = 0;
  
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const duration = calculateDuration(text, rate, minDur);
    
    if (currentTime >= totalDuration) break;
    
    const endTime = Math.min(currentTime + duration, totalDuration);
    
    segments.push({
      id: `segment-${i}`,
      text,
      startTime: currentTime,
      endTime,
    });
    
    currentTime = endTime + gap;
  }
  
  return segments;
}
