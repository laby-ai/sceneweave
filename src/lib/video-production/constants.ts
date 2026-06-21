/**
 * 视频生产平台 v3.1 - 核心常量定义
 * 整合自 video-production-platform skill v3.1.0
 */

import type {
  ShotTypeDefinition, ShotTypeCode,
  CameraMovementDefinition, CameraMovementCode,
  TransitionDefinition, TransitionCode,
  NarrativeTemplate, ContentTypeCode,
  StylePreset, StylePresetCode,
  VideoModelDefinition, VideoModelCode,
  QualityThresholds,
  RoutingWeights,
  ModelAvailability, FallbackStrategy,
} from './types';

// ============================================================
// 8种景别
// ============================================================

export const SHOT_TYPES: Record<ShotTypeCode, ShotTypeDefinition> = {
  ECU: { code: 'ECU', name: '大特写', focus: '面部微表情', emotion: '紧张/震撼' },
  CU:  { code: 'CU',  name: '特写', focus: '面部/物体细节', emotion: '关注/强调' },
  MCU: { code: 'MCU', name: '中特写', focus: '上半身', emotion: '交流/对话' },
  MS:  { code: 'MS',  name: '中景', focus: '膝盖以上', emotion: '自然/日常' },
  MWS: { code: 'MWS', name: '中全景', focus: '全身', emotion: '关系/互动' },
  WS:  { code: 'WS',  name: '全景', focus: '整个人物与环境', emotion: '交代/氛围' },
  EWS: { code: 'EWS', name: '大远景', focus: '广阔场景', emotion: '宏大/孤独' },
  EST: { code: 'EST', name: '建立镜头', focus: '环境全貌', emotion: '开场/转场' },
};

// ============================================================
// 13种运镜
// ============================================================

export const CAMERA_MOVEMENTS: Record<CameraMovementCode, CameraMovementDefinition> = {
  static:    { code: 'static',    name: '固定',   intensity: 'low',         drama: '稳定/冷漠' },
  dolly_in:  { code: 'dolly_in',  name: '推进',   intensity: 'medium',      drama: '聚焦/紧张' },
  dolly_out: { code: 'dolly_out', name: '拉远',   intensity: 'medium',      drama: '退出/释然' },
  tracking:  { code: 'tracking',  name: '跟踪',   intensity: 'medium-high', drama: '参与/跟随' },
  pan_left:  { code: 'pan_left',  name: '左摇',   intensity: 'low',         drama: '展示/引导' },
  pan_right: { code: 'pan_right', name: '右摇',   intensity: 'low',         drama: '展示/引导' },
  tilt_up:   { code: 'tilt_up',   name: '上摇',   intensity: 'low',         drama: '仰望/尊敬' },
  tilt_down: { code: 'tilt_down', name: '下摇',   intensity: 'low',         drama: '俯视/压制' },
  crane_up:  { code: 'crane_up',  name: '升镜头', intensity: 'high',        drama: '升华/希望' },
  crane_down:{ code: 'crane_down',name: '降镜头', intensity: 'high',        drama: '压抑/降落' },
  zoom_in:   { code: 'zoom_in',   name: 'ZOOM推进', intensity: 'medium',    drama: '聚焦细节' },
  zoom_out:  { code: 'zoom_out',  name: 'ZOOM拉远', intensity: 'medium',    drama: '扩展视野' },
  handheld:  { code: 'handheld',  name: '手持',   intensity: 'high',        drama: '真实/紧张/纪录片感' },
};

// ============================================================
// 7种转场
// ============================================================

export const TRANSITIONS: Record<TransitionCode, TransitionDefinition> = {
  cut:        { code: 'cut',        name: '硬切',   duration: 0,   drama: '干脆/快节奏' },
  dissolve:   { code: 'dissolve',   name: '叠化',   duration: 0.5, drama: '柔和/时间流逝' },
  fade_in:    { code: 'fade_in',    name: '淡入',   duration: 0.3, drama: '开始/清醒' },
  fade_out:   { code: 'fade_out',   name: '淡出',   duration: 0.3, drama: '结束/沉思' },
  wipe:       { code: 'wipe',       name: '划像',   duration: 0.4, drama: '对比/跳转' },
  flash:      { code: 'flash',      name: '闪白',   duration: 0.1, drama: '冲击/回忆' },
  match_cut:  { code: 'match_cut',  name: '匹配剪辑', duration: 0, drama: '流畅/关联' },
};

// ============================================================
// 6种叙事模板
// ============================================================

export const NARRATIVE_TEMPLATES: Record<ContentTypeCode, NarrativeTemplate> = {
  short_drama: {
    name: '爽文/短剧',
    keywords: ['逆袭', '打脸', '复仇', '豪门', '金手指', '爽', '霸总', '甜宠', '虐恋', '重生'],
    structure: [
      { type: 'setup',      emotion: 'anticipation',  pacing: 'slow',   desc: '铺垫-展示现状' },
      { type: 'conflict',   emotion: 'tension',       pacing: 'medium', desc: '冲突-受辱时刻' },
      { type: 'climax',     emotion: 'high_excitement',pacing: 'fast',  desc: '高潮-爆发反击' },
      { type: 'resolution', emotion: 'satisfaction',  pacing: 'medium', desc: '爽点-完美收场' },
      { type: 'transition', emotion: 'curiosity',     pacing: 'fast',   desc: '悬念-新冲突预告' },
    ],
    shotDistribution: { ECU: 30, CU: 35, MS: 20, WS: 15 },
    pacing: 'fast',
    transitionStyle: 'cut',
  },
  education: {
    name: '科普/资讯',
    keywords: ['原理解释', '知识', '科普', '百科', '科学', '原理', '是什么', '为什么', '如何', '教程'],
    structure: [
      { type: 'setup',      emotion: 'curiosity',     pacing: 'medium', desc: '开场-抛出问题' },
      { type: 'conflict',   emotion: 'focus',         pacing: 'slow',   desc: '分点论述' },
      { type: 'conflict',   emotion: 'focus',         pacing: 'slow',   desc: '原理解析' },
      { type: 'resolution', emotion: 'satisfaction',  pacing: 'medium', desc: '总结升华' },
    ],
    shotDistribution: { WS: 30, MS: 30, CU: 25, ECU: 15 },
    pacing: 'medium',
    transitionStyle: 'dissolve',
  },
  documentary: {
    name: '纪录片/品牌片',
    keywords: ['历史', '自然', '品牌', '历程', '情感', '真实', '记录', '纪实', '人文', '传承'],
    structure: [
      { type: 'establishing', emotion: 'awe',           pacing: 'slow',   desc: '建立镜头' },
      { type: 'setup',        emotion: 'contemplation', pacing: 'slow',   desc: '铺垫背景' },
      { type: 'conflict',     emotion: 'tension',       pacing: 'medium', desc: '核心叙事' },
      { type: 'resolution',   emotion: 'inspiration',   pacing: 'slow',   desc: '升华结尾' },
    ],
    shotDistribution: { EWS: 25, WS: 35, MS: 25, CU: 15 },
    pacing: 'slow',
    transitionStyle: 'dissolve',
  },
  marketing: {
    name: '产品营销/口播',
    keywords: ['痛点', '卖点', '促销', '种草', '推荐', '购买', '优惠', '测评', '开箱', '带货'],
    structure: [
      { type: 'setup',      emotion: 'curiosity',   pacing: 'fast',   desc: '开场抓眼球(3秒)' },
      { type: 'conflict',   emotion: 'pain_point',  pacing: 'medium', desc: '抛出痛点' },
      { type: 'conflict',   emotion: 'solution',    pacing: 'medium', desc: '产品解决方案' },
      { type: 'resolution', emotion: 'action',      pacing: 'fast',   desc: '引导下单' },
    ],
    shotDistribution: { CU: 40, MCU: 30, MS: 20, WS: 10 },
    pacing: 'fast',
    transitionStyle: 'cut',
  },
  news: {
    name: '新闻/资讯',
    keywords: ['新闻', '报道', '事件', '最新', '突发', '资讯', '热点', '通知', '公告'],
    structure: [
      { type: 'establishing', emotion: 'neutral',  pacing: 'medium', desc: '事件概览' },
      { type: 'conflict',     emotion: 'focus',    pacing: 'medium', desc: '详细报道' },
      { type: 'resolution',   emotion: 'summary',  pacing: 'fast',   desc: '总结点评' },
    ],
    shotDistribution: { MCU: 50, CU: 30, WS: 20 },
    pacing: 'medium',
    transitionStyle: 'cut',
  },
  general: {
    name: '通用类型',
    keywords: [],
    structure: [
      { type: 'setup',      emotion: 'neutral',     pacing: 'medium', desc: '开场' },
      { type: 'conflict',   emotion: 'engagement',  pacing: 'medium', desc: '展开' },
      { type: 'resolution', emotion: 'satisfaction', pacing: 'medium', desc: '结尾' },
    ],
    shotDistribution: { MS: 40, CU: 30, WS: 30 },
    pacing: 'medium',
    transitionStyle: 'cut',
  },
  // ── 来自行业调研的扩展叙事模板 ──
  period_drama: {
    name: '年代/古风',
    keywords: ['古装', '宫廷', '朝代', '民国', '武侠', '仙侠', '历史', '世家', '宗族', '礼制'],
    structure: [
      { type: 'establishing', emotion: 'awe',            pacing: 'slow',   desc: '建立-朝代氛围' },
      { type: 'setup',        emotion: 'anticipation',   pacing: 'slow',   desc: '铺垫-身份处境' },
      { type: 'conflict',     emotion: 'tension',        pacing: 'medium', desc: '冲突-礼制/权力' },
      { type: 'climax',       emotion: 'high_excitement', pacing: 'fast',  desc: '高潮-命运抉择' },
      { type: 'resolution',   emotion: 'contemplation',  pacing: 'slow',  desc: '余韵-历史回响' },
    ],
    shotDistribution: { WS: 30, MS: 30, CU: 25, ECU: 15 },
    pacing: 'slow',
    transitionStyle: 'dissolve',
  },
  fantasy: {
    name: '奇幻/魔幻',
    keywords: ['魔法', '精灵', '龙', '异世界', '修炼', '仙侠', '幻境', '法术', '神兽', '秘境', '童话', '寓言', '传说', '冒险', '森林', '城堡', '公主', '王子', '王国', '神话'],
    structure: [
      { type: 'establishing', emotion: 'awe',            pacing: 'slow',  desc: '建立-奇幻世界观' },
      { type: 'setup',        emotion: 'curiosity',      pacing: 'medium', desc: '铺垫-使命召唤' },
      { type: 'conflict',     emotion: 'tension',        pacing: 'fast',  desc: '冲突-试炼/对抗' },
      { type: 'climax',       emotion: 'high_excitement', pacing: 'fast',  desc: '高潮-决战时刻' },
      { type: 'resolution',   emotion: 'inspiration',    pacing: 'medium', desc: '结局-新纪元' },
    ],
    shotDistribution: { EWS: 25, WS: 25, MS: 25, CU: 25 },
    pacing: 'medium',
    transitionStyle: 'morph',
  },
  cyberpunk: {
    name: '赛博/科幻',
    keywords: ['赛博', 'AI', '未来', '机器人', '虚拟现实', '黑客', '义体', '元宇宙', '太空', '量子'],
    structure: [
      { type: 'establishing', emotion: 'curiosity',      pacing: 'medium', desc: '建立-未来世界' },
      { type: 'setup',        emotion: 'anticipation',   pacing: 'medium', desc: '铺垫-技术困境' },
      { type: 'conflict',     emotion: 'tension',        pacing: 'fast',   desc: '冲突-人机对抗' },
      { type: 'climax',       emotion: 'high_excitement', pacing: 'fast',  desc: '高潮-意识觉醒' },
      { type: 'resolution',   emotion: 'contemplation',  pacing: 'slow',  desc: '反思-何为人类' },
    ],
    shotDistribution: { CU: 35, MS: 30, WS: 20, ECU: 15 },
    pacing: 'fast',
    transitionStyle: 'glitch',
  },
  folk_culture: {
    name: '非遗/民俗',
    keywords: ['非遗', '民俗', '传统', '手艺', '匠人', '传承', '祭祀', '节庆', '织锦', '陶瓷'],
    structure: [
      { type: 'establishing', emotion: 'awe',           pacing: 'slow',  desc: '建立-文化土壤' },
      { type: 'setup',        emotion: 'contemplation', pacing: 'slow',  desc: '铺垫-技艺传承' },
      { type: 'conflict',     emotion: 'tension',       pacing: 'medium', desc: '冲突-传承困境' },
      { type: 'climax',       emotion: 'inspiration',   pacing: 'medium', desc: '高潮-匠艺绽放' },
      { type: 'resolution',   emotion: 'satisfaction',  pacing: 'slow',  desc: '升华-薪火相传' },
    ],
    shotDistribution: { CU: 35, MS: 30, WS: 25, ECU: 10 },
    pacing: 'slow',
    transitionStyle: 'dissolve',
  },
};

// ============================================================
// 增强操作映射
// ============================================================

export interface EnhanceOperationConfig {
  minScore: number;
  target: number;
  label: string;
}

export const ENHANCE_OPERATIONS: Record<string, EnhanceOperationConfig> = {
  super_resolution:    { minScore: 0.3, target: 0.85, label: '超分辨率' },
  denoise:             { minScore: 0.4, target: 0.80, label: '去噪' },
  frame_interpolation: { minScore: 0.5, target: 0.85, label: '插帧' },
  background_removal:  { minScore: 0.3, target: 0.90, label: '背景移除' },
  color_correction:    { minScore: 0.4, target: 0.85, label: '色彩校正' },
};

// ============================================================
// 成本权重
// ============================================================

export const COST_WEIGHTS = {
  stock_match: 0.01,
  enhanced: 0.15,
  ai_generate: 1.0,
} as const;

// ============================================================
// 模型降级与推荐体系 (v3.2)
// ============================================================

/** 默认降级链 — 按综合能力降序排列 */
export const DEFAULT_FALLBACK_CHAIN: VideoModelCode[] = [
  'sora_2',
  'kling_2_6',
  'seedance_2_0',
  'veo_3_1',
  'wan_2_6',
  'mamoda_2_5',
];

/** 按场景的推荐降级策略 */
export const SCENARIO_FALLBACK_MAP: Record<string, VideoModelCode[]> = {
  /** 写实/电影 — 优先画质和一致性 */
  cinematic:    ['sora_2', 'kling_2_6', 'veo_3_1', 'seedance_2_0', 'wan_2_6', 'mamoda_2_5'],
  /** 二次元/动画 — 优先动漫能力 */
  anime:        ['seedance_2_0', 'wan_2_6', 'sora_2', 'kling_2_6', 'veo_3_1', 'mamoda_2_5'],
  /** 口播/营销 — 优先速度和成本 */
  commercial:   ['wan_2_6', 'mamoda_2_5', 'kling_2_6', 'seedance_2_0', 'veo_3_1', 'sora_2'],
  /** 长视频 — 优先时长支持 */
  long_form:    ['sora_2', 'veo_3_1', 'kling_2_6', 'seedance_2_0', 'wan_2_6', 'mamoda_2_5'],
  /** 音画同步 — 优先音频能力 */
  audio_sync:   ['veo_3_1', 'sora_2', 'kling_2_6', 'seedance_2_0', 'wan_2_6', 'mamoda_2_5'],
  /** 性价比优先 — 最便宜也能用 */
  cost_first:   ['wan_2_6', 'mamoda_2_5', 'seedance_2_0', 'kling_2_6', 'veo_3_1', 'sora_2'],
};

/** 模型默认可用状态 (生产环境应由配置中心动态下发) */
export const DEFAULT_MODEL_AVAILABILITY: Record<VideoModelCode, ModelAvailability> = {
  sora_2:       'available',
  kling_2_6:    'available',
  seedance_2_0: 'available',
  veo_3_1:      'available',
  wan_2_6:      'available',
  mamoda_2_5:   'available',
};

/** 降级策略配置 */
export const FALLBACK_STRATEGY_CONFIG: Record<FallbackStrategy, {
  label: string;
  description: string;
  maxFallbackSteps: number;     // 最大降级次数
  qualityDropThreshold: number; // 允许的最大画质下降百分比
  preferCostOverQuality: boolean;
}> = {
  strict: {
    label: '严格模式',
    description: '首选不可用时仅降级到同档位模型，保证画质',
    maxFallbackSteps: 1,
    qualityDropThreshold: 10,
    preferCostOverQuality: false,
  },
  balanced: {
    label: '均衡模式',
    description: '允许跨档位降级，平衡画质与可用性',
    maxFallbackSteps: 2,
    qualityDropThreshold: 30,
    preferCostOverQuality: false,
  },
  cost_first: {
    label: '成本优先',
    description: '优先选择低成本模型，仅在高需求场景升级',
    maxFallbackSteps: 3,
    qualityDropThreshold: 50,
    preferCostOverQuality: true,
  },
  quality_first: {
    label: '画质优先',
    description: '始终选择画质最优的可用模型，不考虑成本',
    maxFallbackSteps: 3,
    qualityDropThreshold: 100,
    preferCostOverQuality: false,
  },
};

/** 模型优势/劣势标签 */
export const MODEL_PROFILE_TAGS: Record<VideoModelCode, {
  strengths: string[];
  weaknesses: string[];
  suitableScenarios: string[];
}> = {
  sora_2: {
    strengths: ['画质顶级', '写实能力最强', '角色一致性高', '长时长支持'],
    weaknesses: ['成本最高', '生成速度较慢', '名额可能受限'],
    suitableScenarios: ['电影级写实场景', '长视频制作', '高一致性角色视频'],
  },
  kling_2_6: {
    strengths: ['画质优秀', '写实与动画均衡', '社区生态丰富', '稳定性好'],
    weaknesses: ['音画同步一般', '成本中高'],
    suitableScenarios: ['短剧/微电影', '产品展示', '动画制作'],
  },
  seedance_2_0: {
    strengths: ['二次元能力突出', '速度快', '成本适中'],
    weaknesses: ['写实能力一般', '角色一致性中等', '时长受限'],
    suitableScenarios: ['动漫/二次元', '短视频', '创意动画'],
  },
  veo_3_1: {
    strengths: ['音画同步最强', '画质顶级', '时长支持好'],
    weaknesses: ['成本最高', '速度较慢'],
    suitableScenarios: ['配音视频', 'MV制作', '口播视频', '长视频'],
  },
  wan_2_6: {
    strengths: ['成本最低', '速度最快', '稳定性好'],
    weaknesses: ['画质中等', '角色一致性一般'],
    suitableScenarios: ['快速原型', '营销短视频', '批量生成'],
  },
  mamoda_2_5: {
    strengths: ['成本低', '速度较快', '风格化能力强'],
    weaknesses: ['写实能力一般', '时长受限'],
    suitableScenarios: ['风格化短片', '实验视频', '预算有限项目'],
  },
};

/** 模型间画质/成本估算对比 (相对于 sora_2 的百分比) */
export const MODEL_RELATIVE_METRICS: Record<VideoModelCode, {
  qualityPercent: number;   // 画质相对值
  costPercent: number;      // 成本相对值
  speedPercent: number;     // 速度相对值
}> = {
  sora_2:       { qualityPercent: 100, costPercent: 100, speedPercent: 50 },
  kling_2_6:    { qualityPercent: 90,  costPercent: 70,  speedPercent: 65 },
  seedance_2_0: { qualityPercent: 75,  costPercent: 50,  speedPercent: 80 },
  veo_3_1:      { qualityPercent: 95,  costPercent: 95,  speedPercent: 45 },
  wan_2_6:      { qualityPercent: 60,  costPercent: 20,  speedPercent: 95 },
  mamoda_2_5:   { qualityPercent: 65,  costPercent: 25,  speedPercent: 90 },
};

// ============================================================
// 内容类型识别表 (与 SKILL.md 一致)
// ============================================================

export const CONTENT_TYPE_TABLE: Array<{
  code: ContentTypeCode;
  name: string;
  keywords: string[];
  narrativeStructure: string;
  shotDistribution: string;
  pacing: string;
}> = [
  { code: 'short_drama',  name: '爽文/短剧',     keywords: ['逆袭','打脸','复仇','霸总'], narrativeStructure: '铺垫→受辱→爆发→爽点→悬念', shotDistribution: '特写70%', pacing: '快' },
  { code: 'education',    name: '科普/资讯',     keywords: ['知识','原理','为什么'],       narrativeStructure: '总分总',               shotDistribution: '中景60%', pacing: '中' },
  { code: 'documentary',  name: '纪录片/品牌',   keywords: ['历史','品牌','情感'],         narrativeStructure: '线性叙事',             shotDistribution: '全景60%', pacing: '慢' },
  { code: 'marketing',    name: '产品营销',      keywords: ['痛点','卖点','种草'],         narrativeStructure: 'AIDA模型',             shotDistribution: '特写70%', pacing: '快' },
  { code: 'news',         name: '新闻/资讯',     keywords: ['新闻','事件','突发'],         narrativeStructure: '事件→报道→点评',       shotDistribution: '中特写80%', pacing: '中' },
  { code: 'general',      name: '通用类型',      keywords: [],                             narrativeStructure: '起承转合',             shotDistribution: '中景40%', pacing: '中' },
];

// ============================================================
// 10种风格预设 (v3.1)
// ============================================================

export const STYLE_PRESETS: Record<StylePresetCode, StylePreset> = {
  cyberpunk: {
    code: 'cyberpunk', name: '赛博朋克', nameEn: 'Cyberpunk',
    keywords: ['neon', 'dystopian', 'holographic', 'rain-slicked', 'chrome'],
    colorTone: '深蓝/紫 + 霓虹粉/青',
    atmosphere: '压抑、科技感、反乌托邦',
    visualRef: 'Blade Runner, Ghost in the Shell',
    promptPrefix: 'cyberpunk style, neon-lit urban landscape, holographic advertisements, dark atmosphere,',
    negativePrompt: 'bright, cheerful, pastoral, natural, rustic',
    recommendedFor: ['short_drama', 'education'],
  },
  chinese_ink: {
    code: 'chinese_ink', name: '水墨', nameEn: 'Chinese Ink',
    keywords: ['ink wash', 'xuan paper', 'brush strokes', 'negative space', 'monochrome'],
    colorTone: '黑白灰 + 淡彩点缀',
    atmosphere: '空灵、诗意、留白',
    visualRef: '传统水墨画、张大千、齐白石',
    promptPrefix: 'traditional Chinese ink wash painting, xuan paper texture, brush stroke aesthetics, minimalist composition, negative space,',
    negativePrompt: 'photorealistic, 3D render, saturated colors, western painting style',
    recommendedFor: ['documentary'],
  },
  anime: {
    code: 'anime', name: '日系动画', nameEn: 'Anime',
    keywords: ['anime', 'cel shading', 'vibrant', 'expressive eyes', 'sakura'],
    colorTone: '高饱和、明亮、粉蓝绿',
    atmosphere: '情感化、梦幻、青春',
    visualRef: '新海诚、宫崎骏、Your Name',
    promptPrefix: 'anime style, cel-shaded, vibrant colors, dramatic lighting, expressive characters,',
    negativePrompt: 'photorealistic, western cartoon, crude drawing, low quality',
    recommendedFor: ['short_drama', 'general'],
  },
  cinematic_realism: {
    code: 'cinematic_realism', name: '电影写实', nameEn: 'Cinematic Realism',
    keywords: ['cinematic', 'photorealistic', 'depth of field', 'volumetric lighting', 'film grain'],
    colorTone: '自然色彩 + 电影调色',
    atmosphere: '沉浸感、叙事性、质感',
    visualRef: 'Roger Deakins 摄影、好莱坞大片',
    promptPrefix: 'cinematic, photorealistic, 35mm film grain, volumetric lighting, shallow depth of field, anamorphic lens flare,',
    negativePrompt: 'cartoon, anime, illustration, painting, low quality, blurry',
    recommendedFor: ['documentary', 'marketing', 'news'],
  },
  film_noir: {
    code: 'film_noir', name: '黑色电影', nameEn: 'Film Noir',
    keywords: ['high contrast', 'chiaroscuro', 'venetian blinds shadow', 'cigarette smoke'],
    colorTone: '黑白 + 极高对比',
    atmosphere: '神秘、危险、暧昧',
    visualRef: 'The Maltese Falcon, Sin City',
    promptPrefix: 'film noir style, high contrast black and white, dramatic chiaroscuro lighting, venetian blind shadows, cigarette smoke, rain,',
    negativePrompt: 'color, bright, cheerful, modern, clean',
    recommendedFor: ['short_drama', 'documentary'],
  },
  fantasy_epic: {
    code: 'fantasy_epic', name: '奇幻史诗', nameEn: 'Fantasy Epic',
    keywords: ['epic', 'fantasy', 'magical', 'ancient ruins', 'dragon', 'ethereal glow'],
    colorTone: '金色/深蓝/翡翠绿',
    atmosphere: '宏大、神秘、古老',
    visualRef: 'Lord of the Rings, Game of Thrones',
    promptPrefix: 'epic fantasy art, grand scale, magical atmosphere, ancient architecture, volumetric god rays, golden hour lighting,',
    negativePrompt: 'modern, urban, mundane, low fantasy, cartoon',
    recommendedFor: ['short_drama', 'documentary'],
  },
  minimalist: {
    code: 'minimalist', name: '极简主义', nameEn: 'Minimalist',
    keywords: ['minimalist', 'clean lines', 'geometric', 'monochrome', 'whitespace'],
    colorTone: '单色或双色',
    atmosphere: '宁静、秩序、禅意',
    visualRef: '无印良品海报、建筑摄影',
    promptPrefix: 'minimalist design, clean composition, geometric shapes, limited color palette, generous whitespace, zen aesthetics,',
    negativePrompt: 'cluttered, ornate, busy, baroque, maximalist',
    recommendedFor: ['education', 'marketing'],
  },
  retro_vintage: {
    code: 'retro_vintage', name: '复古怀旧', nameEn: 'Retro Vintage',
    keywords: ['retro', 'vintage', '70s/80s/90s', 'grain', 'VHS', 'polaroid'],
    colorTone: '褪色暖调 / 胶片色',
    atmosphere: '怀旧、温暖、年代感',
    visualRef: '老照片、VHS 录像、Polaroid',
    promptPrefix: 'vintage retro aesthetic, faded colors, film grain, VHS artifacts, warm tones, 1980s atmosphere, polaroid photo look,',
    negativePrompt: 'modern, clean, digital, crisp, futuristic',
    recommendedFor: ['documentary', 'general'],
  },
  steampunk: {
    code: 'steampunk', name: '蒸汽朋克', nameEn: 'Steampunk',
    keywords: ['steampunk', 'brass gears', 'Victorian', 'clockwork', 'airship'],
    colorTone: '铜色/棕色/暗金',
    atmosphere: '机械美学、维多利亚、冒险',
    visualRef: "Howl's Moving Castle, Dishonored",
    promptPrefix: 'steampunk style, brass clockwork mechanisms, Victorian architecture, steam-powered machinery, copper and leather textures,',
    negativePrompt: 'modern technology, digital, clean, minimalist, cyberpunk',
    recommendedFor: ['short_drama', 'education'],
  },
  surrealism: {
    code: 'surrealism', name: '超现实主义', nameEn: 'Surrealism',
    keywords: ['surreal', 'dreamlike', 'impossible geometry', 'melting', 'floating'],
    colorTone: '诡异梦幻色',
    atmosphere: '梦幻、荒诞、心理深潜',
    visualRef: 'Dali, Magritte, Alice in Wonderland',
    promptPrefix: 'surrealist art, dreamlike atmosphere, impossible geometry, floating objects, paradoxical perspective, subconscious imagery,',
    negativePrompt: 'realistic, mundane, ordinary, logical, grounded',
    recommendedFor: ['short_drama', 'general'],
  },
};

/** 主题类型到推荐风格映射 */
export const STYLE_RECOMMENDATION_MAP: Record<string, StylePresetCode[]> = {
  '科幻/未来': ['cyberpunk'],
  '国风/诗意': ['chinese_ink'],
  '二次元/青春': ['anime'],
  '真实感叙事': ['cinematic_realism'],
  '悬疑/犯罪': ['film_noir'],
  '魔法/史诗': ['fantasy_epic'],
  '抽象/概念': ['minimalist'],
  '怀旧/年代': ['retro_vintage'],
  '机械/冒险': ['steampunk'],
  '梦幻/实验': ['surrealism'],
};

// ============================================================
// 视频生成模型矩阵 (v3.1)
// ============================================================

export const VIDEO_MODELS: Record<VideoModelCode, VideoModelDefinition> = {
  sora_2: {
    code: 'sora_2', name: 'Sora 2',
    capabilities: { quality: 5, audioSync: 2, characterConsistency: 3, anime: 3, realism: 5, speed: 3, cost: 'high', maxDuration: 20 },
  },
  kling_2_6: {
    code: 'kling_2_6', name: 'Kling 2.6',
    capabilities: { quality: 4, audioSync: 3, characterConsistency: 4, anime: 4, realism: 4, speed: 4, cost: 'medium', maxDuration: 30 },
  },
  seedance_2_0: {
    code: 'seedance_2_0', name: 'Seedance 2.0',
    capabilities: { quality: 5, audioSync: 5, characterConsistency: 3, anime: 2, realism: 5, speed: 5, cost: 'medium', maxDuration: 10 },
  },
  veo_3_1: {
    code: 'veo_3_1', name: 'Veo 3.1',
    capabilities: { quality: 4, audioSync: 2, characterConsistency: 2, anime: 5, realism: 3, speed: 3, cost: 'low', maxDuration: 60 },
  },
  wan_2_6: {
    code: 'wan_2_6', name: '通义万相 Wan 2.6',
    capabilities: { quality: 5, audioSync: 4, characterConsistency: 5, anime: 4, realism: 5, speed: 4, cost: 'medium', maxDuration: 15 },
  },
  mamoda_2_5: {
    code: 'mamoda_2_5', name: 'Mamoda 2.5',
    capabilities: { quality: 4, audioSync: 3, characterConsistency: 4, anime: 4, realism: 4, speed: 3, cost: 'medium', maxDuration: 30 },
  },
};

/** 默认路由权重 */
export const DEFAULT_ROUTING_WEIGHTS: RoutingWeights = {
  qualityMatch: 0.30,
  audioNeed: 0.20,
  durationMatch: 0.15,
  consistencyNeed: 0.20,
  costEfficiency: 0.15,
};

// ============================================================
// AI 质量评估阈值 (v3.1)
// ============================================================

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  minSemanticScore: 6,
  minAudioSyncScore: 6,
  minAestheticScore: 5,
  minOverallScore: 6.0,
  autoRegenerateThreshold: 5.0,
  suggestOptimizeMin: 6.0,
  suggestOptimizeMax: 8.0,
};

// ============================================================
// 提示词负面词体系 (v3.1)
// ============================================================

export const NEGATIVE_PROMPTS = {
  general: 'low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo, signature, out of frame, cropped, duplicate, mutation, disfigured, worst quality, jpeg artifacts',
  video: 'static, frozen, jittery, frame skip, morphing, extra limbs, deformed motion, inconsistent lighting, flickering, noise',
  portrait: 'asymmetric eyes, crossed eyes, deformed face, extra fingers, mutated hands, poorly drawn face, bad proportions, extra digits',
} as const;

/** 图像提示词六层优先级 (用于裁剪) */
export const IMAGE_PROMPT_PRIORITY = [
  'layer1_subject',
  'layer3_composition',
  'layer6_style',
  'layer4_lighting',
  'layer2_action',
  'layer5_environment',
] as const;

/** 视频提示词八层优先级 (用于裁剪) */
export const VIDEO_PROMPT_PRIORITY = [
  'layer1_camera',
  'layer2_subject',
  'layer7_style',
  'layer3_actionChange',
  'layer6_rhythm',
  'layer4_envChange',
  'layer5_lightChange',
  'layer8_techParams',
] as const;

// ============================================================
// 角色设计体系 (v3.1)
// ============================================================

/** 冲突类型映射 */
export const CONFLICT_TYPES: Record<string, { name: string; description: string; visualSuggestion: string }> = {
  man_vs_self:    { name: '内心冲突', description: '内心挣扎，自我成长', visualSuggestion: '镜像/分裂画面/内心独白字幕' },
  man_vs_man:     { name: '人际冲突', description: '对手/敌人，直接对抗', visualSuggestion: '对峙镜头/推拉镜头' },
  man_vs_society: { name: '社会冲突', description: '体制/规则压迫', visualSuggestion: '群体镜头/压抑构图/高墙' },
  man_vs_nature:  { name: '自然冲突', description: '生存/环境对抗', visualSuggestion: '广角自然/极端天气/孤立构图' },
  man_vs_fate:    { name: '命运冲突', description: '预言/宿命/不可抗力', visualSuggestion: '象征物/命运的视觉隐喻' },
};

/** 角色弧线类型映射 */
export const ARC_TYPE_LABELS: Record<string, string> = {
  growth: '成长弧线 — 从缺陷走向完整',
  decline: '堕落弧线 — 从完整走向毁灭',
  flat: '平稳弧线 — 价值观始终不变',
  tragic: '悲剧弧线 — 努力但失败，震撼力强',
};

/** 角色一致性检查清单 (4维度17项) */
export const CHARACTER_CONSISTENCY_CHECKLIST = {
  visual: [
    '发色/发型一致',
    '服装一致（注意场景变化）',
    '体型/比例一致',
    '标志性配饰一致',
    '面部特征一致（伤疤/痣/眼镜）',
  ],
  personality: [
    '决策风格一致（冲动/谨慎/理性）',
    '口癖/说话风格一致',
    '应激反应一致（压力下如何行动）',
    '价值观表达一致',
  ],
  continuity: [
    '伤势/疲劳状态延续',
    '持有物品延续（武器/道具/文件）',
    '服装状态延续（破损/脏污/湿痕）',
    '位置/目的地一致性',
  ],
  relationship: [
    '角色间情感状态与上一幕匹配',
    '秘密/已知信息跨镜头一致',
    '权力关系（谁主导/谁服从）一致',
    '关系发展阶段逻辑连贯',
  ],
} as const;
