/**
 * 平台能力矩阵 (v3.2)
 * 基于 AIGC 长视频平台研究报告，定义各视频生成平台的能力参数
 */

// ============================================================
// 平台能力矩阵
// ============================================================

/** 视频生成平台能力 */
export interface PlatformCapability {
  id: string;
  name: string;
  provider: string;
  website: string;

  // 核心能力
  maxDuration: number;           // 最大时长（秒）
  resolutions: string[];         // 支持分辨率
  aspectRatios: string[];        // 支持画面比例
  fps: number[];                 // 支持帧率

  // 生成能力
  textToVideo: boolean;          // 文生视频
  imageToVideo: boolean;         // 图生视频
  videoToVideo: boolean;         // 视频转视频
  videoExtend: boolean;          // 视频延长
  cameraControl: boolean;        // 运镜控制
  lipSync: boolean;              // 口型同步

  // 一致性能力
  characterConsistency: number;  // 角色一致性 0-10
  styleConsistency: number;      // 风格一致性 0-10
  motionQuality: number;         // 运动质量 0-10
  physicsQuality: number;        // 物理真实感 0-10

  // API参数
  apiModel: string;              // API模型标识
  apiCostPerSecond: number;      // 每秒成本（元）
  apiGenerationTime: string;     // 生成耗时参考

  // 优势场景
  bestFor: string[];             // 最佳适用场景
  limitations: string[];         // 已知限制

  // 状态
  status: 'available' | 'beta' | 'coming_soon' | 'deprecated';
  region: 'global' | 'cn' | 'both';

  // ── Open-Sora 融入：高级生成参数 ──
  /** 管线模式：t2v(直接文生视频) / t2i2v(先文生图再图生视频) / i2v(图生视频) */
  pipelineMode?: ('t2v' | 't2i2v' | 'i2v' | 'v2v')[];
  /** 运动评分支持：是否支持 motion score 控制运动幅度 */
  motionScoreSupport?: boolean;
  /** 运动评分范围 */
  motionScoreRange?: [number, number];
  /** 美学评分条件化：是否支持 aesthetic score 作为生成条件 */
  aestheticScoreSupport?: boolean;
  /** 提示词增强：是否支持 LLM 提示词精炼 */
  promptRefineSupport?: boolean;
  /** 振荡引导：是否支持 text/image guidance oscillation */
  oscillationGuidance?: boolean;
  /** 开源协议（开源平台专有） */
  openSourceLicense?: string;
  /** 模型参数量 */
  modelParams?: string;
  /** 训练成本参考 */
  trainingCost?: string;
  /** VBench 总分 */
  vbenchScore?: number;
}

/** 平台能力矩阵 */
export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  // ── Sora 2 ──
  {
    id: 'sora_2',
    name: 'Sora 2',
    provider: 'OpenAI',
    website: 'https://sora.com',
    maxDuration: 20,
    resolutions: ['1080p', '720p'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: true,
    videoExtend: true,
    cameraControl: true,
    lipSync: false,
    characterConsistency: 8,
    styleConsistency: 8,
    motionQuality: 9,
    physicsQuality: 8,
    apiModel: 'sora-2.0-turbo',
    apiCostPerSecond: 2.0,
    apiGenerationTime: '5-10分钟/20s',
    bestFor: ['电影级画面', '复杂运动', '物理真实', '多角色互动'],
    limitations: ['20秒上限', '无口型同步', '偶现物理穿模'],
    status: 'available',
    region: 'global',
  },

  // ── Kling 2.6 ──
  {
    id: 'kling_2_6',
    name: 'Kling 2.6',
    provider: '快手',
    website: 'https://klingai.com',
    maxDuration: 10,
    resolutions: ['1080p', '720p'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24, 30],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: true,
    videoExtend: true,
    cameraControl: true,
    lipSync: true,
    characterConsistency: 8,
    styleConsistency: 7,
    motionQuality: 8,
    physicsQuality: 7,
    apiModel: 'kling-v2-6',
    apiCostPerSecond: 0.8,
    apiGenerationTime: '2-5分钟/10s',
    bestFor: ['人物运动', '口型同步', '中国风', '运镜控制', '动作片'],
    limitations: ['10秒上限', '复杂场景偶现闪烁', '远距离细节下降'],
    status: 'available',
    region: 'both',
  },

  // ── Seedance 2.0 ──
  {
    id: 'seedance_2_0',
    name: 'Seedance 2.0',
    provider: '字节跳动',
    website: 'https://jimeng.jianying.com',
    maxDuration: 10,
    resolutions: ['1080p', '720p'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: false,
    videoExtend: true,
    cameraControl: true,
    lipSync: true,
    characterConsistency: 7,
    styleConsistency: 8,
    motionQuality: 8,
    physicsQuality: 7,
    apiModel: 'seedance-2.0-pro',
    apiCostPerSecond: 0.6,
    apiGenerationTime: '2-4分钟/10s',
    bestFor: ['舞蹈场景', '时尚短片', '中国古风', '口型同步'],
    limitations: ['10秒上限', '无视频转视频', '高速运动偶现模糊'],
    status: 'available',
    region: 'cn',
  },

  // ── Veo 3.1 ──
  {
    id: 'veo_3_1',
    name: 'Veo 3.1',
    provider: 'Google',
    website: 'https://deepmind.google/technologies/veo/',
    maxDuration: 8,
    resolutions: ['1080p', '720p'],
    aspectRatios: ['16:9', '9:16'],
    fps: [24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: true,
    videoExtend: false,
    cameraControl: true,
    lipSync: true,
    characterConsistency: 7,
    styleConsistency: 8,
    motionQuality: 8,
    physicsQuality: 8,
    apiModel: 'veo-3.1-generate',
    apiCostPerSecond: 1.5,
    apiGenerationTime: '3-6分钟/8s',
    bestFor: ['画面质量', '音频生成', '写实风格', '对话场景'],
    limitations: ['8秒上限', '不支持延长', '生成耗时较长'],
    status: 'available',
    region: 'global',
  },

  // ── Wan 2.6 ──
  {
    id: 'wan_2_6',
    name: 'Wan 2.6',
    provider: '阿里云',
    website: 'https://tongyi.aliyun.com/wanxiang/',
    maxDuration: 8,
    resolutions: ['1080p', '720p', '480p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    fps: [16, 24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: false,
    videoExtend: true,
    cameraControl: true,
    lipSync: false,
    characterConsistency: 7,
    styleConsistency: 7,
    motionQuality: 7,
    physicsQuality: 6,
    apiModel: 'wanx2.6-video',
    apiCostPerSecond: 0.3,
    apiGenerationTime: '1-3分钟/8s',
    bestFor: ['低成本批量生成', '快速预览', '风格化短片', 'FLF2V首尾帧生成', '角色一致性', '中文提示词'],
    limitations: ['8秒上限', '复杂运动质量下降', '无口型同步'],
    status: 'available',
    region: 'cn',
    // ── Wan2.1 融入：高级生成参数 ──
    pipelineMode: ['t2v', 't2i2v', 'i2v'],
    motionScoreSupport: false,
    aestheticScoreSupport: true,
    promptRefineSupport: true,
    openSourceLicense: 'Apache 2.0',
    modelParams: '14B',
    vbenchScore: 84.7,
  },

  // ── 可灵 1.6 (降级备选) ──
  {
    id: 'kling_1_6',
    name: 'Kling 1.6',
    provider: '快手',
    website: 'https://klingai.com',
    maxDuration: 10,
    resolutions: ['720p'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: false,
    videoExtend: true,
    cameraControl: false,
    lipSync: true,
    characterConsistency: 6,
    styleConsistency: 6,
    motionQuality: 7,
    physicsQuality: 6,
    apiModel: 'kling-v1-6',
    apiCostPerSecond: 0.4,
    apiGenerationTime: '1-3分钟/10s',
    bestFor: ['降级备选', '快速生成', '口型同步'],
    limitations: ['720p上限', '画面质量较低', '无运镜控制'],
    status: 'available',
    region: 'both',
  },

  // ── Runway Gen-3 Alpha ──
  {
    id: 'runway_gen3',
    name: 'Gen-3 Alpha',
    provider: 'Runway',
    website: 'https://runwayml.com/',
    maxDuration: 10,
    resolutions: ['1080p', '720p'],
    aspectRatios: ['16:9', '9:16'],
    fps: [24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: true,
    videoExtend: true,
    cameraControl: true,
    lipSync: false,
    characterConsistency: 7,
    styleConsistency: 8,
    motionQuality: 8,
    physicsQuality: 7,
    apiModel: 'gen3a-turbo',
    apiCostPerSecond: 1.2,
    apiGenerationTime: '2-5分钟/10s',
    bestFor: ['电影质感', '运镜控制', '风格化', '广告短片'],
    limitations: ['10秒上限', '无口型同步', '国内访问需代理'],
    status: 'available',
    region: 'global',
  },

  // ── Open-Sora 2.0 ──
  {
    id: 'open_sora_2',
    name: 'Open-Sora 2.0',
    provider: 'HPC-AI Tech (潞晨科技)',
    website: 'https://github.com/hpcaitech/Open-Sora',
    maxDuration: 5,
    resolutions: ['768p', '256p'],
    aspectRatios: ['16:9', '9:16', '1:1', '2.39:1'],
    fps: [24],
    textToVideo: true,
    imageToVideo: true,
    videoToVideo: true,
    videoExtend: true,
    cameraControl: false,
    lipSync: false,
    characterConsistency: 6,
    styleConsistency: 7,
    motionQuality: 7,
    physicsQuality: 7,
    apiModel: 'open-sora-v2',
    apiCostPerSecond: 0.1,
    apiGenerationTime: '1-4分钟/5s',
    bestFor: ['开源可控', '低成本部署', '自定义训练', '研究实验', '提示词增强', 'T2I2V管线', '运动评分控制'],
    limitations: ['5秒上限', '768p需多GPU', '运动评分需调参', '生成质量依赖提示词'],
    status: 'available',
    region: 'both',
    // ── Open-Sora 2.0 专属高级参数 ──
    pipelineMode: ['t2v', 't2i2v', 'i2v', 'v2v'],
    motionScoreSupport: true,
    motionScoreRange: [1, 15],
    aestheticScoreSupport: true,
    promptRefineSupport: true,
    oscillationGuidance: true,
    openSourceLicense: 'Apache-2.0',
    modelParams: '11B',
    trainingCost: '$200K',
    vbenchScore: 83.67,
  },
];

// ============================================================
// 平台选择策略
// ============================================================

/** 场景类型到推荐平台的映射 */
export const SCENE_PLATFORM_MAP: Record<string, string[]> = {
  // 对话场景：需要口型同步
  dialogue: ['kling_2_6', 'seedance_2_0', 'veo_3_1'],
  // 动作场景：需要运动质量
  action: ['sora_2', 'kling_2_6', 'runway_gen3'],
  // 风景/环境：需要画面质量
  landscape: ['sora_2', 'veo_3_1', 'seedance_2_0'],
  // 古风场景：中国风优化
  chinese_style: ['kling_2_6', 'seedance_2_0', 'wan_2_6'],
  // 舞蹈/运动：需要运动流畅
  dance: ['seedance_2_0', 'kling_2_6', 'sora_2'],
  // 低成本预览
  preview: ['wan_2_6', 'seedance_2_0', 'kling_1_6'],
  // 研究实验/自定义训练：开源可控
  research: ['open_sora_2', 'wan_2_6'],
  // 提示词驱动创作：需要精确提示词控制
  prompt_driven: ['open_sora_2', 'sora_2', 'runway_gen3'],
};

/** 预算级别 */
export type BudgetLevel = 'economy' | 'standard' | 'premium';

/** 预算到推荐平台的映射 */
export const BUDGET_PLATFORM_MAP: Record<BudgetLevel, string[]> = {
  economy: ['wan_2_6', 'seedance_2_0', 'kling_1_6', 'open_sora_2'],
  standard: ['kling_2_6', 'seedance_2_0', 'runway_gen3'],
  premium: ['sora_2', 'veo_3_1', 'kling_2_6'],
};

/** 获取平台能力 */
export function getPlatformCapability(id: string): PlatformCapability | undefined {
  return PLATFORM_CAPABILITIES.find(p => p.id === id);
}

/** 获取推荐平台 */
export function getRecommendedPlatforms(
  sceneType: string,
  budget: BudgetLevel = 'standard',
): PlatformCapability[] {
  const scenePlatforms = SCENE_PLATFORM_MAP[sceneType] || [];
  const budgetPlatforms = BUDGET_PLATFORM_MAP[budget];

  // 场景匹配优先，预算过滤
  const recommended = scenePlatforms
    .filter(id => budgetPlatforms.includes(id))
    .map(id => getPlatformCapability(id))
    .filter((p): p is PlatformCapability => p !== undefined);

  // 如果没有交集，返回预算级别的平台
  if (recommended.length === 0) {
    return budgetPlatforms
      .map(id => getPlatformCapability(id))
      .filter((p): p is PlatformCapability => p !== undefined);
  }

  return recommended;
}

// ============================================================
// Open-Sora 融入：T2I2V 管线 & 运动评分 & 提示词增强
// ============================================================

/** 生成管线模式 */
export type GenerationPipelineMode = 't2v' | 't2i2v' | 'i2v' | 'v2v';

/** 运动评分描述映射（Open-Sora 定义） */
export const MOTION_SCORE_LABELS: Record<string, string> = {
  '1': 'very low — 几乎静态，适合静态景观、建筑展示',
  '2-3': 'low — 微小运动，适合缓慢镜头、沉思场景',
  '4': 'fair — 适中运动，适合走秀、一般人物动作',
  '5-6': 'moderate — 适度运动，适合对话、日常活动',
  '7-8': 'high — 较大运动，适合舞蹈、运动场景',
  '9-10': 'very high — 剧烈运动，适合追逐、打斗场景',
  '11-15': 'extremely high — 极端运动，适合爆炸、特效',
};

/** 美学评分描述映射（Open-Sora 定义） */
export const AESTHETIC_SCORE_LABELS: Record<string, string> = {
  '<4': 'terrible — 低质量画面',
  '4-4.5': 'very poor — 较差画面',
  '4.5-5': 'poor — 一般画面',
  '5-5.5': 'fair — 中等画面',
  '5.5-6': 'good — 良好画面',
  '6-6.5': 'very good — 高质量画面',
  '≥6.5': 'excellent — 顶级画面',
};

/** T2I2V 管线步骤定义 */
export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  inputType: 'text' | 'image' | 'video';
  outputType: 'image' | 'video';
  modelRequired: string;
  estimatedTime: string;
}

/** T2I2V 两阶段管线配置（Open-Sora 核心管线） */
export const T2I2V_PIPELINE: PipelineStep[] = [
  {
    id: 't2i',
    name: '文本生图 (Text-to-Image)',
    description: '使用 Flux 模型将文本提示词生成高质量首帧图片，作为视频生成的参考帧',
    inputType: 'text',
    outputType: 'image',
    modelRequired: 'flux1-dev',
    estimatedTime: '10-30s',
  },
  {
    id: 'i2v',
    name: '图片生视频 (Image-to-Video)',
    description: '以首帧图片为参考，使用 Open-Sora MMDiT 模型生成连贯视频',
    inputType: 'image',
    outputType: 'video',
    modelRequired: 'open-sora-v2',
    estimatedTime: '1-4min',
  },
];

/** 根据运动评分获取推荐值 */
export function getRecommendedMotionScore(sceneType: string): number {
  const SCORE_MAP: Record<string, number> = {
    dialogue: 3,
    landscape: 2,
    portrait: 2,
    fashion: 4,
    dance: 7,
    action: 9,
    cooking: 4,
    tutorial: 2,
    product: 3,
    cinematic: 5,
  };
  return SCORE_MAP[sceneType] ?? 4;
}

/** 构建带运动评分和美学评分的提示词后缀（Open-Sora 风格） */
export function buildScoreSuffix(options: {
  motionScore?: number;
  aestheticScore?: number;
  cameraMotion?: string;
}): string {
  const parts: string[] = [];

  if (options.aestheticScore !== undefined) {
    const label = options.aestheticScore >= 6.5 ? 'excellent'
      : options.aestheticScore >= 6 ? 'very good'
      : options.aestheticScore >= 5.5 ? 'good'
      : options.aestheticScore >= 5 ? 'fair'
      : options.aestheticScore >= 4.5 ? 'poor'
      : 'very poor';
    parts.push(`The aesthetic score is ${label}`);
  }

  if (options.motionScore !== undefined) {
    const label = options.motionScore >= 20 ? 'extremely high'
      : options.motionScore >= 10 ? 'very high'
      : options.motionScore >= 5 ? 'high'
      : options.motionScore >= 2 ? 'fair'
      : options.motionScore >= 0.5 ? 'low'
      : 'very low';
    parts.push(`the motion strength is ${label}`);
  }

  if (options.cameraMotion) {
    parts.push(`camera motion: ${options.cameraMotion}`);
  }

  return parts.length > 0 ? parts.join(', ') + '.' : '';
}

/** 选择最优管线模式 */
export function selectPipelineMode(
  hasImage: boolean,
  hasVideo: boolean,
  preferDirect: boolean = false,
): GenerationPipelineMode {
  if (hasVideo) return 'v2v';
  if (hasImage) return 'i2v';
  if (preferDirect) return 't2v';
  // 默认走 T2I2V（Open-Sora 推荐，质量更优）
  return 't2i2v';
}

// ============================================================
// Wan2.1 融入：FLF2V 首尾帧管线 & VACE 模型
// ============================================================

/** FLF2V (First-Last Frame to Video) 管线 — 最强人物一致性方案 */
export const FLF2V_PIPELINE: PipelineStep[] = [
  {
    id: 'first_frame',
    name: '首帧生成 (First Frame Generation)',
    description: '根据文本描述生成高质量首帧图片，锁定角色外观、场景布局、光影基调',
    inputType: 'text',
    outputType: 'image',
    modelRequired: 'wan2.1-t2i / flux1-dev',
    estimatedTime: '10-30s',
  },
  {
    id: 'last_frame',
    name: '尾帧生成 (Last Frame Generation)',
    description: '根据首帧+运动描述生成尾帧图片，确保动作终态与角色一致性',
    inputType: 'image',
    outputType: 'image',
    modelRequired: 'wan2.1-i2i',
    estimatedTime: '10-30s',
  },
  {
    id: 'flf2v',
    name: '首尾帧生视频 (FLF2V Generation)',
    description: '以首帧+尾帧为双锚点，生成首尾帧之间自然过渡的视频，保证起止一致性',
    inputType: 'image',
    outputType: 'video',
    modelRequired: 'wan2.1-flf2v-14B',
    estimatedTime: '2-5min',
  },
];

/** VACE (Video Creation and Editing) 能力 — Wan2.1 全能视频创作模型 */
export interface VACECapability {
  /** 支持的创作模式 */
  modes: Array<{
    id: string;
    name: string;
    nameEn: string;
    description: string;
    inputRequired: string[];
    outputType: string;
  }>;
  /** 支持的编辑操作 */
  editOperations: string[];
  /** 角色一致性能力 */
  characterConsistencyLevel: number; // 0-10
}

/** Wan2.1 VACE 模型能力定义 */
export const VACE_CAPABILITIES: VACECapability = {
  modes: [
    {
      id: 't2v',
      name: '文生视频',
      nameEn: 'Text-to-Video',
      description: '从文本描述直接生成视频，支持中英文双语提示词',
      inputRequired: ['prompt'],
      outputType: 'video',
    },
    {
      id: 'i2v',
      name: '图生视频',
      nameEn: 'Image-to-Video',
      description: '以图片为参考帧生成视频，CLIP条件化保证角色一致性',
      inputRequired: ['prompt', 'image'],
      outputType: 'video',
    },
    {
      id: 'flf2v',
      name: '首尾帧生视频',
      nameEn: 'First-Last Frame to Video',
      description: '首帧+尾帧双锚点生成，最强角色一致性保证',
      inputRequired: ['prompt', 'firstFrame', 'lastFrame'],
      outputType: 'video',
    },
    {
      id: 'vace_edit',
      name: '视频编辑',
      nameEn: 'Video Editing',
      description: '基于 VACE 的视频编辑：角色替换、背景替换、风格迁移',
      inputRequired: ['video', 'editMask'],
      outputType: 'video',
    },
    {
      id: 'controllist',
      name: '可控视频生成',
      nameEn: 'Controllable Video Generation',
      description: '通过姿态图/深度图/边缘图等控制信号引导视频生成',
      inputRequired: ['prompt', 'controlSignal'],
      outputType: 'video',
    },
  ],
  editOperations: [
    'character_replace',     // 角色替换
    'background_replace',    // 背景替换
    'style_transfer',        // 风格迁移
    'pose_guided',           // 姿态引导
    'depth_guided',          // 深度引导
    'edge_guided',           // 边缘引导
    'inpainting',            // 区域修复
    'outpainting',           // 画面扩展
  ],
  characterConsistencyLevel: 8,
};

/** Wan2.1 I2V 负面提示词 — 减少镜头晃动和人物变形 */
export const WAN_I2V_NEGATIVE_PROMPT = '镜头晃动，画面模糊，人物变形，多余肢体，面部扭曲，服装变色，发型改变，低质量，水印，文字';

/** Wan2.1 提示词扩展规则 — 中英文双语适配 */
export const WAN_PROMPT_EXTEND_RULES = {
  /** 中文提示词扩展：添加动作细节、光影描述、氛围词 */
  zh: {
    motionVerbs: {
      '走': '脚步稳健地向前走',
      '跑': '急速奔跑，衣袂翻飞',
      '转': '缓缓转身，目光随之移动',
      '坐': '优雅落座，衣摆自然垂落',
      '站': '静静站立，目光望向远方',
      '笑': '嘴角微微上扬，眉眼弯弯',
      '哭': '泪水在眼眶中打转，鼻尖微红',
      '看': '目光聚焦，微微侧头',
    },
    lightingByScene: {
      '朝堂': '金碧辉煌的殿堂，顶部明灯照耀',
      '花园': '晨光透过花枝洒落斑驳光影',
      '战场': '烟尘弥漫中透出昏黄光柱',
      '闺阁': '烛光摇曳，纱帘滤出柔光',
      '街市': '日光斜照，人流光影交错',
      '雪景': '雪光映照，天色苍白微蓝',
      '月夜': '月光如银，清辉洒满庭院',
    },
  },
  /** 英文提示词扩展：遵循 Wan2.1 的英文提示词规范 */
  en: {
    motionVerbs: {
      'walk': 'walking steadily forward with natural gait',
      'run': 'running swiftly with clothes fluttering',
      'turn': 'turning around slowly, gaze following the movement',
      'sit': 'sitting down gracefully, garment draping naturally',
      'stand': 'standing still, gazing into the distance',
    },
    cameraStyles: {
      'tracking': 'smooth tracking shot following the subject',
      'dolly': 'slow dolly in revealing the scene',
      'crane': 'crane shot sweeping over the landscape',
      'handheld': 'slight handheld camera movement for realism',
    },
  },
} as const;
