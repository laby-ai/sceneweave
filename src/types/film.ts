/**
 * 影视创作 - 全类型定义
 * Film Creation Type Definitions
 * 
 * v3.0: 整合 video-production-platform skill
 * 新增: 叙事框架、景别枚举、运镜枚举、调度决策
 */

// ============================================================
// 基础实体类型
// ============================================================

/** 角色定义 */
export interface FilmCharacter {
  id: string;
  name: string;
  age: string;
  gender: '男' | '女' | '不限';
  appearance: string;        // 外貌描述（用于生图一致性）
  personality: string;       // 性格特征
  outfit?: string;           // 服装描述
  seed?: number;             // 固定seed确保一致性
  referenceImage?: string;   // 参考图URL
  /** v3.0: 角色小传扩展字段 */
  motivation?: string;       // 动机
  arc?: string;              // 角色弧光
  relationships?: Record<string, string>; // 与其他角色的关系
  /** 导演方案格式扩展 */
  characterArc?: string;     // 角色弧光描述
  signatureDetail?: string;  // 标志性细节
  fashionStyle?: string;     // 服饰风格
}

/** 场景定义 */
export interface FilmScene {
  id: string;
  sceneNumber: number;
  name: string;
  location: string;          // 地点
  timeOfDay: '日' | '夜' | '晨' | '黄昏';
  indoor: boolean;
  description: string;       // 环境描述
  mood: string;              // 氛围
  colorPalette?: string;     // 场景主色系(如: golden_amber_warm)
  lightingDir?: string;      // 光源方向(如: left_window, top_overhead)
  referenceImage?: string;   // 场景参考图
  /** 导演方案格式扩展 */
  atmosphere?: string;       // 氛围详细描述
  symbolism?: string;        // 象征意义
  keyProps?: string;         // 关键道具
  spatialRelation?: string;  // 空间关系
}

/** 分镜定义 */
export interface FilmShot {
  id: string;
  sceneId: string;
  sceneNumber: number;
  shotNumber: number;
  shotType: string;          // 全景/中景/特写/近景等
  cameraAngle: string;       // 推/拉/摇/移/跟/固定等
  cameraMovement: string;    // 运镜描述
  content: string;           // 画面内容（中文描述）
  contentEn: string;         // 画面内容（英文生图prompt）
  dialogue: string;          // 对白
  narration: string;         // 旁白
  action: string;            // 动作描述
  soundEffect: string;       // 音效
  duration: number;          // 时长（秒）
  characters: string[];      // 出镜角色ID列表
  referenceImage?: string;   // 分镜参考图URL
  videoUrl?: string;         // 生成的视频片段URL
  status: 'pending' | 'generating' | 'completed' | 'failed';
  /** v3.0: 导演指令扩展 */
  visualPrompt?: string;     // AI驱动的画面描述
  emotionTag?: string;       // 情绪标签
  transitionFrom?: string;   // 入场转场
  transitionTo?: string;     // 出场转场
  /** 导演方案格式扩展 */
  soundDesign?: string;      // 声音设计
  bgmChange?: string;        // BGM变化
  emotionIntensity?: number; // 情感强度 1-10
  colorNarrative?: string;   // 色彩叙事
  /** v3.0: 调度决策 */
  assetSource?: 'stock_match' | 'enhanced' | 'ai_generated' | '';
  matchScore?: number;
}

/** 场景剧本中的场景（第一部分·完整剧本格式） */
export interface ScreenplayScene {
  sceneNumber: number;         // 场景编号
  title: string;               // 场景标题（如"序幕 — 钢琴与数据"）
  interior: boolean;           // 内景/外景
  location: string;            // 地点
  timeOfDay: string;           // 时间（日/夜/晨/黄昏）
  stageDirections: string;     // 舞台指示/画面描述（完整长文，含运镜、走位、光效）
  dialogues: ScreenplayDialogue[];  // 对白列表
  cameraDirections: string;    // 运镜指示（推/拉/摇/移/跟/环绕/固定等）
  soundDesign: string;         // 声音设计（环境音/音效/静默/渐变等）
  transition: string;          // 转场（切至/溶至/淡入/淡出等）
}

/** 场景剧本中的对白 */
export interface ScreenplayDialogue {
  character: string;           // 角色名
  line: string;                // 台词
  direction?: string;          // 说话时的动作/表情指示（括号内）
}

/** 导演方案·角色卡（第二部分） */
export interface DirectorCharacterCard {
  id: string;
  name: string;
  age: string;
  gender: string;
  mbti?: string;               // MBTI类型
  arc: string;                 // 角色弧光（从...到...）
  motivation: string;          // 核心动机
  relationships: Record<string, string>; // 与其他角色关系
  signatureDetail: string;     // 标志性细节（小动作/口头禅/习惯）
  appearance: string;          // 外貌描述（生图用，需极其精确）
  outfit: string;              // 服装描述（生图用）
  consistencyRules: {          // 一致性约束
    mustInclude: string[];     // 每次出镜必须出现的元素
    mustExclude: string[];     // 禁止出现的元素
  };
}

/** 导演方案·场景卡（第二部分） */
export interface DirectorSceneCard {
  id: string;
  sceneNumber: number;
  name: string;
  location: string;
  timeOfDay: string;
  interior: boolean;
  visualDescription: string;   // 视觉描述（主色调+光源+构图+天气+空间感）
  fiveSenses: {                // 五感描述
    sight: string;             // 视觉
    hearing: string;           // 听觉
    touch?: string;            // 触觉
    smell?: string;            // 嗅觉
    taste?: string;            // 味觉
  };
  symbolism: string;           // 象征意义
  mood: string;                // 情绪氛围
  keyProps: string;            // 关键道具
  colorPalette: string;        // 色彩方案
}

/** 导演方案·道具卡 */
export interface DirectorPropCard {
  id: string;
  name: string;
  category: string;           // 武器/饰品/容器/文书/工具/食物/交通工具/其他
  material: string;           // 材质
  color: string;              // 颜色
  size: string;               // 尺寸
  significance: string;       // 剧情意义
  closeup: boolean;           // 是否需要特写镜头
  appearance: string;         // 生图级精确外观描述
  propEn: string;             // 英文生图提示词
}

/** 完整影视脚本 */
export interface FilmScript {
  title: string;
  subtitle?: string;
  totalDuration: number;
  style: string;             // 整体风格
  targetPlatform: string;    // 目标平台
  characters: FilmCharacter[];
  scenes: FilmScene[];
  shots: FilmShot[];
  narrationScript: string;   // 完整旁白脚本
  bgmSuggestion: string;     // BGM建议
  subtitleSuggestion: string;// 字幕建议
  /** v3.0: 叙事元数据 */
  contentType?: string;      // 内容类型 (short_drama/education/...)
  narrativeStructure?: string; // 叙事结构描述
  /** 导演方案格式扩展 */
  colorNarrativeLine?: string;  // 色彩叙事线（各幕主色调+饱和度变化）
  emotionCurve?: string;        // 情绪曲线描述
  aspectRatio?: string;         // 画幅比例
  coreTheme?: string;           // 核心主题
  /** 双部分格式（对齐PDF参考文档） */
  screenplay?: ScreenplayScene[];     // 第一部分：完整场景剧本
  directorPlan?: {
    characterCards: DirectorCharacterCard[];  // 角色卡
    sceneCards: DirectorSceneCard[];          // 场景卡
    propCards?: DirectorPropCard[];            // 道具卡
    consistencyNotes?: string;                // 一致性约束备注
  };
}

// ============================================================
// 绘影精灵 → 影视创作 数据传输
// ============================================================

/** 从绘影精灵传递到影视创作的数据包 */
export interface SmartAssistantTransferData {
  /** 故事梗概/创意描述 */
  storySummary: string;
  /** 风格偏好 */
  style?: string;
  /** 角色信息（含生成的参考图） */
  characters: Array<{
    name: string;
    description: string;
    imageUrl?: string;
    prompt?: string;
  }>;
  /** 场景信息（含生成的参考图） */
  scenes: Array<{
    name: string;
    description: string;
    imageUrl?: string;
    prompt?: string;
  }>;
  /** 分镜信息（含生成的画面） */
  shots: Array<{
    shotId: string;
    content: string;
    imageUrl?: string;
    prompt?: string;
  }>;
  /** 完整对话上下文（供影视创作参考） */
  conversationSummary?: string;
}

// ============================================================
// 任务与流程类型
// ============================================================

/** 影视创作任务状态 */
export type FilmStage =
  | 'input'           // 创意输入
  | 'script-review'   // 脚本审阅
  | 'storyboard'      // 分镜编排
  | 'generating'      // 素材生成中
  | 'composing'       // 视频合成中
  | 'result';         // 成片完成

/** 影视创作任务 */
export interface FilmTask {
  id: string;
  stage: FilmStage;
  script?: FilmScript;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  result?: {
    videoUrl: string;
    scriptJson: string;
    storyboardImages: string[];
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// API 请求/响应类型
// ============================================================

export interface DirectorGuidance {
  contentType?: string;       // 内容类型(如: 剧情/广告/MV)
  shotCount?: number;         // 导演建议镜头数
  estimatedDuration?: number; // 预估时长
  emotionCurve?: string;      // 情感曲线描述
  styleTags?: string[];       // 风格标签
  riskNotes?: string[];       // 风险提示
  modelRecommendation?: Record<string, string>; // 模型推荐
  cameraDirections?: string[]; // 摄像机运动建议列表
  transitionStyles?: string[]; // 转场风格建议列表
}

/** 编剧Agent请求 */
export interface CreateScriptRequest {
  text: string;              // 用户输入的故事文本
  style?: string;            // 风格偏好
  duration?: number;         // 目标时长（秒）
  platform?: string;         // 目标平台
  characterCount?: number;   // 角色数量限制
  domain?: string;           // 识别出的领域
  mood?: string;             // 情绪基调
  directorGuidance?: DirectorGuidance; // 自动化导演方案指引
  filmVisualStyle?: string;  // 全局视觉风格锁定（如"电影感""卡通"等，确保全场风格一致）
}

/** 编剧Agent响应 */
export interface CreateScriptResponse {
  script: FilmScript;
  message: string;
}

/** 分镜Agent请求 */
export interface CreateStoryboardRequest {
  script: FilmScript;
  imageStyle?: string;       // 生图风格
}

/** 分镜Agent响应 */
export interface CreateStoryboardResponse {
  shots: FilmShot[];
  message: string;
}

/** 素材生成请求 */
export interface GenerateAssetsRequest {
  script: FilmScript;
  shots: FilmShot[];
  generateType: 'character' | 'scene' | 'shot' | 'all';
}

/** 素材生成响应 */
export interface GenerateAssetsResponse {
  updatedShots: FilmShot[];
  updatedCharacters: FilmCharacter[];
  updatedScenes: FilmScene[];
}

/** 合成视频请求 */
export interface ComposeFilmRequest {
  taskId?: string;
  script: FilmScript;
  shots: FilmShot[];
  options: {
    subtitleEnabled: boolean;
    subtitleFontType: string;
    subtitlePosition: string;
    subtitleSize: number;
    subtitleColor: string;
    voiceType: string;
    speechSpeed: number;
    bgmSource: string;
    bgmVolume: number;
    transitionType: string;
  };
}

/** 合成视频响应 */
export interface ComposeFilmResponse {
  taskId: string;
  videoUrl: string;
  message: string;
}

/** 自动化导演流水线请求 */
export interface AutoDirectorRequest {
  input: string;
  entryMode?: 'full_pipeline' | 'from_script' | 'prompts_only' | 'style_recommend';
  contentType?: string;
  duration?: number;
  style?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  thresholdMatch?: number;
  thresholdEnhance?: number;
  skipScheduling?: boolean;
  dryRun?: boolean;
}
