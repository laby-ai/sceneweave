import {
  parseVimaxSkillRuntimeBinding,
  resolveVimaxSkillRuntimeBinding,
  type VimaxSkillRuntimeBinding,
} from '@/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';

export type VimaxProductionPhase = 'plan' | 'reference_assets' | 'video';
export type VimaxProductionCheckpoint = VimaxProductionPhase | 'render';
export type VimaxProductionCheckpointStatus = 'completed' | 'pending' | 'blocked' | 'awaiting-human' | 'skipped';
export type VimaxProductionGovernanceStatus =
  | 'awaiting-plan-approval'
  | 'awaiting-cost-decision'
  | 'plan-approved'
  | 'ready'
  | 'paused'
  | 'delivery-ready'
  | 'blocked';
export type VimaxProductionDecisionAction =
  | 'approved'
  | 'draft-only-confirmed'
  | 'paused'
  | 'resumed'
  | 'draft-delivered';

export const VIMAX_IMAGE_MODEL_ID = 'doubao-seedream-5-0-260128';
export const VIMAX_VIDEO_MODEL_ID = 'doubao-seedance-1-5-pro-251215';
export const VIMAX_RENDER_RUNTIME = 'sceneweave-segmented-ffmpeg-v1';

export interface VimaxProductionPlan {
  version: 'sceneweave-production-plan-v1';
  pipeline: {
    id: 'vimax-short-drama';
    label: '创作智能体分阶段生成';
  };
  workflow: VimaxSkillRuntimeBinding;
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
    status: VimaxProductionCheckpointStatus;
  }>;
  governance: {
    status: VimaxProductionGovernanceStatus;
    decisionLog: Array<{
      checkpoint: 'plan' | 'cost' | 'execution' | 'render';
      action: VimaxProductionDecisionAction;
      at: string;
    }>;
  };
  estimatedCost: {
    currency: 'CNY';
    amount: number | null;
    status: 'provider-confirmation-required' | 'draft-only-confirmed' | 'confirmed';
    requiresConfirmation: true;
    reason: string;
  };
  render: {
    runtime: typeof VIMAX_RENDER_RUNTIME;
    locked: true;
    allowSilentFallback: false;
    status: 'not-started' | 'draft-ready';
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
  workflow?: VimaxSkillRuntimeBinding;
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
  const planApprovalReady = input.providerReadiness.referenceAssets;

  return {
    version: 'sceneweave-production-plan-v1',
    pipeline: { id: 'vimax-short-drama', label: '创作智能体分阶段生成' },
    workflow: input.workflow || resolveVimaxSkillRuntimeBinding(),
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
      { id: 'reference_assets', name: CHECKPOINT_NAMES.reference_assets, status: planApprovalReady ? 'awaiting-human' : 'blocked' },
      { id: 'video', name: CHECKPOINT_NAMES.video, status: 'blocked' },
      { id: 'render', name: CHECKPOINT_NAMES.render, status: 'blocked' },
    ],
    governance: {
      status: planApprovalReady ? 'awaiting-plan-approval' : 'blocked',
      decisionLog: [],
    },
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

  const workflow = value.workflow === undefined
    ? resolveVimaxSkillRuntimeBinding()
    : parseVimaxSkillRuntimeBinding(value.workflow);
  if (!workflow) return undefined;
  const governance = value.governance === undefined
    ? { status: 'plan-approved' as const, decisionLog: [] }
    : value.governance;
  if (!isRecord(governance)
    || ![
      'awaiting-plan-approval',
      'awaiting-cost-decision',
      'plan-approved',
      'ready',
      'paused',
      'delivery-ready',
      'blocked',
    ].includes(String(governance.status))
    || !Array.isArray(governance.decisionLog)
    || !governance.decisionLog.every(decision => isRecord(decision)
      && ['plan', 'cost', 'execution', 'render'].includes(String(decision.checkpoint))
      && ['approved', 'draft-only-confirmed', 'paused', 'resumed', 'draft-delivered'].includes(String(decision.action))
      && typeof decision.at === 'string')) return undefined;

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
    && ['completed', 'pending', 'blocked', 'awaiting-human', 'skipped'].includes(String(checkpoint.status)));
  const costAmountValid = value.estimatedCost.amount === null
    || (typeof value.estimatedCost.amount === 'number' && Number.isFinite(value.estimatedCost.amount) && value.estimatedCost.amount >= 0);
  const confirmedCostValid = value.estimatedCost.status !== 'confirmed'
    || typeof value.estimatedCost.amount === 'number';
  const validCost = value.estimatedCost.currency === 'CNY'
    && costAmountValid
    && confirmedCostValid
    && ['provider-confirmation-required', 'draft-only-confirmed', 'confirmed'].includes(String(value.estimatedCost.status))
    && value.estimatedCost.requiresConfirmation === true
    && typeof value.estimatedCost.reason === 'string';
  const validRender = value.render.runtime === VIMAX_RENDER_RUNTIME
    && value.render.locked === true
    && value.render.allowSilentFallback === false
    && ['not-started', 'draft-ready'].includes(String(value.render.status));

  return validRoutes && validMaterials && validCheckpoints && validCost && validRender
    ? { ...value, workflow, governance } as unknown as VimaxProductionPlan
    : undefined;
}

export function approveVimaxProductionPlan(value: unknown): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  if (plan.governance.decisionLog.some(decision => decision.checkpoint === 'plan' && decision.action === 'approved')) {
    return plan;
  }
  if (plan.governance.status !== 'awaiting-plan-approval') {
    throw new Error('当前制作计划尚未具备确认条件。');
  }
  const referenceRoute = plan.providerRoutes.find(route => route.stage === 'reference_assets');
  if (!referenceRoute?.ready) throw new Error('参考素材服务尚未就绪，暂不能确认制作计划。');

  return {
    ...plan,
    checkpoints: plan.checkpoints,
    governance: {
      status: 'awaiting-cost-decision',
      decisionLog: [
        ...plan.governance.decisionLog,
        { checkpoint: 'plan', action: 'approved', at: new Date().toISOString() },
      ],
    },
  };
}

export function confirmVimaxProductionDraft(value: unknown): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  if (plan.estimatedCost.status === 'draft-only-confirmed') return plan;
  if (!['awaiting-cost-decision', 'plan-approved'].includes(plan.governance.status)) {
    throw new Error('请先确认制作计划，再选择执行方式。');
  }
  return {
    ...plan,
    checkpoints: plan.checkpoints.map(checkpoint => {
      if (checkpoint.id === 'reference_assets' || checkpoint.id === 'video') {
        return { ...checkpoint, status: 'skipped' as const };
      }
      if (checkpoint.id === 'render') return { ...checkpoint, status: 'pending' as const };
      return checkpoint;
    }),
    governance: {
      status: 'ready',
      decisionLog: [
        ...plan.governance.decisionLog,
        { checkpoint: 'cost', action: 'draft-only-confirmed', at: new Date().toISOString() },
      ],
    },
    estimatedCost: {
      ...plan.estimatedCost,
      status: 'draft-only-confirmed',
      reason: '本次仅准备制作草稿，不调用图像或视频模型，不产生模型费用。',
    },
  };
}

export function pauseVimaxProduction(value: unknown): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  if (plan.governance.status === 'paused') return plan;
  if (plan.governance.status !== 'ready') throw new Error('当前流程尚不能暂停。');
  return {
    ...plan,
    governance: {
      status: 'paused',
      decisionLog: [
        ...plan.governance.decisionLog,
        { checkpoint: 'execution', action: 'paused', at: new Date().toISOString() },
      ],
    },
  };
}

export function resumeVimaxProduction(value: unknown): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  if (plan.governance.status === 'ready') return plan;
  if (plan.governance.status !== 'paused') throw new Error('当前流程没有暂停记录。');
  return {
    ...plan,
    governance: {
      status: 'ready',
      decisionLog: [
        ...plan.governance.decisionLog,
        { checkpoint: 'execution', action: 'resumed', at: new Date().toISOString() },
      ],
    },
  };
}

export function prepareVimaxProductionDraft(value: unknown): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  if (plan.governance.status === 'delivery-ready') return plan;
  if (plan.governance.status === 'paused') throw new Error('请先继续流程，再准备交付草稿。');
  if (plan.governance.status !== 'ready' || plan.estimatedCost.status !== 'draft-only-confirmed') {
    throw new Error('请先确认无成本草稿交付方式。');
  }
  return {
    ...plan,
    checkpoints: plan.checkpoints.map(checkpoint => checkpoint.id === 'render'
      ? { ...checkpoint, status: 'completed' as const }
      : checkpoint),
    governance: {
      status: 'delivery-ready',
      decisionLog: [
        ...plan.governance.decisionLog,
        { checkpoint: 'render', action: 'draft-delivered', at: new Date().toISOString() },
      ],
    },
    render: { ...plan.render, status: 'draft-ready' },
  };
}

export function assertVimaxProductionDraftDelivery(value: unknown): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan || plan.governance.status !== 'delivery-ready' || plan.render.status !== 'draft-ready') {
    throw new Error('制作草稿尚未准备完成。');
  }
  return plan;
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

  const requiredOperation = phase === 'reference_assets' ? 'director.reference-assets' : 'director.video';
  if (!plan.workflow.operationOrder.includes(requiredOperation)) {
    throw new Error(phase === 'video'
      ? '本次创作流程不包含视频生成阶段。'
      : '本次创作流程不包含参考素材阶段。');
  }
  if (plan.governance.status === 'paused') {
    throw new Error('制作流程已暂停，请先继续流程。');
  }
  if (plan.governance.status !== 'ready' || plan.estimatedCost.status !== 'confirmed') {
    throw new Error('请先确认制作计划与真实费用，再进入模型制作阶段。');
  }

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
