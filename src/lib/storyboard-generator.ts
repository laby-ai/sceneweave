/**
 * 智能分镜生成器 v2.0
 * 
 * 根据字幕文本内容自动规划分镜，每个分镜的画面描述与对应字幕内容紧密关联。
 * 
 * v2.0 优化项：
 * - 场景×情感 72组合差异化视觉描述矩阵
 * - 镜头数量动态适配策略（1/2/3/4+/6+）
 * - 对齐 video-prompt-guide 最佳实践（主体定义/时序动作/景运组合/光影具象/画质必加）
 * - 用户输入结构化实体提取与深度注入
 * - 相邻镜头风格连续性保证（StyleContext）
 * - MiniMax Hailuo-02 模型特性对齐（中英双语/时长自适应/物理约束）
 * 
 * 核心能力：
 * - 场景关键词识别（室内/室外/自然/城市/抽象等8类）
 * - 情感色彩分析（欢快/忧伤/紧张/平静/温馨等9类）
 * - 动作提取与视觉化转换（12种动作模式）
 * - 时间氛围推断（晨/午/暮/夜/四季）
 * - 镜头语言智能匹配（动态策略：按镜头数量自适应）
 * - 分镜间风格连贯性保证
 */

// ============================================================
// 类型定义
// ============================================================

/** 字幕段落输入 */
export interface SubtitleSegmentInput {
  id: string;
  text: string;
  startTime: number; // 秒
  endTime: number;   // 秒
}

/** 生成的分镜镜头 */
export interface GeneratedShot {
  id: string;
  index: number;
  prompt: string;        // 画面提示词（用于视频生成）
  duration: number;      // 秒
  sourceText: string;    // 来源字幕文本
  sceneType: SceneType;  // 识别的场景类型
  emotion: EmotionType;  // 识别的情感类型
  cameraSuggestion: string; // 建议的镜头运用
  lighting: string;      // 光线建议
}

/** 完整的分镜生成结果 */
export interface StoryboardGenerationResult {
  shots: GeneratedShot[];
  totalDuration: number;
  summary: GenerationSummary;
  warnings: string[];
}

/** 生成摘要 */
export interface GenerationSummary {
  totalSegments: number;
  totalShots: number;
  mergedSegments: number;  // 因时长过短而合并的段数
  splitSegments: number;   // 因时长过长而拆分的段数
  dominantScene: string;
  dominantEmotion: string;
}

/** 风格上下文 — 保证相邻镜头间的视觉连续性 */
export interface StyleContext {
  subjectAppearance: string;   // 主体外观锁定（全程不变）
  lightingDirection: string;   // 光线方向锁定
  colorPalette: string;        // 主色调锁定
  timeOfDay: string;           // 时间锁定（允许渐变）
  weather: string;             // 天气锁定
  keyProps: string;            // 关键道具/服装
}

/** 用户输入结构化实体 */
export interface UserInputEntities {
  subject: string;        // 主体描述
  location: string;       // 地点展开
  timeOfDay: string;      // 时间
  action: string;         // 动作展开
  emotion: string;        // 情感
  objects: string[];      // 关键物体
  atmosphere: string;     // 氛围
}

/** 镜头策略配置 */
interface ShotStrategy {
  positionLabel: string;       // 位置标签
  sceneScope: string;          // 景别范围
  cameraMovement: string;      // 运镜方式
  focusPoint: string;          // 聚焦点
  transitionHint: string;      // 转场提示
}

// ============================================================
// 枚举与常量
// ============================================================

import { sanitizePromptForMiniMax } from './storyboard/prompt-sensitivity';
import { buildCoreVisualPrompt, initStyleContext } from './storyboard/subtitle-core-visual-prompt';
import {
  EMOTION_KEYWORDS,
  MAX_SHOT_DURATION,
  MIN_SHOT_DURATION,
  SCENE_EMOTION_MATRIX,
  SCENE_KEYWORDS,
} from './storyboard/scene-emotion-data';
import type { EmotionType, SceneType } from './storyboard/scene-emotion-data';
export type { EmotionType, SceneType } from './storyboard/scene-emotion-data';

const ACTION_VISUAL_MAP: Array<{ patterns: RegExp[]; visualAction: string; cameraHint: string }> = [
  {
    patterns: [/走|行|步|移动|前进|前往|走向|来到|到达|穿过|走过|漫步|散步|踱/],
    visualAction: '行走或移动中',
    cameraHint: '跟随镜头（跟拍），保持中景',
  },
  {
    patterns: [/跑|奔|冲|追赶|逃离|冲刺|飞奔|疾驰|竞速/],
    visualAction: '奔跑或快速移动',
    cameraHint: '侧面跟随或正面迎拍，动感模糊效果',
  },
  {
    patterns: [/坐|座|躺|卧|靠|倚|休息|停|驻足|停留|伫立/],
    visualAction: '静止或坐卧姿态',
    cameraHint: '固定机位，缓慢推近或静止构图',
  },
  {
    patterns: [/说|讲|谈|对话|聊天|交流|告诉|询问|回答|解释|描述|表达|陈述/],
    visualAction: '说话或交谈中',
    cameraHint: '中近景或过肩镜头，捕捉表情细节',
  },
  {
    patterns: [/看|望|注视|凝视|观察|眺望|俯瞰|仰视|回顾/],
    visualAction: '观看或凝视远方',
    cameraHint: '主观视角或过肩镜头，引导视线方向',
  },
  {
    patterns: [/笑|微笑|大笑|欢乐|开心|高兴/],
    visualAction: '面带笑容，神情愉悦',
    cameraHint: '特写面部表情，柔和正面光',
  },
  {
    patterns: [/哭|泪|悲伤|难过|伤心|失落/],
    visualAction: '情绪低落或流泪',
    cameraHint: '侧面或背面剪影，避免过度暴露情绪',
  },
  {
    patterns: [/想|思考|沉思|思索|回忆|怀念|想象|憧憬/],
    visualAction: '陷入思考或回忆',
    cameraHint: '虚焦前景+清晰主体，营造内心独白感',
  },
  {
    patterns: [/开始|启动|开启|出发|起航|启程|第一步/],
    visualAction: '准备开始或刚刚起步',
    cameraHint: '广角建立镜头，展示环境和人物关系',
  },
  {
    patterns: [/结束|完成|达成|收官|落幕|最后|终|完毕/],
    visualAction: '完成动作或收尾阶段',
    cameraHint: '远景或逐渐拉远，象征结束和余韵',
  },
  {
    patterns: [/变化|改变|转变|变成|演化|升级|蜕变/],
    visualAction: '正在发生变化或转变',
    cameraHint: '延时摄影或变形过渡效果',
  },
  {
    patterns: [/展示|呈现|显示|表现|体现|出现|浮现/],
    visualAction: '展示某物或揭示信息',
    cameraHint: '推近镜头聚焦于被展示对象',
  },
];

// ============================================================
// 时间氛围关键词
// ============================================================

const TIME_ATMOSPHERE: Record<string, { label: string; lighting: string; mood: string }> = {
  '早晨': { label: '清晨', lighting: '薄雾漫射的金色晨光', mood: '清新充满希望' },
  '早上': { label: '上午', lighting: '明亮的自然日光', mood: '活力充沛' },
  '中午': { label: '正午', lighting: '强烈的顶光', mood: '热烈直接' },
  '下午': { label: '午后', lighting: '柔和的斜射阳光', mood: '温暖慵懒' },
  '傍晚': { label: '黄昏', lighting: '温暖的橘红色夕阳', mood: '宁静浪漫' },
  '晚上': { label: '夜晚', lighting: '人造光源为主的环境光', mood: '神秘静谧' },
  '深夜': { label: '深夜', lighting: '稀疏的点状光源', mood: '孤独深沉' },
  '春': { label: '春天', lighting: '清新的嫩绿色调光线', mood: '生机勃勃' },
  '夏': { label: '夏天', lighting: '强烈明亮的直射光', mood: '热情活力' },
  '秋': { label: '秋天', lighting: '温暖的金黄色调光线', mood: '成熟收获' },
  '冬': { label: '冬天', lighting: '冷调的灰白色漫射光', mood: '沉静内敛' },
};

// ============================================================
// 方案B: 镜头数量动态适配策略（替代固定3档模板）
// 根据实际镜头数量选择不同的编排策略
// ============================================================

/**
 * 获取镜头编排策略 — 根据总镜头数动态适配
 * 
 * | 镜头数 | 策略 | 说明 |
 * |--------|------|------|
 * | 1      | 单镜完整叙事 | 全景→中景推近，一个镜头内完成空间建立+主体展示 |
 * | 2      | 起-合二元结构 | L1: 广角建立 → L2: 特写定格 |
 * | 3      | 起-承-合三幕式 | L1: 环境 → L2: 主体+动作 → L3: 收尾 |
 * | 4-5    | 标准5阶段精简 | 开场→展开(合并)→细节→转折(可选)→收尾 |
 * | 6+     | 多段落分组    | 每2-3段为一组，组内微叙事 |
 */
function getShotStrategy(totalShots: number, currentIndex: number): ShotStrategy {
  if (totalShots === 1) {
    // 单镜头：完整叙事——广角环境建立 + 推近至主体 + 定格
    return {
      positionLabel: '【完整叙事镜头】',
      sceneScope: '广角全景到中景的过渡构图',
      cameraMovement: '缓慢推近运镜，从环境起始逐渐聚焦至主体',
      focusPoint: '先展现场景全貌再聚焦主体动作，最终停在关键姿态或表情',
      transitionHint: '一镜到底完成完整叙述',
    };
  }

  if (totalShots === 2) {
    // 二元结构：起 + 合
    if (currentIndex === 0) {
      return {
        positionLabel: '【开场建立】',
        sceneScope: '广角建立镜头，展示环境和主体入场',
        cameraMovement: '缓慢推近或静止广角构图，让主体从画面边缘走入中心',
        focusPoint: '空间层次和环境氛围的建立，主体的首次亮相',
        transitionHint: '主体入场动作自然衔接下一镜头',
      };
    }
    return {
      positionLabel: '【收尾定格】',
      sceneScope: '中近景到特写的情绪高潮镜头',
      cameraMovement: '缓慢推近至特写或缓缓拉远定格',
      focusPoint: '情感高潮、关键表情、核心信息传达的瞬间',
      transitionHint: '画面定格或缓缓淡出，余韵悠长',
    };
  }

  if (totalShots === 3) {
    // 三幕式：起 → 承 → 合
    if (currentIndex === 0) {
      return {
        positionLabel: '【第一幕·开场】',
        sceneScope: '广角/全景建立镜头',
        cameraMovement: '横摇扫过环境后缓慢推近',
        focusPoint: '环境氛围建立 + 人物关系交代',
        transitionHint: '首帧延续尾帧的动作连贯性',
      };
    }
    if (currentIndex === 1) {
      return {
        positionLabel: '【第二幕·展开】',
        sceneScope: '中景/中近景为主',
        cameraMovement: '跟拍或环绕，捕捉主体动作和互动',
        focusPoint: '核心叙事内容、主要动作、情节推进',
        transitionHint: '动作和情绪自然递进至下一镜头',
      };
    }
    return {
      positionLabel: '【第三幕·收尾】',
      sceneScope: '近景/特写到远景的选择性收尾',
      cameraMovement: '缓慢拉远或定格特写',
      focusPoint: '情绪升华、关键细节、最终状态呈现',
      transitionHint: '画面收尾定格或淡出',
    };
  }

  // 4+ 镜头：标准多阶段映射
  const phase = Math.floor((currentIndex / Math.max(totalShots - 1, 1)) * 5);
  
  const standardStrategies: Record<number, ShotStrategy> = {
    0: {
      positionLabel: '【开场建立】',
      sceneScope: '广角建立镜头，展示整体环境全貌',
      cameraMovement: '缓慢推近或静止广角构图',
      focusPoint: '空间层次、环境氛围、主体入场位置',
      transitionHint: '引入主体，首帧延续至下一镜头',
    },
    1: {
      positionLabel: '【展开发展】',
      sceneScope: '中景镜头，聚焦核心区域',
      cameraMovement: '中景跟随或平移运镜',
      focusPoint: '主体主要动作、叙事推进、情节发展',
      transitionHint: '动作连贯过渡，保持节奏',
    },
    2: {
      positionLabel: '【细节特写】',
      sceneScope: '近景/特写镜头',
      cameraMovement: '缓慢推近至特写，浅景深突出主体',
      focusPoint: '关键细节、表情变化、情感高潮、重要信息',
      transitionHint: '情绪蓄力，为后续转折做准备',
    },
    3: {
      positionLabel: '【视角转换】',
      sceneScope: '侧面/过肩/不同角度',
      cameraMovement: '侧面角度或过肩镜头',
      focusPoint: '展现不同视角层次、情节深化或转折',
      transitionHint: '平滑衔接下一镜头',
    },
    4: {
      positionLabel: '【收尾定格】',
      sceneScope: '远景或标志性构图',
      cameraMovement: '缓缓拉远或定格画面',
      focusPoint: '最终状态、圆满呈现、留下深刻印象',
      transitionHint: '画面渐隐或定格结束',
    },
  };

  return standardStrategies[Math.min(phase, 4)];
}

// ============================================================
// 核心分析函数
// ============================================================

/**
 * 分析文本的场景类型
 */
function analyzeSceneType(text: string): SceneType {
  let bestMatch: SceneType = 'unidentified';
  let maxScore = 0;

  for (const [sceneType, config] of Object.entries(SCENE_KEYWORDS)) {
    if (sceneType === 'unidentified') continue;
    
    let score = 0;
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        score += keyword.length; // 长关键词权重更高
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestMatch = sceneType as SceneType;
    }
  }

  return bestMatch;
}

/**
 * 分析文本的情感类型
 */
function analyzeEmotion(text: string): EmotionType {
  let bestMatch: EmotionType = 'neutral';
  let maxScore = 0;

  for (const [emotion, config] of Object.entries(EMOTION_KEYWORDS)) {
    if (emotion === 'neutral') continue;
    
    let score = 0;
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        score += keyword.length;
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestMatch = emotion as EmotionType;
    }
  }

  return bestMatch;
}

/**
 * 从文本中提取视觉动作描述
 */
function extractVisualAction(text: string): { action: string; cameraHint: string } {
  for (const entry of ACTION_VISUAL_MAP) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) {
        return { action: entry.visualAction, cameraHint: entry.cameraHint };
      }
    }
  }
  return { action: '进行叙述或表达', cameraHint: '中景镜头，平衡构图' };
}

/**
 * 检测时间氛围
 */
function detectTimeAtmosphere(text: string): { label: string; lighting: string; mood: string } | null {
  for (const [keyword, atmosphere] of Object.entries(TIME_ATMOSPHERE)) {
    if (text.includes(keyword)) {
      return atmosphere;
    }
  }
  return null;
}

/**
 * 识别主体/人物描述
 */
function extractSubject(text: string): string {
  // 常见的人物/主体模式
  const subjectPatterns = [
    /^(?:一位?|一名?|一个?)([^，。！？\s]{2,8})(?:女性|男性|女生|男生|女孩|男孩|人|女士|先生|老人|青年|少年|儿童)/,
    /(?:主角|人物|角色|她|他)(?:叫|名为)?([^，。！？\s]{2,6})/,
    /^(我|你|我们|你们)/,
  ];

  for (const pattern of subjectPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // 默认返回通用描述
  return '人物';
}

// ============================================================
// 主生成函数
// ============================================================

/**
 * 核心函数：根据字幕内容生成分镜
 * 
 * @param segments - 字幕段落数组
 * @param options - 可选配置
 * @returns 结构化的分镜生成结果
 */
export function generateStoryboardFromSubtitles(
  segments: SubtitleSegmentInput[],
  options?: {
    /** 全局风格描述（可选，用于统一所有分镜的风格基调） */
    globalStyle?: string;
    /** 强制每段最大时长（默认10秒） */
    maxShotDuration?: number;
    /** 是否在 prompt 中包含原始字幕文本 */
    includeSourceText?: boolean;
    /** 自定义主体描述 */
    subjectDescription?: string;
  }
): StoryboardGenerationResult {
  const {
    globalStyle = '',
    maxShotDuration = MAX_SHOT_DURATION,
    includeSourceText = true,
    subjectDescription = '',
  } = options ?? {};

  const warnings: string[] = [];
  const shots: GeneratedShot[] = [];
  let mergedCount = 0;
  let splitCount = 0;

  if (segments.length === 0) {
    return {
      shots: [],
      totalDuration: 0,
      summary: {
        totalSegments: 0,
        totalShots: 0,
        mergedSegments: 0,
        splitSegments: 0,
        dominantScene: '-',
        dominantEmotion: '-',
      },
      warnings: ['没有输入字幕段落'],
    };
  }

  // ===== 第一步：预处理 - 时长归并和拆分 =====
  const processedSegments: Array<SubtitleSegmentInput & { needsSplit: boolean }> = [];
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segDuration = seg.endTime - seg.startTime;

    if (segDuration < MIN_SHOT_DURATION && processedSegments.length > 0) {
      // 过短：合并到前一段
      const prev = processedSegments[processedSegments.length - 1];
      prev.text += seg.text;
      prev.endTime = seg.endTime;
      mergedCount++;
      warnings.push(`段${i + 1}("${seg.text.substring(0, 10)}...") 时长${segDuration.toFixed(1)}s过短，已合并到前一段`);
    } else if (segDuration > maxShotDuration) {
      // 过长：标记需要拆分
      processedSegments.push({ ...seg, needsSplit: true });
      splitCount++;
      warnings.push(`段${i + 1}("${seg.text.substring(0, 10)}...") 时长${segDuration.toFixed(1)}s超过${maxShotDuration}s限制，将拆分为多镜头`);
    } else {
      processedSegments.push({ ...seg, needsSplit: false });
    }
  }

  // ===== 第二步：逐段分析并生成分镜 =====
  const sceneCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};

  // 预计算总镜头数（用于方案B的动态策略）
  // 先做一轮预处理统计实际会生成多少个镜头
  let estimatedShots = 0;
  for (let i = 0; i < segments.length; i++) {
    const segDur = segments[i].endTime - segments[i].startTime;
    if (segDur < MIN_SHOT_DURATION && estimatedShots > 0) continue; // 会被合并
    if (segDur > maxShotDuration) {
      estimatedShots += Math.ceil(segDur / maxShotDuration);
    } else {
      estimatedShots += 1;
    }
  }

  // 方案E: 初始化风格上下文（在首个镜头分析后更新）
  let styleContext: StyleContext | null = null;

  for (let si = 0; si < processedSegments.length; si++) {
    const seg = processedSegments[si];
    const segDuration = seg.endTime - seg.startTime;

    // 内容分析
    const sceneType = analyzeSceneType(seg.text);
    const emotion = analyzeEmotion(seg.text);
    const { action: visualAction } = extractVisualAction(seg.text);
    const timeAtmo = detectTimeAtmosphere(seg.text);
    const subject = subjectDescription || extractSubject(seg.text);

    // 统计
    sceneCounts[sceneType] = (sceneCounts[sceneType] || 0) + 1;
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;

    // 获取场景和情感配置
    const sceneConfig = SCENE_KEYWORDS[sceneType];
    const emotionConfig = EMOTION_KEYWORDS[emotion];

    // 方案B: 使用动态镜头策略替代固定3档
    // 方案E: 初始化/更新风格上下文
    if (styleContext === null) {
      styleContext = initStyleContext(sceneType, emotion, timeAtmo);
    }

    // 计算实际镜头数量（处理超长拆分）
    const actualShotCount = seg.needsSplit
      ? Math.ceil(segDuration / maxShotDuration)
      : 1;
    const baseDuration = seg.needsSplit
      ? Math.min(maxShotDuration, segDuration)
      : segDuration;

    // 为每个（拆分后的）镜头生成 prompt
    for (let shotIdx = 0; shotIdx < actualShotCount; shotIdx++) {
      const shotIndex = shots.length;
      const isShotLast = shotIdx === actualShotCount - 1;
      
      // 拆分段时，截取对应部分的文本
      let shotText = seg.text;
      if (seg.needsSplit && actualShotCount > 1) {
        const charsPerShot = Math.ceil(seg.text.length / actualShotCount);
        const startChar = shotIdx * charsPerShot;
        shotText = seg.text.substring(startChar, startChar + charsPerShot);
      }

      // 计算当前镜头的时长
      const currentDuration = isShotLast
        ? (seg.needsSplit ? segDuration - (actualShotCount - 1) * baseDuration : segDuration)
        : baseDuration;

      // 构建画面提示词（v2.0: 整合全部优化方案）
      const promptParts: string[] = [];

      // 1. 使用方案A+B+C+D+E+F 的核心构建引擎
      const coreVisual = buildCoreVisualPrompt({
        subject,
        text: shotText,
        sceneType,
        sceneLabel: sceneConfig.label,
        visualAction,
        emotion,
        emotionLabel: emotionConfig.label,
        timeAtmosphere: timeAtmo,
        globalStyle,
        totalShots: estimatedShots,
        shotIndex,
        duration: currentDuration,
        prevContext: shotIndex > 0 ? styleContext : null,
      });
      promptParts.push(coreVisual);

      // 2. 可选：附加原始文本参考（仅短文本）
      if (includeSourceText && shotText.length <= 50) {
        promptParts.push(`（旁白/字幕内容："${shotText}"）`);
      }

      const finalPrompt = promptParts.join('。').replace(/。+/g, '。').replace(/\(\(/g, '(');

      // 方案E: 更新风格上下文供下一镜头使用
      const combo = SCENE_EMOTION_MATRIX[sceneType]?.[emotion];
      if (combo && isShotLast) {
        styleContext = {
          ...styleContext,
          colorPalette: combo.colorMood.split('，')[0] || styleContext.colorPalette,
        };
      }

      // 方案B: 从动态策略获取镜头建议
      const strategy = getShotStrategy(estimatedShots, shotIndex);

      shots.push({
        id: `shot-gen-${Date.now()}-${shotIndex}`,
        index: shotIndex,
        prompt: finalPrompt,
        duration: currentDuration,
        sourceText: shotText,
        sceneType,
        emotion,
        cameraSuggestion: `${strategy.positionLabel} ${strategy.cameraMovement}`,
        lighting: combo?.lightConcrete || emotionConfig.lightingDesc,
      });
    }
  }

  // ===== 第三步：计算统计摘要 =====
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  const dominantScene = Object.entries(sceneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unidentified';
  const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

  return {
    shots,
    totalDuration,
    summary: {
      totalSegments: segments.length,
      totalShots: shots.length,
      mergedSegments: mergedCount,
      splitSegments: splitCount,
      dominantScene: SCENE_KEYWORDS[dominantScene as SceneType]?.label ?? dominantScene,
      dominantEmotion: EMOTION_KEYWORDS[dominantEmotion as EmotionType]?.label ?? dominantEmotion,
    },
    warnings,
  };
}

// ============================================================
// 内部构建函数
// ============================================================

// ============================================================
// 方案D: 用户输入结构化实体提取
// 从用户描述中提取主体/地点/时间/动作/物体等结构化信息
// ============================================================

/**
 * 提取用户输入中的关键实体，用于深度注入到 prompt 中
 * 解决问题：用户说"海边日落"但输出只有"自然风光环境"
 */
export function extractUserInputEntities(prompt: string): UserInputEntities {
  const p = prompt.trim();

  // === 主体提取 ===
  let subject = '人物';
  const explicitSubjects = [
    '年轻急救员',
    '急救员',
    '审计师',
    '品牌经理',
    '市场经理',
    '投放经理',
    '运营负责人',
    '创意总监',
    '失业剪辑师',
    '剪辑师',
  ];
  const directSubject = explicitSubjects.find(item => p.includes(item));
  if (directSubject) subject = directSubject;
  const subjectPatterns = [
    /([\u4e00-\u9fa5]{0,10}(急救员|审计师|剪辑师|导演|编剧|制片人|摄影师|品牌经理|市场经理|投放经理|运营负责人|创意总监|店员|学生|医生|记者|侦探|演员|调律者|漂泊旅人|机甲少女))/,
    /^(?:一位?|一名?|一个?)([^，。！？\s]{2,8})(?:女性|男性|女生|男生|女孩|男孩|人|女士|先生|老人|青年|少年|儿童|青年女子|年轻男子)/,
    /(?:女孩|男孩|女生|男生|女人|男人|少女|少年|青年|老人|孩子|小朋友)([^，。！？\s]{0,6})/,
    /(猫|狗|鸟|熊猫|狮子|老虎|大象|马|兔子|蝴蝶|海豚|鲸鱼)/,
  ];
  if (subject === '人物') {
    for (const pat of subjectPatterns) {
      const m = p.match(pat);
      if (m) { subject = m[0].trim(); break; }
    }
  }

  // === 地点展开 ===
  let location = '';
  const explicitLocations = [
    '夜晚办公室',
    '品牌战情室',
    '投放中控台',
    '便利店',
    '剪辑室',
    '剧院',
    '地铁站',
    '街道',
    '仓库',
    '学校',
    '医院',
    '车站',
    '公寓',
    '天台',
    '走廊',
    '浮空遗迹',
    '海蚀废墟',
    '风暴峡谷',
    '未来城市',
    '森林',
    '海边',
  ];
  const directLocation = explicitLocations
    .map(item => ({ item, index: p.indexOf(item) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index || b.item.length - a.item.length)[0]?.item;
  if (directLocation) location = directLocation;
  else if (/海|沙滩|海岸|海滨|海边|海洋|大海/.test(p)) location = '海岸场景';
  else if (/山|山峰|山顶|山脉|高山|悬崖/.test(p)) location = '巍峨的山脉或山顶，云雾缭绕';
  else if (/森林|树林|丛林|树|林间/.test(p)) location = '茂密的森林，阳光透过树叶洒落斑驳光影';
  else if (/公园|花园|草地|草坪|花/.test(p)) location = '绿意盎然的公园或花园，花草繁茂';
  else if (/城市|街道|建筑|广场|都市|高楼/.test(p)) location = '现代化的城市街景，建筑林立';
  else if (/家|室内|房间|客厅|卧室|居家/.test(p)) location = '温馨舒适的室内空间';
  else if (/宇宙|星空|太空|未来|科幻/.test(p)) location = '浩瀚的宇宙星空或未来科技场景';
  else if (/湖|河|水|溪流|池塘|水面/.test(p)) location = '宁静的水域，水面波光粼粼';

  // === 时间推断 ===
  let timeOfDay = '';
  if (/日出|清晨|早晨|早上|黎明/.test(p)) timeOfDay = '日出清晨时分';
  else if (/傍晚|黄昏|日落|夕阳|暮色/.test(p)) timeOfDay = '黄昏日落时刻';
  else if (/夜晚|深夜|晚上|夜间|月光|星空/.test(p)) timeOfDay = '静谧夜晚';
  else if (/中午|正午|午后|下午/.test(p)) timeOfDay = '白昼时光';

  // === 动作展开 ===
  let action = '';
  if (/走|散步|漫步|行走|步/.test(p)) action = '缓步前行，步伐轻盈从容';
  else if (/跑|奔|追逐|冲刺/.test(p)) action = '奔跑或快速移动，充满动感';
  else if (/坐|躺|靠|休息|停|站|伫立/.test(p)) action = '静止或坐卧姿态，安详自在';
  else if (/看|望|注视|凝视|眺望/.test(p)) action = '凝望远方，目光深邃';
  else if (/笑|微笑|欢乐|开心/.test(p)) action = '面带笑容，神情愉悦放松';
  else if (/哭|泪|悲伤|难过/.test(p)) action = '情绪低落，神情感伤';
  else if (/飞|飞翔|飘|舞/.test(p)) action = '自由舞动或轻盈漂浮';
  else if (/说|讲|谈|唱|吟/.test(p)) action = '正在表达或叙述中';

  // === 情感推断 ===
  let emotion = '';
  if (/开心|快乐|欢乐|笑|幸福|庆祝|喜悦/.test(p)) emotion = '欢快愉悦';
  else if (/温馨|温暖|感动|治愈|家人|朋友|爱/.test(p)) emotion = '温馨治愈';
  else if (/浪漫|唯美|美|爱|恋|心动/.test(p)) emotion = '浪漫唯美';
  else if (/紧张|刺激|激烈|战斗|危险/.test(p)) emotion = '紧张刺激';
  else if (/励志|奋斗|梦想|努力|希望/.test(p)) emotion = '激昂励志';
  else if (/悲伤|难过|伤心|失落|孤独/.test(p)) emotion = '忧伤感伤';

  // === 关键物体 ===
  const objects: string[] = [];
  const objectKeywords = [
    '红色书包',
    '玩具对讲机',
    '旧桥警报屏',
    '紧急制动按钮',
    '最后一班列车',
    '旧桥',
    '透明电梯',
    '红色档案袋',
    '倒跳楼层数字',
    '旧录像带',
    '录像带',
    '胶片',
    '投放报表',
    '碎片素材',
    '增长曲线',
    '数据大屏',
    '新版方案',
    '广告脚本',
    '声波核心',
    '共鸣装置',
    '能量长刃',
    '潮汐罗盘',
    '伞',
    '书',
    '咖啡',
    '花',
    '琴',
    '画',
    '相机',
    '手机',
    '气球',
    '礼物',
    '信',
    '灯',
    '窗',
    '门',
    '船',
    '车',
  ];
  for (const kw of objectKeywords) {
    if (kw === '胶片' && /无关宇宙胶片|抽象宇宙胶片|纯氛围蒙太奇/.test(p)) continue;
    if (p.includes(kw)) objects.push(kw);
  }

  // === 氛围 ===
  let atmosphere = '';
  if (/梦幻|仙境|童话/.test(p)) atmosphere = '如梦似幻的氛围';
  else if (/安静|宁静|平静|祥和/.test(p)) atmosphere = '宁静祥和的氛围';
  else if (/热闹|繁华|喧闹/.test(p)) atmosphere = '热闹繁华的氛围';
  else if (/神秘|未知|探索/.test(p)) atmosphere = '神秘未知的氛围';

  return { subject, location, timeOfDay, action, emotion, objects, atmosphere };
}

// ============================================================
// 方案C+E+F: 核心画面构建引擎已拆分到 storyboard/subtitle-core-visual-prompt.ts
// ============================================================

// ============================================================
// 便捷导出
// ============================================================

/**
 * 将 GeneratedShot 转换为 StoryboardShot 格式（用于应用到编辑器）
 */
export function convertToStoryboardShots(
  generatedShots: GeneratedShot[]
): Array<{ id: string; prompt: string; duration: number }> {
  return generatedShots.map((shot) => ({
    id: shot.id,
    prompt: sanitizePromptForMiniMax(shot.prompt).sanitized,
    duration: Math.min(Math.max(shot.duration, 1), 10),
  }));
}

// ============================================================
// 方案D: 场景感知分镜生成引擎 v3.0（从纯文本提示词生成分镜）
// 已拆分到 src/lib/storyboard/prompt-shot-*，保持 storyboard-generator 只负责字幕分镜入口与统一导出。
// ============================================================

export { generateShotsFromUserPrompt } from './storyboard/prompt-shot-generator';
export type {
  NarrationSuggestion,
  PromptBasedShot,
  ShotPhase,
  ShotType,
  SubtitleSuggestion,
} from './storyboard/prompt-shot-types';
export type { VisualAnchor } from './storyboard/prompt-shot-builders';

export {
  checkPromptSensitivity,
  getRiskLevelConfig,
  isPromptSafe,
  sanitizePromptForMiniMax,
} from './storyboard/prompt-sensitivity';
export type {
  SensitivityCategory,
  SensitivityCheckResult,
  SensitivityLevel,
  SanitizationResult,
} from './storyboard/prompt-sensitivity';
