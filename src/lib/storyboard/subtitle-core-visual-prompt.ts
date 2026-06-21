import { SCENE_EMOTION_MATRIX } from './scene-emotion-data';
import type { EmotionType, SceneType } from './scene-emotion-data';
import type { StyleContext, UserInputEntities } from '../storyboard-generator';

interface ShotStrategy {
  positionLabel: string;
  sceneScope: string;
  cameraMovement: string;
  focusPoint: string;
  transitionHint: string;
}

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
function getSubtitleShotStrategy(totalShots: number, currentIndex: number): ShotStrategy {
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
// 方案C+E+F: 核心画面构建引擎 v2（整合Guide对齐+风格连续性+MiniMax对齐）
// ============================================================

/** 质量后缀 — 对齐 video-prompt-guide 的「画质必加句」+ MiniMax中英双语 */
const QUALITY_SUFFIXES = {
  short: 'cinematic lighting, 4K ultra HD, highly detailed, smooth motion',
  medium: '电影级布光，4K超高清画质，细节丰富，画面连贯流畅无卡顿，cinematic quality',
  long: '电影级质感布光，4K超高清，HDR高动态范围，细节纹理清晰可见，色彩准确，运动流畅连贯无抖动无畸变，cinematic lighting, 8K quality, professional color grading',
};

function getQualitySuffix(duration: number): string {
  if (duration <= 3) return QUALITY_SUFFIXES.short;
  if (duration <= 7) return QUALITY_SUFFIXES.medium;
  return QUALITY_SUFFIXES.long;
}

/**
 * 构建时序动作序列 — 对齐 Guide 的「时序动作写法」
 * 将泛化的动作描述转换为具体的动作链
 */
function buildActionSequence(text: string, visualAction: string): string {
  // 如果已有较具体的视觉动作，直接使用
  const specificActions = [
    '行走或移动中', '奔跑或快速移动', '静止或坐卧姿态',
    '说话或交谈中', '观看或凝视远方', '面带笑容，神情愉悦',
    '情绪低落或流泪', '陷入思考或回忆',
    '准备开始或刚刚起步', '完成动作或收尾阶段',
    '正在发生变化或转变', '展示某物或揭示信息',
  ];
  
  if (specificActions.includes(visualAction)) {
    // 将通用动作映射为具体时序动作
    const actionMap: Record<string, string> = {
      '行走或移动中': '缓步向前移动，手臂自然摆动，步伐从容不迫',
      '奔跑或快速移动': '加速向前奔跑，衣角和发丝随风飞扬',
      '静止或坐卧姿态': '保持静态姿势，偶尔微微调整身体重心',
      '说话或交谈中': '微微张合嘴唇配合表达，手势自然辅助说明',
      '观看或凝视远方': '目光投向远方，头部微微抬起，神情专注',
      '面带笑容，神情愉悦': '嘴角上扬露出笑容，眼角弯起，整体神态轻松',
      '情绪低落或流泪': '肩膀微微下沉，目光低垂，呼吸轻柔缓慢',
      '陷入思考或回忆': '微微侧头，手指轻触下巴，眼神变得深远',
      '准备开始或刚刚起步': '深吸一口气，身体前倾迈出第一步',
      '完成动作或收尾阶段': '缓缓停下动作，长舒一口气，呈现最终状态',
      '正在发生变化或转变': '从一种状态逐渐过渡到另一种状态，变化流畅自然',
      '展示某物或揭示信息': '将物品举起或转向镜头，展示其全貌或细节',
    };
    return actionMap[visualAction] || visualAction;
  }

  // 默认：根据文本内容生成基础动作
  if (text.length > 0) {
    return `进行与"${text.substring(0, 15)}${text.length > 15 ? '...' : ''}"相关的自然表达动作`;
  }
  return '自然地处于场景中，与环境和谐共存';
}

/**
 * 构建主体定义 — 对齐 Guide 的「主体精准定义法」
 * 尽可能推断主体的具体外观特征
 */
function buildSubjectDefinition(subject: string, text: string, sceneType: SceneType): string {
  // 如果已提供具体描述，直接使用
  if (subject && subject !== '人物' && subject.length > 2) {
    return subject;
  }

  // 尝试从文本推断更具体的主体描述
  const lowerText = text.toLowerCase();
  
  // 性别推断
  let gender = '';
  if (/她|女|女孩|女生|女士|少女|姑娘|女神/.test(lowerText)) gender = '女性';
  else if (/他|男|男孩|男生|男士|少年|小伙|男神/.test(lowerText)) gender = '男性';
  
  // 年龄推断
  let ageHint = '';
  if (/孩子|小孩|儿童|小|幼/.test(lowerText)) ageHint = '年幼的';
  else if (/老人|老年|长辈|老/.test(lowerText)) ageHint = '年长的';
  else if (/青年|年轻人|少|青春/.test(lowerText)) ageHint = '年轻的';

  // 场景适配服装
  let costumeHint = '';
  switch (sceneType) {
    case 'outdoor_nature': costumeHint = '穿着休闲便装'; break;
    case 'outdoor_urban': costumeHint = '穿着时尚都市装'; break;
    case 'indoor_home': costumeHint = '着装符合人物身份和剧情场景'; break;
    case 'indoor_office': costumeHint = '穿着正式商务装'; break;
    case 'crowd_public': costumeHint = '穿着得体社交装'; break;
    default: costumeHint = '着装得体';
  }

  const parts = [ageHint, gender, costumeHint].filter(Boolean);
  return parts.length > 0 ? parts.join('') + '的人物' : '人物';
}

/**
 * 风格上下文初始化 — 方案E：保证相邻镜头间的视觉连续性
 */
export function initStyleContext(sceneType: SceneType, emotion: EmotionType, timeAtmo: { label: string } | null): StyleContext {
  // 基于场景类型确定默认外观
  const appearanceMap: Record<SceneType, string> = {
    outdoor_nature: '休闲自然的着装风格，发型随性',
    outdoor_urban: '现代时尚的都市穿搭，整洁干练',
    indoor_home: '柔软舒适的居家服，放松随性',
    indoor_office: '正式或商务休闲装束，专业得体',
    indoor_abstract: '简约干净的造型，无明显时代特征',
    crowd_public: '适合公共场合的得体装扮',
    fantasy: '具有未来感或幻想风格的独特外观',
    unidentified: '干净利落的普通着装',
  };

  // 光线方向基于时间
  let lightDir = '侧前方45度主光';
  if (timeAtmo) {
    if (['早晨', '早上'].includes(timeAtmo.label)) lightDir = '低角度侧逆光（晨光方向）';
    else if (['傍晚', '黄昏'].includes(timeAtmo.label)) lightDir = '低角度金色逆光（夕阳方向）';
    else if (['中午', '正午'].includes(timeAtmo.label)) lightDir = '接近顶光的高角度光源';
    else if (['晚上', '深夜'].includes(timeAtmo.label)) lightDir = '环境人造光源为主';
  }

  // 色调基于情感
  const paletteMap: Record<EmotionType, string> = {
    joyful: '暖黄橙为主色调',
    warm: '琥珀暖棕为主色调',
    calm: '冷青灰为主色调',
    serious: '蓝灰中性为主色调',
    tense: '高对比冷暖冲突色调',
    sad: '灰蓝褪色为主色调',
    inspiring: '金橙到蓝的渐变色调',
    romantic: '粉紫玫瑰金为主色调',
    neutral: '自然真实色调',
  };

  return {
    subjectAppearance: appearanceMap[sceneType],
    lightingDirection: lightDir,
    colorPalette: paletteMap[emotion],
    timeOfDay: timeAtmo?.label || '白昼',
    weather: '晴朗',
    keyProps: '',
  };
}

export interface BuildPromptOptions {
  subject: string;
  text: string;
  sceneType: SceneType;
  sceneLabel: string;
  visualAction: string;
  emotion: EmotionType;
  emotionLabel: string;
  timeAtmosphere: { label: string; lighting: string; mood: string } | null;
  globalStyle: string;
  /** 总镜头数（用于动态策略） */
  totalShots?: number;
  /** 当前镜头索引（用于动态策略） */
  shotIndex?: number;
  /** 当前镜头时长（用于时长自适应） */
  duration?: number;
  /** 上一个镜头的风格上下文（方案E） */
  prevContext?: StyleContext | null;
  /** 用户输入实体（方案D） */
  userEntities?: UserInputEntities | null;
}

/**
 * 核心画面构建函数 v2.0
 * 
 * 整合全部6个优化方案：
 * - A: 场景×情感72组合矩阵 → 具体视觉元素
 * - B: 动态镜头策略 → 差异化景别运镜
 * - C: Guide最佳实践 → 主体定义/时序动作/画质后缀
 * - D: 用户输入注入 → 实体信息融入
 * - E: 风格连续性 → 继承/演变上下文
 * - F: MiniMax对齐 → 中英双语/时长自适应
 */
export function buildCoreVisualPrompt(opts: BuildPromptOptions): string {
  const {
    subject, text, sceneType, sceneLabel, visualAction,
    emotion, emotionLabel, timeAtmosphere, globalStyle,
    totalShots = 1, shotIndex = 0,
    duration = 5, prevContext = null, userEntities = null,
  } = opts;

  const parts: string[] = [];

  // ========== 方案A: 场景×情感组合矩阵 → 核心视觉描述 ==========
  const combo = SCENE_EMOTION_MATRIX[sceneType]?.[emotion];
  if (combo) {
    // 使用组合矩阵的具体视觉元素（替代原来的泛化标签）
    
    // 如果有用户输入实体，优先使用用户的具体信息
    if (userEntities?.location) {
      parts.push(userEntities.location);
    } else {
      parts.push(combo.sceneElements);
    }

    // 主体 + 动作（方案C: 主体精准定义 + 时序动作写法）
    const definedSubject = buildSubjectDefinition(subject, text, sceneType);
    const sequenceAction = buildActionSequence(text, visualAction);
    parts.push(`${definedSubject}${sequenceAction}`);

    // 时间氛围（如果有具体信息则用具体信息）
    if (userEntities?.timeOfDay) {
      parts.push(`${userEntities.timeOfDay}的${emotionLabel}氛围`);
    } else if (timeAtmosphere) {
      parts.push(`${timeAtmosphere.mood}的${timeAtmosphere.label}氛围`);
    } else if (emotion !== 'neutral') {
      parts.push(`整体${emotionLabel}的${(emotion === 'joyful' || emotion === 'warm' || emotion === 'romantic') ? '氛围' : '感觉'}`);
    }

    // 用户输入的关键物体
    if (userEntities?.objects && userEntities.objects.length > 0) {
      parts.push(`画面中有${userEntities.objects.join('、')}`);
    }

    // 用户输入的氛围补充
    if (userEntities?.atmosphere) {
      parts.push(userEntities.atmosphere);
    }

  } else {
    // 降级：使用原始逻辑（不应触发，但作为安全兜底）
    if (sceneType === 'indoor_abstract') {
      parts.push(`${sceneLabel}风格背景，${visualAction}`);
    } else if (sceneType === 'fantasy') {
      parts.push(`${subject}在${sceneLabel}场景中${visualAction}`);
    } else {
      parts.push(`${subject}在${sceneLabel}环境中${visualAction}`);
    }
    if (timeAtmosphere) {
      parts.push(timeAtmosphere.mood + '的' + timeAtmosphere.label + '氛围');
    }
    if (emotion !== 'neutral') {
      parts.push(`整体${emotionLabel}`);
    }
  }

  // 全局风格
  if (globalStyle) {
    parts.push(globalStyle);
  }

  // ========== 方案B: 动态镜头策略 → 运镜描述 ==========
  const strategy = getSubtitleShotStrategy(totalShots, shotIndex);
  if (totalShots > 1) {
    // 多镜头时使用策略化的位置标签和运镜
    parts.push(`[${strategy.positionLabel}] ${strategy.sceneScope}，${strategy.cameraMovement}，聚焦于${strategy.focusPoint}`);
  }

  // ========== 方案A(续): 光线具象描述 ==========
  if (combo) {
    parts.push(combo.lightConcrete);
    parts.push(combo.colorMood);
    if (combo.detailNotes) {
      parts.push(combo.detailNotes);
    }
  }

  // ========== 方案C+F: 质量后缀（Guide对齐 + MiniMax双语 + 时长自适应） ==========
  parts.push(getQualitySuffix(duration));

  // ========== 方案E: 风格连续性标注 ==========
  if (prevContext && shotIndex > 0) {
    // 标注继承关系（帮助模型理解连续性）
    parts.push(`(延续上一镜头的${prevContext.subjectAppearance}和${prevContext.colorPalette})`);
  }

  return parts.join('。').replace(/。+/g, '。').replace(/\(\(/g, '(');
}
