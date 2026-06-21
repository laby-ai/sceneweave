/**
 * 视频生产平台 v3.1 - 类型定义
 * 整合编剧Agent / 导演Agent / 混合调度 / AI质量评估 / DAG工作流 / 模型路由 / 提示词工程
 */

// ============================================================
// 景别类型
// ============================================================

/** 8种景别代码 */
export type ShotTypeCode = 'ECU' | 'CU' | 'MCU' | 'MS' | 'MWS' | 'WS' | 'EWS' | 'EST';

/** 景别定义 */
export interface ShotTypeDefinition {
  code: ShotTypeCode;
  name: string;        // 中文名
  focus: string;       // 聚焦点
  emotion: string;     // 情绪表达
}

// ============================================================
// 运镜类型
// ============================================================

/** 13种运镜代码 */
export type CameraMovementCode =
  | 'static' | 'dolly_in' | 'dolly_out'
  | 'tracking' | 'pan_left' | 'pan_right'
  | 'tilt_up' | 'tilt_down'
  | 'crane_up' | 'crane_down'
  | 'zoom_in' | 'zoom_out' | 'handheld';

/** 运镜定义 */
export interface CameraMovementDefinition {
  code: CameraMovementCode;
  name: string;        // 中文名
  intensity: 'low' | 'medium' | 'medium-high' | 'high';
  drama: string;       // 戏剧效果
}

// ============================================================
// 转场类型
// ============================================================

/** 7种转场代码 */
export type TransitionCode = 'cut' | 'dissolve' | 'fade_in' | 'fade_out' | 'wipe' | 'flash' | 'match_cut';

/** 转场定义 */
export interface TransitionDefinition {
  code: TransitionCode;
  name: string;        // 中文名
  duration: number;    // 转场时长(秒)
  drama: string;       // 戏剧效果
}

// ============================================================
// 内容类型
// ============================================================

/** 10种内容类型代码 */
export type ContentTypeCode = 'short_drama' | 'education' | 'documentary' | 'marketing' | 'news' | 'general' | 'period_drama' | 'fantasy' | 'cyberpunk' | 'folk_culture';

/** 叙事段落类型 */
export type NarrativeSegmentType = 'setup' | 'conflict' | 'climax' | 'resolution' | 'transition' | 'establishing';

/** 情感标签 */
export type EmotionTag =
  | 'anticipation' | 'tension' | 'high_excitement' | 'satisfaction'
  | 'curiosity' | 'focus' | 'awe' | 'contemplation' | 'inspiration'
  | 'pain_point' | 'solution' | 'action' | 'neutral' | 'engagement'
  | 'summary';

/** 节奏标签 */
export type PacingLabel = 'slow' | 'medium' | 'fast' | 'very_fast' | 'rhythm' | 'controlled';

/** 叙事段落模板 */
export interface NarrativeSegmentTemplate {
  type: NarrativeSegmentType;
  emotion: EmotionTag;
  pacing: PacingLabel;
  desc: string;
}

/** 景别分布配置 */
export interface ShotDistribution {
  [shotType: string]: number;  // 百分比
}

/** 转场风格 */
export type TransitionStyle = 'cut' | 'dissolve' | 'mixed' | 'morph' | 'glitch' | 'wipe' | 'zoom';

/** 内容类型叙事模板 */
export interface NarrativeTemplate {
  name: string;                       // 类型中文名
  keywords: string[];                 // 识别关键词
  structure: NarrativeSegmentTemplate[];  // 叙事结构
  shotDistribution: ShotDistribution; // 景别分布
  pacing: PacingLabel;               // 节奏
  transitionStyle: TransitionStyle;   // 转场风格
}

// ============================================================
// 编剧 Agent 输出
// ============================================================

/** 故事段落 */
export interface StorySegment {
  segmentId: string;
  sequence: number;
  type: NarrativeSegmentType;
  text: string;           // 对白/旁白
  emotion: EmotionTag;    // 情绪标签
  pacing: PacingLabel;    // 节奏标签
  subject: string;        // 主体描述
  setting: string;        // 场景设置
  lighting: string;       // 光影
  style: string;          // 风格
  characterIds: string[]; // 涉及的角色
  assetRefs: string[];    // 资产引用
}

/** 编剧输出 */
export interface WriterOutput {
  contentType: ContentTypeCode;
  typeName: string;
  outline: string;
  narrative: StorySegment[];
  characterProfiles: Record<string, CharacterProfile>;
  template: NarrativeTemplate;
}

/** 角色小传 */
export interface CharacterProfile {
  id: string;
  name: string;
  appearance: string;     // 外貌描述（用于生图一致性）
  personality: string;    // 性格特征
  motivation: string;     // 动机
  arc: string;            // 角色弧光
  relationships: Record<string, string>; // 与其他角色的关系
  referenceSheet?: string; // 参考图
}

/** 角色圣经 — 跨场景一致性核心资产 */
export interface CharacterBible {
  id: string;
  characterId: string;
  version: number;
  /** 基础信息 */
  name: string;
  era: string;             // 时代背景(唐/宋/明/现代/架空等)
  identity: string;        // 身份阶级
  /** 外观锚点 — 保证视觉一致性 */
  appearanceAnchor: {
    faceShape: string;     // 脸型
    skinTone: string;      // 肤色
    eyeShape: string;      // 眼型
    eyebrowStyle: string;  // 眉型
    lipColor: string;      // 唇色
    hairStyle: string;     // 发型
    height: string;        // 身高
    bodyType: string;      // 体态
  };
  /** 妆容体系 — 不同场景的妆容变化 */
  makeupSets: Record<string, {
    sceneType: string;     // 场景类型(朝堂/闺阁/战场/宴会等)
    baseMakeup: string;    // 底妆
    eyeMakeup: string;     // 眼妆
    lipColor: string;      // 唇色
    cheekColor: string;    // 腮红
    specialMarks: string;  // 特殊标记(花钿/面靥/斜红等)
  }>;
  /** 服饰体系 — 不同场景的着装 */
  costumeSets: Record<string, {
    sceneType: string;
    headwear: string;      // 冠/簪/钗/步摇
    upperGarment: string;  // 上衣
    lowerGarment: string;  // 下裙/裤
    outerwear: string;     // 披帛/大氅/斗篷
    accessories: string;   // 腰饰/禁步/香囊
    fabric: string;        // 面料(纱/罗/绫/缎/锦)
    color: string;         // 主色调
    pattern: string;       // 纹样(团花/卷草/宝相花等)
  }>;
  /** 习性动作 — 表演参考 */
  behavioralTraits: string[];
  /** 参考图集 */
  referenceImages: string[];
  /** 禁忌 — 不能出现的视觉错误 */
  visualTaboos: string[];
}

/** 场景圣经 — 空间一致性核心资产 */
export interface SceneBible {
  id: string;
  sceneName: string;
  version: number;
  /** 时代与风格 */
  era: string;
  style: string;            // 建筑风格/室内风格
  /** 空间锚点 */
  spatialAnchor: {
    layout: string;          // 空间布局(中轴对称/园林自由等)
    keyElements: string[];   // 关键空间元素(柱/屏风/窗棂等)
    lightingStyle: string;   // 光照风格(自然光/烛光/宫灯等)
    colorPalette: string[];  // 色彩基调
  };
  /** 连续性约束 — 跨镜头必须保持一致的元素 */
  continuityConstraints: {
    weatherIndependent: string[];  // 不受天气影响的固定元素
    timeOfDayLighting: Record<string, string>; // 时辰→光照映射
    propPlacement: Record<string, string>;      // 道具固定位置
  };
  /** 季节/时间变体 */
  seasonalVariants: Record<string, {
    vegetation: string;
    lighting: string;
    atmosphere: string;
  }>;
  /** 参考图 */
  referenceImages: string[];
}

/** 镜头表 — 连续性看板 */
export interface ShotList {
  id: string;
  projectId: string;
  scenes: ShotListScene[];
}

export interface ShotListScene {
  sceneId: string;
  sceneName: string;
  shots: ShotListItem[];
}

// ============================================================
// 导演 Agent 输出
// ============================================================

/** 导演分镜指令 */
export interface DirectorShot {
  shotId: string;
  sequence: number;

  // 景别与运镜
  shotType: ShotTypeCode;
  cameraMovement: CameraMovementCode;
  visualPrompt: string;    // 驱动AI的画面描述
  duration: number;        // 秒

  // 详细字段
  cameraDetail: string;    // 详细运镜描述
  subject: string;         // 主体
  environment: string;     // 环境
  lighting: string;        // 光影
  style: string;           // 风格
  pacing: PacingLabel;     // 节奏

  // 音频指令
  audioType: 'dialogue' | 'narration' | 'music' | 'sfx' | '';
  audioContent: string;
  emotionTag: EmotionTag | '';

  // 转场
  transitionFrom: TransitionCode;
  transitionTo: TransitionCode;

  // 资产引用
  characterRefs: string[];
  assetLibraryRefs: string[];
  sceneRefs: string[];

  // 调度决策（由混合调度引擎填充）
  assetSource: 'stock_match' | 'enhanced' | 'ai_generated' | '';
  assetId: string;
  matchScore: number;
}

/** 情感曲线点 */
export interface EmotionCurvePoint {
  sequence: number;
  emotion: EmotionTag;
  intensity: number;  // 0-1
}

/** 导演输出 */
export interface DirectorOutput {
  shots: DirectorShot[];
  emotionCurve: EmotionCurvePoint[];
  totalDuration: number;
  shotTypeDistribution: Record<string, number>;
  keyMoments: Array<{ sequence: number; description: string }>;
}

// ============================================================
// 混合调度引擎
// ============================================================

/** 素材调度决策 */
export interface AssetDecision {
  shotId: string;
  mode: 'stock_match' | 'enhanced' | 'ai_generated';
  reason: string;
  matchScore: number;
  asset: Record<string, unknown> | null;
  enhanceOperations: string[];
  estimatedCost: number;
  qualityIssues: string[];
}

/** 调度统计 */
export interface ScheduleStats {
  stockMatched: number;
  enhanced: number;
  aiGenerated: number;
  totalCost: number;
  costSaved: number;
}

/** 调度输出 */
export interface SchedulerOutput {
  decisions: AssetDecision[];
  stats: ScheduleStats;
}

// ============================================================
// 流水线
// ============================================================

/** 入场模式 */
export type EntryMode = 'full_pipeline' | 'from_script' | 'prompts_only' | 'style_recommend';

/** 流水线配置 */
export interface PipelineConfig {
  entryMode: EntryMode;
  duration: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  style: string;
  thresholdMatch: number;
  thresholdEnhance: number;
  skipScheduling: boolean;
  dryRun: boolean;
}

/** 流水线输出 */
export interface PipelineOutput {
  metadata: {
    pipeline: 'AutoDirectorPipeline';
    version: '3.0.0';
    generatedAt: string;
    userInput: string;
    config: PipelineConfig;
  };
  story: WriterOutput;
  direction: DirectorOutput;
  scheduling: SchedulerOutput;
  summary: {
    totalShots: number;
    totalDuration: number;
    stockMatched: number;
    enhanced: number;
    aiGenerated: number;
    costSaved: number;
  };
}

// ============================================================
// AI 视频质量评估 (v3.1)
// ============================================================

/** 视频评分结果 */
export interface VideoScore {
  semanticScore: number;           // 语义一致性 0-10
  audioVisualSyncScore: number;    // 视听一致性 0-10
  aestheticPhysicsScore: number;   // 美学与物理质量 0-10
  overallScore: number;            // 综合评分 0-10
  feedback: string;                // AI裁判评价
  issues: string[];                // 具体问题列表
  needsRegeneration: boolean;      // 是否需要重绘
  regenerationHint: string;        // 重绘提示词
  modelUsed: string;               // 评估模型
  evaluateTime: string;            // 评估时间
}

/** 质量阈值配置 */
export interface QualityThresholds {
  minSemanticScore: number;
  minAudioSyncScore: number;
  minAestheticScore: number;
  minOverallScore: number;
  autoRegenerateThreshold: number;
  suggestOptimizeMin: number;
  suggestOptimizeMax: number;
}

/** 质检判定结果 */
export type QualityVerdict = 'deliver' | 'review' | 'regenerate';

/** 质检关卡结果 */
export interface QualityGateResult {
  verdict: QualityVerdict;
  score: VideoScore;
  shouldAutoRegenerate: boolean;
  regenerationPrompt?: string;
}

// ============================================================
// DAG 工作流 (v3.1)
// ============================================================

/** DAG 节点状态 */
export type DAGNodeStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';

/** DAG 节点 */
export interface DAGNode {
  nodeId: string;
  name: string;
  agent: string;
  dependencies: string[];
  parallelGroup?: string;
  status: DAGNodeStatus;
  result?: Record<string, unknown>;
  error?: string;
  startTime?: number;
  endTime?: number;
}

/** DAG 执行日志 */
export interface DAGExecutionLog {
  nodeId: string;
  agent: string;
  status: DAGNodeStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

/** DAG 执行结果 */
export interface DAGExecutionResult {
  dagId: string;
  status: 'success' | 'partial' | 'failed';
  nodes: DAGNode[];
  logs: DAGExecutionLog[];
  totalDuration: number;
  completedCount: number;
  failedCount: number;
}

// ============================================================
// 角色设计体系 (v3.1)
// ============================================================

/** 角色类型 */
export type CharacterRole = 'protagonist' | 'antagonist' | 'ally' | 'rival' | 'mentor';

/** 角色弧线类型 */
export type CharacterArcType = 'growth' | 'decline' | 'flat' | 'tragic';

/** 冲突类型 (5种核心冲突) */
export type ConflictType = 'man_vs_self' | 'man_vs_man' | 'man_vs_society' | 'man_vs_nature' | 'man_vs_fate';

/** 角色关系 */
export interface CharacterRelationship {
  targetId: string;
  type: string;         // 关系类型：好友/对手/恋人/师徒等
  dynamic: string;      // 动态描述
}

/** 增强版角色小传 */
export interface EnhancedCharacterProfile extends Omit<CharacterProfile, 'relationships'> {
  role: CharacterRole;
  strength: string;
  flaw: string;
  desire: string;
  arcType: CharacterArcType;
  arcSummary: string;
  voice: string;        // 说话风格
  relationships: CharacterRelationship[];
  referenceSheet: string;
  catchphrase?: string;
  habit?: string;
  mainOutfit?: string;
  accessories?: string;
  colorPreference?: string;
}

// ============================================================
// 角色圣经 & 场景圣经 (v3.2 - Core Asset System)
// ============================================================

/** 角色圣经：核心角色资产文档 */
export interface CharacterBible {
  id: string;
  projectId: string;
  characterId: string;

  // 基础信息
  name: string;
  role: CharacterRole;
  aliases: string[];           // 别名/字号
  age: string;                 // 年龄/年龄段
  era: string;                 // 时代背景

  // 外观锚点（视觉一致性核心）
  appearance: {
    faceShape: string;         // 脸型：鹅蛋脸/国字脸/瓜子脸等
    skinTone: string;          // 肤色
    eyeShape: string;          // 眼型
    eyebrowStyle: string;      // 眉型
    noseShape: string;         // 鼻型
    lipShape: string;          // 唇型
    distinguishingFeatures: string[]; // 辨识特征（痣/疤痕/酒窝等）
    height: string;            // 身高
    build: string;             // 体型
  };

  // 妆发锚点
  grooming: {
    defaultHairstyle: string;  // 默认发型
    hairColor: string;         // 发色
    defaultMakeup: string;     // 默认妆容
    specialMakeup: string[];   // 特殊妆容（如战损妆/夜宴妆）
    accessories: string[];     // 标志性配饰
  };

  // 服装锚点
  wardrobe: {
    mainOutfit: string;        // 主服装描述
    mainOutfitColor: string;   // 主服装色系
    mainOutfitStyle: string;   // 主服装款式
    secondaryOutfits: Array<{
      name: string;            // 场景名
      description: string;     // 服装描述
    }>;
    fabricPreferences: string[]; // 面料偏好
  };

  // 性格弧线
  personality: {
    coreTraits: string[];      // 核心性格特质
    strength: string;          // 优势
    flaw: string;              // 弱点
    desire: string;            // 渴望
    fear: string;              // 恐惧
    voiceStyle: string;        // 说话风格
    catchphrase: string;       // 标志性台词
  };

  // 角色弧光
  arc: {
    arcType: CharacterArcType;
    startingState: string;     // 起始状态
    turningPoint: string;      // 转折点
    endingState: string;       // 终局状态
  };

  // 关系网
  relationships: CharacterRelationship[];

  // 视觉参考
  referenceImages: string[];   // 参考图URL列表
  colorPalette: string[];      // 角色专属配色方案

  // 元数据
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** 场景圣经：核心场景资产文档 */
export interface SceneBible {
  id: string;
  projectId: string;

  // 基础信息
  name: string;                // 场景名称
  location: string;            // 地点
  era: string;                 // 时代
  type: 'interior' | 'exterior' | 'mixed';  // 内景/外景/混合

  // 空间锚点（视觉一致性核心）
  spatial: {
    layout: string;            // 空间布局描述
    keyElements: string[];     // 关键空间元素
    dominantColors: string[];  // 主色调
    materials: string[];       // 主要材质
    architectural: string;     // 建筑风格特征
  };

  // 光影锚点
  lighting: {
    defaultTime: string;       // 默认时间（晨/午/暮/夜）
    defaultLight: string;      // 默认光照描述
    moodLighting: string;      // 情绪光照
    keyLightDirection: string; // 主光源方向
    shadowPattern: string;     // 阴影特征
  };

  // 氛围锚点
  atmosphere: {
    mood: string;              // 氛围情绪
    weather: string;           // 天气
    season: string;            // 季节
    soundDesign: string;       // 音效环境
    colorGrading: string;      // 色彩倾向
  };

  // 道具锚点
  props: Array<{
    name: string;
    description: string;
    placement: string;         // 摆放位置
    significance: 'critical' | 'important' | 'background';
  }>;

  // 视觉参考
  referenceImages: string[];
  colorPalette: string[];

  // 连续性约束
  continuity: {
    rules: string[];           // 连续性规则
    commonMistakes: string[];  // 常见错误提醒
  };

  // 元数据
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 镜头表 & 连续性看板 (v3.2 - Storyboard Workflow)
// ============================================================

/** 镜头状态 */
export type ShotStatus = 'planned' | 'generating' | 'review' | 'approved' | 'revision' | 'final';

/** 镜头表条目 */
export interface ShotListItem {
  shotId: string;
  sequence: number;
  sceneId: string;             // 关联场景圣经ID
  sceneName: string;           // 场景名称

  // 镜头描述
  shotType: ShotTypeCode;
  cameraMovement: CameraMovementCode;
  duration: number;            // 秒
  description: string;         // 镜头描述

  // 画面内容
  subject: string;             // 主体
  characterIds: string[];      // 出场角色（关联角色圣经ID）
  action: string;              // 动作描述
  dialogue: string;            // 对白/旁白
  emotion: EmotionTag;

  // 技术参数
  visualPrompt: string;        // AI画面提示词
  modelPreference: string;     // 首选生成模型
  aspectRatio: string;         // 画面比例
  referenceImage?: string;     // 参考图

  // 状态追踪
  status: ShotStatus;
  generatedUrl?: string;       // 生成结果URL
  reviewNotes: string[];       // 审核意见
  version: number;             // 版本号

  // 连续性
  continuityNotes: string;     // 连续性备注
  previousShotId?: string;     // 前一个镜头ID（用于连续性检查）
  nextShotId?: string;         // 后一个镜头ID
}

/** 连续性看板 */
export interface ContinuityBoard {
  projectId: string;
  scenes: Array<{
    sceneId: string;
    sceneName: string;
    shots: ShotListItem[];
    continuityIssues: Array<{
      type: 'color_mismatch' | 'prop_missing' | 'position_error' | 'lighting_change' | 'costume_change';
      shotA: string;
      shotB: string;
      description: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
  }>;
}

// ============================================================
// 风格预设 (v3.1)
// ============================================================

/** 风格预设代码 */
export type StylePresetCode =
  | 'cyberpunk' | 'chinese_ink' | 'anime' | 'cinematic_realism'
  | 'film_noir' | 'fantasy_epic' | 'minimalist'
  | 'retro_vintage' | 'steampunk' | 'surrealism';

/** 风格预设定义 */
export interface StylePreset {
  code: StylePresetCode;
  name: string;
  nameEn: string;
  keywords: string[];
  colorTone: string;
  atmosphere: string;
  visualRef: string;
  promptPrefix: string;
  negativePrompt: string;
  recommendedFor: string[];
}

// ============================================================
// 模型路由 (v3.1)
// ============================================================

/** 视频生成模型代码 */
export type VideoModelCode = 'sora_2' | 'kling_2_6' | 'seedance_2_0' | 'veo_3_1' | 'wan_2_6' | 'mamoda_2_5';

/** 模型能力评分 (1-5星) */
export interface ModelCapabilities {
  quality: number;             // 画质
  audioSync: number;           // 音画同步
  characterConsistency: number; // 角色一致性
  anime: number;               // 二次元
  realism: number;             // 写实
  speed: number;               // 速度
  cost: 'high' | 'medium' | 'low';
  maxDuration: number;         // 最长秒数
}

/** 模型定义 */
export interface VideoModelDefinition {
  code: VideoModelCode;
  name: string;
  capabilities: ModelCapabilities;
}

/** 场景特征 (模型路由输入) */
export interface SceneFeatures {
  description: string;
  duration: number;
  hasAudioSync: boolean;
  style: string;
  needsCharacterConsistency: boolean;
  contentType?: ContentTypeCode;
}

/** 模型可用状态 */
export type ModelAvailability = 'available' | 'degraded' | 'unavailable' | 'unknown';

/** 降级策略 */
export type FallbackStrategy = 'strict' | 'balanced' | 'cost_first' | 'quality_first';

/** 模型降级链节点 */
export interface FallbackStep {
  model: VideoModelCode;
  reason: string;          // 降级原因
  estimatedQualityDrop: number; // 预估画质下降百分比 0-100
  estimatedCostChange: number;  // 预估成本变化百分比 (-100 ~ +100, 负数=更便宜)
}

/** 推荐模型详情 */
export interface RecommendedModelDetail {
  model: VideoModelCode;
  score: number;
  rank: number;            // 排名 1=最优
  strengths: string[];     // 优势
  weaknesses: string[];    // 劣势
  suitableScenarios: string[]; // 适合场景
}

/** 模型路由结果 (增强版) */
export interface ModelRoutingResult {
  selectedModel: VideoModelCode;
  reason: string;
  scores: Record<VideoModelCode, number>;
  /** v3.2 新增 */
  selectionMode: 'auto' | 'recommended' | 'manual';
  recommendation?: {
    topPicks: RecommendedModelDetail[];    // Top-3 推荐
    bestForQuality: VideoModelCode;        // 画质最优
    bestForCost: VideoModelCode;           // 性价比最优
    bestForSpeed: VideoModelCode;          // 速度最优
  };
  fallbackChain?: FallbackStep[];          // 降级链
  availability: Record<VideoModelCode, ModelAvailability>;
  originalModel?: VideoModelCode;          // 降级前的原始模型(仅降级时有值)
}

/** 路由权重配置 */
export interface RoutingWeights {
  qualityMatch: number;       // 画质匹配度 0.30
  audioNeed: number;          // 音频需求 0.20
  durationMatch: number;      // 时长需求 0.15
  consistencyNeed: number;    // 一致性需求 0.20
  costEfficiency: number;     // 成本效率 0.15
}

// ============================================================
// 提示词工程 (v3.1)
// ============================================================

/** 图像提示词六层架构 */
export interface ImagePromptLayers {
  layer1_subject: string;       // 主体描述
  layer2_action: string;        // 动作/姿态
  layer3_composition: string;   // 景别/构图
  layer4_lighting: string;      // 光线/氛围
  layer5_environment: string;   // 环境/背景
  layer6_style: string;         // 风格/技术
}

/** 视频提示词八层架构 */
export interface VideoPromptLayers {
  layer1_camera: string;        // 运镜/运动
  layer2_subject: string;       // 主体
  layer3_actionChange: string;  // 动作变化
  layer4_envChange: string;     // 环境变化
  layer5_lightChange: string;   // 光线变化
  layer6_rhythm: string;        // 运镜节奏
  layer7_style: string;         // 风格
  layer8_techParams: string;    // 技术参数
}

/** 提示词策略类型 */
export type PromptStrategy =
  | 'standard_six_layer'
  | 'with_style_modifiers'
  | 'spatial_description'
  | 'character_reference'
  | 'atmosphere_first';

/** 视频提示词策略 */
export type VideoPromptStrategy =
  | 'slow_narrative'
  | 'fast_action'
  | 'environment_showcase'
  | 'character_closeup'
  | 'time_passage';

// ============================================================
// 导演方案输出 (v3.1)
// ============================================================

/** 输出格式 */
export type OutputFormat = 'director_plan' | 'screenplay' | 'both' | 'none';

/** 导演方案元数据 */
export interface DirectorPlanMeta {
  title: string;
  videoType: string;
  duration: number;
  aspectRatio: string;
  coreTheme: string;
  themeRefinement: string;
  narrativeStrategy: string;
  emotionalTone: string;
}

/** 三幕时间分配 */
export interface ThreeActTiming {
  act1Time: string; act1Duration: number; act1Percent: number; act1Range: string;
  act2Time: string; act2Duration: number; act2Percent: number; act2Range: string;
  act3Time: string; act3Duration: number; act3Percent: number; act3Range: string;
}

/** 技术规格 */
export interface TechnicalSpecs {
  resolution: string;
  fps: number;
  aspectRatio: string;
  codec: string;
  audioCodec: string;
}

// ============================================================
// Pipeline v3.1 升级
// ============================================================

/** v3.1 流水线输出 (扩展 PipelineOutput) */
export interface PipelineOutputV31 extends Omit<PipelineOutput, 'metadata'> {
  metadata: {
    pipeline: 'AutoDirectorPipeline';
    version: '3.1.0';
    generatedAt: string;
    userInput: string;
    config: PipelineConfig;
  };
  /** AI质量评估结果 (可选) */
  qualityAssessment?: QualityGateResult[];
  /** DAG工作流定义 (可选) */
  dagDefinition?: DAGNode[];
  /** 模型路由结果 */
  modelRoutings?: ModelRoutingResult[];
  /** 导演方案 Markdown (可选) */
  directorPlanMarkdown?: string;
  /** 影视剧本 Markdown (可选) */
  screenplayMarkdown?: string;
}

// ============================================================
// 人物一致性 & 连贯性体系 (v3.3 - Wan2.1 / huobao / waoowaoo 融入)
// ============================================================

/** 生成模式 — 扩展自 Wan2.1 的 FLF2V / I2V / VACE */
export type VideoGenerationMode =
  | 't2v'           // 文生视频
  | 'i2v'           // 图生视频（单帧参考）
  | 'flf2v'         // 首尾帧生视频（双帧锚定，最强一致性）
  | 'v2v'           // 视频转视频
  | 'vace_edit';    // VACE 视频编辑

/** 锚点强度 — 控制角色一致性严格程度 */
export type AnchorStrength = 'strict' | 'flexible' | 'creative';

/** 一致性检查项类型（扩展自 huobao 连贯性体系） */
export type ConsistencyCheckType =
  | 'face_mismatch'        // 面部不一致
  | 'costume_change'       // 服装突变
  | 'hair_style_change'    // 发型变化
  | 'accessory_missing'    // 配饰缺失
  | 'position_error'       // 位置错误
  | 'lighting_change'      // 光线突变
  | 'prop_missing'         // 道具缺失
  | 'color_mismatch'       // 颜色不匹配
  | 'continuity_break'     // 连续性断裂
  | 'body_proportion';     // 身体比例错误

/** 剪辑过渡类型（融合 huobao FFmpeg + NarratoAI 剪辑体系） */
export type ClipTransitionType = 'cut' | 'dissolve' | 'fade_black' | 'wipe' | 'zoom' | 'morph';

/** 剪辑片段（融合 NarratoAI clip_video + huobao ffmpeg-compose） */
export interface ClipSegment {
  id: string;
  shotId: string;
  videoUrl: string;
  trimStart: number;
  trimEnd: number;
  transition: {
    type: ClipTransitionType;
    duration: number;
  };
  audioTracks: Array<{
    type: 'dialogue' | 'narration' | 'bgm' | 'sfx';
    url?: string;
    volume: number;
    fadeIn?: number;
    fadeOut?: number;
  }>;
  subtitle?: {
    text: string;
    startTime: number;
    endTime: number;
  };
}

/** 字幕样式（来自 NarratoAI subtitle_merger） */
export interface SubtitleStyle {
  font: string;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  position: 'bottom' | 'top' | 'middle';
  alignment: 'left' | 'center' | 'right';
}

/** 剧情段落（来自 NarratoAI plot_extraction） */
export interface PlotSegment {
  id: string;
  sequence: number;
  summary: string;
  emotion: string;
  pacing: 'fast' | 'medium' | 'slow';
  keyFrameDescription: string;
  characterIds: string[];
  suggestedShotCount: number;
  suggestedDuration: number;
  dialogues: Array<{
    characterId: string;
    text: string;
    emotion: string;
  }>;
}
