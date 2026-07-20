import type { ProductionProject } from '@/lib/production-project';

export type CreationPipelineId = 'agent-creation' | 'short-drama' | 'product-visual';

export interface CreationProductionPlan {
  version: 'paper-production-plan-v1';
  pipeline: {
    id: CreationPipelineId;
    label: string;
    mode: 'dry-run';
  };
  materials: Array<{
    id: string;
    kind: string;
    name: string;
    status: string;
  }>;
  stages: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  estimatedCost: {
    currency: 'CNY';
    amount: 0;
    status: 'no-cost-dry-run';
  };
  render: {
    status: 'not-started';
    requiresPaidProvider: true;
    reason: string;
  };
}

const PIPELINES: Record<CreationPipelineId, string> = {
  'agent-creation': '智能创作',
  'short-drama': '短剧分镜',
  'product-visual': '商品视觉',
};

const LEGACY_PIPELINES: Record<string, CreationPipelineId> = {
  'lesson-script': 'agent-creation',
  'course-storyboard': 'short-drama',
  'concept-demo': 'product-visual',
};

const LEGACY_LABELS: Record<string, string> = {
  'lesson-script': '教学脚本',
  'course-storyboard': '课程分镜',
  'concept-demo': '概念演示',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function normalizeCreationPipeline(value: unknown): CreationPipelineId {
  if (typeof value !== 'string') return 'agent-creation';
  if (value in PIPELINES) return value as CreationPipelineId;
  return LEGACY_PIPELINES[value] || 'agent-creation';
}

export function buildCreationProductionPlan(
  project: ProductionProject,
  pipelineId: CreationPipelineId,
): CreationProductionPlan {
  return {
    version: 'paper-production-plan-v1',
    pipeline: {
      id: pipelineId,
      label: PIPELINES[pipelineId],
      mode: 'dry-run',
    },
    materials: project.assets
      .filter(asset => ['script', 'character', 'scene', 'prop', 'storyboard'].includes(asset.kind))
      .map(asset => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        status: asset.status,
      })),
    stages: project.stages.map(stage => ({
      id: stage.id,
      name: stage.name,
      status: stage.status === 'ready' ? 'completed' : stage.status,
    })),
    estimatedCost: {
      currency: 'CNY',
      amount: 0,
      status: 'no-cost-dry-run',
    },
    render: {
      status: 'not-started',
      requiresPaidProvider: true,
      reason: '当前仅生成制作方案，未提交图像或视频渲染。',
    },
  };
}

export function parseCreationProductionPlan(value: unknown): CreationProductionPlan | undefined {
  if (!isRecord(value) || value.version !== 'paper-production-plan-v1') return undefined;
  const pipeline = value.pipeline;
  const estimatedCost = value.estimatedCost;
  const render = value.render;
  if (!isRecord(pipeline) || !isRecord(estimatedCost) || !isRecord(render)) return undefined;
  const pipelineId = normalizeCreationPipeline(pipeline.id);
  const legacyId = typeof pipeline.id === 'string' ? LEGACY_PIPELINES[pipeline.id] : undefined;
  const acceptedLabel = legacyId
    ? pipeline.label === LEGACY_LABELS[String(pipeline.id)]
    : pipeline.label === PIPELINES[pipelineId];
  if (!acceptedLabel
    || pipeline.mode !== 'dry-run'
    || estimatedCost.currency !== 'CNY'
    || estimatedCost.amount !== 0
    || estimatedCost.status !== 'no-cost-dry-run'
    || render.status !== 'not-started'
    || render.requiresPaidProvider !== true
    || typeof render.reason !== 'string') return undefined;

  const materials = Array.isArray(value.materials) ? value.materials : [];
  const stages = Array.isArray(value.stages) ? value.stages : [];
  if (!materials.every(item => isRecord(item)
      && ['id', 'kind', 'name', 'status'].every(key => typeof item[key] === 'string'))
    || !stages.every(item => isRecord(item)
      && ['id', 'name', 'status'].every(key => typeof item[key] === 'string'))) return undefined;

  return {
    ...(value as unknown as CreationProductionPlan),
    pipeline: {
      id: pipelineId,
      label: PIPELINES[pipelineId],
      mode: 'dry-run',
    },
  };
}
