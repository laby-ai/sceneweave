export type VimaxProductionPhase = 'plan' | 'reference_assets' | 'video';
export type VimaxProductionCheckpoint = VimaxProductionPhase | 'render';

export const VIMAX_IMAGE_MODEL_ID = 'doubao-seedream-5-0-260128';
export const VIMAX_VIDEO_MODEL_ID = 'doubao-seedance-1-5-pro-251215';
export const VIMAX_RENDER_RUNTIME = 'sceneweave-segmented-ffmpeg-v1';

export interface VimaxProductionPlan {
  version: 'sceneweave-production-plan-v1';
  pipeline: {
    id: 'vimax-short-drama';
    label: '创作智能体分阶段生成';
  };
  title: string;
  preferences: {
    ratio: string;
    resolution: string;
  };
  providerRoutes: Array<{
    stage: VimaxProductionPhase;
    provider: 'ark-plan-v3' | 'ark-image-v3' | 'ark-video-v3';
    model: string;
    ready: boolean;
    locked: true;
  }>;
  materials: Array<{
    id: string;
    kind: string;
    name: string;
    status: 'planned';
  }>;
  checkpoints: Array<{
    id: VimaxProductionCheckpoint;
    name: string;
    status: 'completed' | 'pending' | 'blocked';
  }>;
  estimatedCost: {
    currency: 'CNY';
    amount: null;
    status: 'provider-confirmation-required';
    requiresConfirmation: true;
    reason: string;
  };
  render: {
    runtime: typeof VIMAX_RENDER_RUNTIME;
    locked: true;
    allowSilentFallback: false;
    status: 'not-started';
  };
}

interface VimaxProductionPlanInput {
  title: string;
  ratio: string;
  resolution: string;
  planModel: string;
  imageModel: string;
  videoModel: string;
  providerReadiness: {
    plan: boolean;
    referenceAssets: boolean;
    video: boolean;
  };
  assets: Array<{ kind: string; label: string; prompt?: string }>;
  shots: Array<{ index: number; title: string; duration: number; camera: string; prompt: string }>;
}

interface ExpectedProductionModels {
  plan?: string;
  referenceAssets?: string;
  video?: string;
}

const PROVIDERS: Record<VimaxProductionPhase, VimaxProductionPlan['providerRoutes'][number]['provider']> = {
  plan: 'ark-plan-v3',
  reference_assets: 'ark-image-v3',
  video: 'ark-video-v3',
};

const CHECKPOINT_NAMES: Record<VimaxProductionCheckpoint, string> = {
  plan: '制作计划',
  reference_assets: '参考素材',
  video: '视频片段',
  render: '成片合成',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function buildVimaxProductionPlan(input: VimaxProductionPlanInput): VimaxProductionPlan {
  const providerRoutes: VimaxProductionPlan['providerRoutes'] = [
    { stage: 'plan', provider: PROVIDERS.plan, model: input.planModel, ready: input.providerReadiness.plan, locked: true },
    { stage: 'reference_assets', provider: PROVIDERS.reference_assets, model: input.imageModel, ready: input.providerReadiness.referenceAssets, locked: true },
    { stage: 'video', provider: PROVIDERS.video, model: input.videoModel, ready: input.providerReadiness.video, locked: true },
  ];
  const mediaReady = input.providerReadiness.referenceAssets && input.providerReadiness.video;

  return {
    version: 'sceneweave-production-plan-v1',
    pipeline: { id: 'vimax-short-drama', label: '创作智能体分阶段生成' },
    title: input.title,
    preferences: { ratio: input.ratio, resolution: input.resolution },
    providerRoutes,
    materials: [
      ...input.assets.map((asset, index) => ({
        id: `asset-${index + 1}`,
        kind: asset.kind,
        name: asset.label,
        status: 'planned' as const,
      })),
      ...input.shots.map(shot => ({
        id: `shot-${shot.index}`,
        kind: 'storyboard',
        name: shot.title,
        status: 'planned' as const,
      })),
    ],
    checkpoints: [
      { id: 'plan', name: CHECKPOINT_NAMES.plan, status: 'completed' },
      { id: 'reference_assets', name: CHECKPOINT_NAMES.reference_assets, status: input.providerReadiness.referenceAssets ? 'pending' : 'blocked' },
      { id: 'video', name: CHECKPOINT_NAMES.video, status: input.providerReadiness.video ? 'pending' : 'blocked' },
      { id: 'render', name: CHECKPOINT_NAMES.render, status: mediaReady ? 'pending' : 'blocked' },
    ],
    estimatedCost: {
      currency: 'CNY',
      amount: null,
      status: 'provider-confirmation-required',
      requiresConfirmation: true,
      reason: '图像与视频阶段使用真实模型，执行前必须按当前供应商价格再次确认。',
    },
    render: {
      runtime: VIMAX_RENDER_RUNTIME,
      locked: true,
      allowSilentFallback: false,
      status: 'not-started',
    },
  };
}

export function parseVimaxProductionPlan(value: unknown): VimaxProductionPlan | undefined {
  if (!isRecord(value)
    || value.version !== 'sceneweave-production-plan-v1'
    || !isRecord(value.pipeline)
    || value.pipeline.id !== 'vimax-short-drama'
    || value.pipeline.label !== '创作智能体分阶段生成'
    || typeof value.title !== 'string'
    || !isRecord(value.preferences)
    || typeof value.preferences.ratio !== 'string'
    || typeof value.preferences.resolution !== 'string'
    || !Array.isArray(value.providerRoutes)
    || !Array.isArray(value.materials)
    || !Array.isArray(value.checkpoints)
    || !isRecord(value.estimatedCost)
    || !isRecord(value.render)) return undefined;

  const validRoutes = value.providerRoutes.length === 3 && value.providerRoutes.every(route => (
    isRecord(route)
    && ['plan', 'reference_assets', 'video'].includes(String(route.stage))
    && route.provider === PROVIDERS[route.stage as VimaxProductionPhase]
    && typeof route.model === 'string'
    && route.model.length > 0
    && typeof route.ready === 'boolean'
    && route.locked === true
  ));
  const validMaterials = value.materials.every(material => isRecord(material)
    && ['id', 'kind', 'name'].every(key => typeof material[key] === 'string')
    && material.status === 'planned');
  const validCheckpoints = value.checkpoints.length === 4 && value.checkpoints.every(checkpoint => isRecord(checkpoint)
    && ['plan', 'reference_assets', 'video', 'render'].includes(String(checkpoint.id))
    && checkpoint.name === CHECKPOINT_NAMES[checkpoint.id as VimaxProductionCheckpoint]
    && ['completed', 'pending', 'blocked'].includes(String(checkpoint.status)));
  const validCost = value.estimatedCost.currency === 'CNY'
    && value.estimatedCost.amount === null
    && value.estimatedCost.status === 'provider-confirmation-required'
    && value.estimatedCost.requiresConfirmation === true
    && typeof value.estimatedCost.reason === 'string';
  const validRender = value.render.runtime === VIMAX_RENDER_RUNTIME
    && value.render.locked === true
    && value.render.allowSilentFallback === false
    && value.render.status === 'not-started';

  return validRoutes && validMaterials && validCheckpoints && validCost && validRender
    ? value as unknown as VimaxProductionPlan
    : undefined;
}

export function assertVimaxProductionPlanForPhase(
  value: unknown,
  phase: Exclude<VimaxProductionPhase, 'plan'>,
  expected: ExpectedProductionModels = {},
): VimaxProductionPlan {
  if (!isRecord(value) || !isRecord(value.render) || value.render.runtime !== VIMAX_RENDER_RUNTIME) {
    throw new Error('制作运行时与已确认计划不一致，请返回计划阶段重新确认。');
  }
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请返回计划阶段重新确认。');

  const expectedModel = phase === 'reference_assets'
    ? expected.referenceAssets || VIMAX_IMAGE_MODEL_ID
    : expected.video || VIMAX_VIDEO_MODEL_ID;
  const route = plan.providerRoutes.find(candidate => candidate.stage === phase);
  if (!route || route.model !== expectedModel) {
    throw new Error('模型路由与已确认计划不一致，禁止静默切换供应商或模型。');
  }
  if (!route.ready) {
    throw new Error(phase === 'video' ? '视频模型服务尚未就绪。' : '参考图模型服务尚未就绪。');
  }
  const planRoute = plan.providerRoutes.find(candidate => candidate.stage === 'plan');
  if (expected.plan && planRoute?.model !== expected.plan) {
    throw new Error('规划模型与已确认计划不一致。');
  }
  return plan;
}
