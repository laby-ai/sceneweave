/**
 * 视频生成管线架构 (v1.0)
 * 
 * 融入 Open-Sora 2.0 的核心设计理念:
 * - T2I2V 两阶段管线 (Text→Image→Video)
 * - 运动评分 (Motion Score) 控制
 * - 美学评分 (Aesthetic Score) 条件化
 * - 振荡引导 (Oscillation Guidance) 优化
 * - 采样选项 (Sampling Options) 数据结构
 * - Bucket 分桶系统 (分辨率/帧数/比例组合)
 * 
 * 设计原则:
 * - 管线可编排：每个步骤独立，可自由组合
 * - 参数可降级：高级参数不支持时自动回退
 * - 模型可替换：通过 Registry 模式注册不同模型
 */

import {
  selectPipelineMode,
  getRecommendedMotionScore,
  buildScoreSuffix,
  type GenerationPipelineMode,
} from './platform-capabilities';

// ============================================================
// 类型定义
// ============================================================

/** 管线执行状态 */
export type PipelineStatus =
  | 'idle'
  | 'preparing'
  | 'generating_image'
  | 'encoding_text'
  | 'encoding_image'
  | 'denoising'
  | 'decoding'
  | 'post_processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** 条件类型（Open-Sora 定义） */
export type ConditioningType =
  | 't2v'            // 文本生视频
  | 'i2v_head'       // 图生视频（首帧条件）
  | 'i2v_tail'       // 图生视频（尾帧条件）
  | 'i2v_loop'       // 图生视频（首尾帧连接）
  | 'v2v_head_half'  // 视频扩展（前半段）
  | 'v2v_tail_half'; // 视频扩展（后半段）

/** 采样选项（适配自 Open-Sora SamplingOption） */
export interface SamplingOptions {
  /** 目标宽度 */
  width?: number;
  /** 目标高度 */
  height?: number;
  /** 分辨率预设 '256px' | '768px' */
  resolution?: string;
  /** 画面比例 */
  aspectRatio?: string;
  /** 生成帧数（4k+1格式，如 33/65/129） */
  numFrames?: number;
  /** 采样步数 */
  numSteps?: number;
  /** 文本引导强度（Classifier-Free Guidance） */
  guidance?: number;
  /** 图像引导强度 */
  guidanceImg?: number;
  /** 文本引导振荡（Open-Sora: 交替施加/取消引导提升质量） */
  textOsci?: boolean;
  /** 图像引导振荡 */
  imageOsci?: boolean;
  /** 时间轴缩放振荡 */
  scaleTemporalOsci?: boolean;
  /** 随机种子 */
  seed?: number;
  /** 时间偏移（rectified flow） */
  shift?: boolean;
  /** 条件类型 */
  condType?: ConditioningType;
  /** 时间压缩率 */
  temporalReduction?: number;
  /** 运动评分（1-15，Open-Sora 专属） */
  motionScore?: number;
  /** FPS */
  fps?: number;
}

/** 管线步骤结果 */
export interface PipelineStepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  outputUrl?: string;
  metadata?: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

/** 管线执行上下文 */
export interface PipelineContext {
  /** 原始提示词 */
  prompt: string;
  /** 精炼后的提示词 */
  refinedPrompt?: string;
  /** 参考图片URL */
  referenceImageUrl?: string;
  /** 参考视频URL */
  referenceVideoUrl?: string;
  /** 管线模式 */
  mode: GenerationPipelineMode;
  /** 采样选项 */
  sampling: SamplingOptions;
  /** 美学评分目标 */
  targetAestheticScore?: number;
  /** 运镜描述 */
  cameraMotion?: string;
  /** 步骤结果 */
  stepResults: PipelineStepResult[];
  /** 全局状态 */
  status: PipelineStatus;
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
}

// ============================================================
// 分桶系统 (Bucket System)
// ============================================================

/** 视频分辨率分桶（适配自 Open-Sora aspect.py） */
export interface ResolutionBucket {
  label: string;
  width: number;
  height: number;
  pixelCount: number;
}

/** 支持的画面比例及对应分辨率 */
const ASPECT_RATIOS_CONFIG: Record<string, { widthRatio: number; heightRatio: number; label: string }> = {
  '2.39:1': { widthRatio: 2.39, heightRatio: 1, label: 'Cinemascope' },
  '16:9':   { widthRatio: 16, heightRatio: 9, label: 'Widescreen' },
  '1.1':    { widthRatio: 1, heightRatio: 1, label: 'Square' },
  '9:16':   { widthRatio: 9, heightRatio: 16, label: 'Vertical' },
};

/** 计算分桶分辨率（对齐到16像素） */
function computeBucketResolution(
  totalPixels: number,
  aspectRatio: string,
): { width: number; height: number } {
  const config = ASPECT_RATIOS_CONFIG[aspectRatio];
  if (!config) return { width: 256, height: 256 };

  const D = 16; // VAE 空间压缩比
  const rawWidth = Math.sqrt(totalPixels * (config.widthRatio / config.heightRatio));
  const rawHeight = totalPixels / rawWidth;
  const width = Math.round(rawWidth / D) * D;
  const height = Math.round(rawHeight / D) * D;

  return { width, height };
}

/** 获取指定分辨率和比例的分桶 */
export function getResolutionBuckets(resolution: string): ResolutionBucket[] {
  const totalPixels = resolution === '768px' ? 768 * 768 : 256 * 256;
  return Object.entries(ASPECT_RATIOS_CONFIG).map(([ratio, config]) => {
    const { width, height } = computeBucketResolution(totalPixels, ratio);
    return {
      label: `${config.label} ${ratio}`,
      width,
      height,
      pixelCount: width * height,
    };
  });
}

// ============================================================
// 振荡引导 (Oscillation Guidance)
// ============================================================

/**
 * 计算振荡引导值
 * Open-Sora 设计: 在前 forceNum 步使用完整引导，之后交替引导/无引导
 * 这可以避免过度引导导致的伪影
 */
export function getOscillationGuidance(
  guidanceScale: number,
  stepIndex: number,
  forceNum: number = 10,
): number {
  if (stepIndex < forceNum || (stepIndex >= forceNum && stepIndex % 2 === 0)) {
    return guidanceScale;
  }
  return 1.0; // 无引导
}

/**
 * 计算时间轴缩放的图像引导值
 * Open-Sora 设计: 图像引导沿时间轴递增，随去噪步数递减
 * 这确保首帧忠实参考图，后续帧逐渐释放创造力
 */
export function getTemporalScaledGuidance(
  maxImageGuidance: number,
  totalSteps: number,
  currentStep: number,
  temporalPosition: number, // 0-1, 0=首帧, 1=末帧
): number {
  const stepScale = (totalSteps - currentStep) / totalSteps; // 步数递减
  const temporalScale = temporalPosition; // 时间轴递增
  return 1.0 + (maxImageGuidance - 1.0) * stepScale * temporalScale;
}

// ============================================================
// 管线执行器
// ============================================================

/** 管线步骤定义 */
export interface PipelineStepDefinition {
  id: string;
  name: string;
  description: string;
  requiredInputs: string[];
  optionalInputs: string[];
  outputs: string[];
  estimatedDurationMs: [number, number]; // [min, max]
}

/** T2I2V 完整管线步骤 */
export const T2I2V_PIPELINE_STEPS: PipelineStepDefinition[] = [
  {
    id: 'prompt_refine',
    name: '提示词精炼',
    description: '使用 LLM 将简短用户提示词扩展为详细的视频描述提示词',
    requiredInputs: ['prompt'],
    optionalInputs: ['referenceImageUrl', 'condType'],
    outputs: ['refinedPrompt'],
    estimatedDurationMs: [2000, 8000],
  },
  {
    id: 'text_encoding',
    name: '文本编码',
    description: '使用 T5 + CLIP 双编码器将提示词编码为条件向量',
    requiredInputs: ['refinedPrompt'],
    optionalInputs: ['motionScore'],
    outputs: ['textEmbedding', 'clipEmbedding'],
    estimatedDurationMs: [500, 2000],
  },
  {
    id: 't2i_generation',
    name: '首帧图片生成',
    description: '使用 Flux 模型生成视频首帧高质量图片',
    requiredInputs: ['textEmbedding'],
    optionalInputs: ['resolution', 'aspectRatio'],
    outputs: ['firstFrameUrl'],
    estimatedDurationMs: [10000, 30000],
  },
  {
    id: 'condition_preparation',
    name: '条件准备',
    description: '将首帧图片编码为 VAE 潜空间，构建条件掩码',
    requiredInputs: ['firstFrameUrl'],
    optionalInputs: ['condType'],
    outputs: ['conditionLatent', 'conditionMask'],
    estimatedDurationMs: [1000, 3000],
  },
  {
    id: 'denoising',
    name: '去噪生成',
    description: 'MMDiT 模型在条件引导下逐步去噪生成视频潜空间',
    requiredInputs: ['textEmbedding', 'conditionLatent'],
    optionalInputs: ['numSteps', 'guidance', 'textOsci', 'imageOsci'],
    outputs: ['videoLatent'],
    estimatedDurationMs: [30000, 180000],
  },
  {
    id: 'decoding',
    name: 'VAE 解码',
    description: '将视频潜空间解码为像素空间视频帧',
    requiredInputs: ['videoLatent'],
    optionalInputs: [],
    outputs: ['videoFrames'],
    estimatedDurationMs: [5000, 30000],
  },
  {
    id: 'post_processing',
    name: '后处理',
    description: '帧率转换、编码、水印添加等后处理步骤',
    requiredInputs: ['videoFrames'],
    optionalInputs: ['fps'],
    outputs: ['videoUrl'],
    estimatedDurationMs: [3000, 10000],
  },
];

/** I2V 管线步骤（跳过 T2I 阶段） */
export const I2V_PIPELINE_STEPS: PipelineStepDefinition[] = T2I2V_PIPELINE_STEPS.filter(
  s => s.id !== 't2i_generation',
);

/** 直接 T2V 管线步骤（跳过 T2I + 条件准备） */
export const T2V_PIPELINE_STEPS: PipelineStepDefinition[] = T2I2V_PIPELINE_STEPS.filter(
  s => s.id !== 't2i_generation' && s.id !== 'condition_preparation',
);

/** 获取管线步骤 */
export function getPipelineSteps(mode: GenerationPipelineMode): PipelineStepDefinition[] {
  switch (mode) {
    case 't2i2v': return T2I2V_PIPELINE_STEPS;
    case 'i2v': return I2V_PIPELINE_STEPS;
    case 't2v': return T2V_PIPELINE_STEPS;
    case 'v2v': return I2V_PIPELINE_STEPS; // V2V 复用 I2V 管线
  }
}

/** 估算管线总耗时 */
export function estimatePipelineDuration(mode: GenerationPipelineMode): { minMs: number; maxMs: number } {
  const steps = getPipelineSteps(mode);
  const minMs = steps.reduce((sum, s) => sum + s.estimatedDurationMs[0], 0);
  const maxMs = steps.reduce((sum, s) => sum + s.estimatedDurationMs[1], 0);
  return { minMs, maxMs };
}

// ============================================================
// 管线编排器
// ============================================================

/** 创建管线上下文 */
export function createPipelineContext(options: {
  prompt: string;
  referenceImageUrl?: string;
  referenceVideoUrl?: string;
  mode?: GenerationPipelineMode;
  resolution?: string;
  aspectRatio?: string;
  motionScore?: number;
  numFrames?: number;
  numSteps?: number;
  guidance?: number;
  seed?: number;
  cameraMotion?: string;
}): PipelineContext {
  const mode = options.mode ?? selectPipelineMode(
    !!options.referenceImageUrl,
    !!options.referenceVideoUrl,
  );

  const condType: ConditioningType = mode === 'i2v' ? 'i2v_head'
    : mode === 'v2v' ? 'v2v_head_half'
    : 't2v';

  const motionScore = options.motionScore ?? getRecommendedMotionScore('general');

  // 根据分辨率和比例计算实际宽高
  const totalPixels = options.resolution === '768px' ? 768 * 768 : 256 * 256;
  const ar = options.aspectRatio ?? '16:9';
  const { width, height } = computeBucketResolution(totalPixels, ar);

  return {
    prompt: options.prompt,
    referenceImageUrl: options.referenceImageUrl,
    referenceVideoUrl: options.referenceVideoUrl,
    mode,
    sampling: {
      width,
      height,
      resolution: options.resolution ?? '256px',
      aspectRatio: ar,
      numFrames: options.numFrames ?? 65,
      numSteps: options.numSteps ?? 50,
      guidance: options.guidance ?? 7.5,
      guidanceImg: mode === 'i2v' || mode === 't2i2v' ? 3.0 : undefined,
      textOsci: true,
      imageOsci: mode === 'i2v' || mode === 't2i2v' ? true : undefined,
      scaleTemporalOsci: mode === 'i2v' || mode === 't2i2v' ? true : undefined,
      seed: options.seed,
      shift: true,
      condType,
      temporalReduction: 4,
      motionScore,
      fps: 24,
    },
    cameraMotion: options.cameraMotion,
    stepResults: [],
    status: 'idle',
  };
}

/**
 * 构建完整的提示词（含评分后缀）
 * 遵循 Open-Sora 的提示词格式:
 *   [原始/精炼提示词] The aesthetic score is [label], the motion strength is [label], camera motion: [motion].
 */
export function buildFullPrompt(ctx: PipelineContext): string {
  const basePrompt = ctx.refinedPrompt ?? ctx.prompt;
  const suffix = buildScoreSuffix({
    motionScore: ctx.sampling.motionScore,
    aestheticScore: ctx.targetAestheticScore,
    cameraMotion: ctx.cameraMotion,
  });
  return suffix ? `${basePrompt} ${suffix}` : basePrompt;
}
