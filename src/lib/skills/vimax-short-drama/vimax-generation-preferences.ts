export const VIMAX_PLAN_MODEL = 'qwen3.7-plus';
export const VIMAX_IMAGE_MODEL = 'qwen-image-2.0';
export const VIMAX_VIDEO_MODEL = 'happyhorse-1.1-i2v';

const SUPPORTED_RATIOS = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);
const QUALITY_TO_RESOLUTION: Record<string, string> = {
  '标清': '480p',
  '高清': '720p',
  '超清': '1080p',
};

export interface VimaxGenerationSettings {
  planModel: string;
  imageModel: string;
  videoModel: string;
  ratio: string;
  resolution: string;
}

interface VimaxGenerationSettingsInput {
  model?: string;
  ratio?: string;
  quality?: string;
}

export function resolveVimaxGenerationSettings(input: VimaxGenerationSettingsInput): VimaxGenerationSettings {
  return {
    planModel: input.model?.trim() || VIMAX_PLAN_MODEL,
    imageModel: VIMAX_IMAGE_MODEL,
    videoModel: VIMAX_VIDEO_MODEL,
    ratio: input.ratio && SUPPORTED_RATIOS.has(input.ratio) ? input.ratio : '16:9',
    resolution: input.quality ? QUALITY_TO_RESOLUTION[input.quality] || '720p' : '720p',
  };
}

interface VimaxPlanRequestInput {
  prompt: string;
  duration: number;
  segmentDuration?: number;
  segmentCount?: number;
  style: string;
  skillId?: string;
  sceneType?: string;
  settings: VimaxGenerationSettings;
}

export function buildVimaxPlanRequest(input: VimaxPlanRequestInput) {
  return {
    phase: 'plan' as const,
    prompt: input.prompt,
    duration: input.duration,
    ...(input.segmentDuration ? { segmentDuration: input.segmentDuration } : {}),
    ...(input.segmentCount ? { segmentCount: input.segmentCount } : {}),
    style: input.style,
    ...(input.skillId ? { skillId: input.skillId } : {}),
    ...(input.sceneType ? { sceneType: input.sceneType } : {}),
    model: input.settings.planModel,
    ratio: input.settings.ratio,
    resolution: input.settings.resolution,
    stream: true,
  };
}
