import type { CreationCapabilitySkillId } from '@/lib/skills/creation-capabilities';
import { resolveVimaxSkillCapabilityComposition } from '@/lib/skills/vimax-short-drama/vimax-skill-capability-compositions';

export type VimaxExecutionStageId = 'project' | 'plan' | 'reference_assets' | 'video' | 'delivery';

export interface VimaxSkillRuntimeBinding {
  presetId: string;
  capabilityIds: CreationCapabilitySkillId[];
  operationOrder: string[];
  executionStages: Array<{
    id: VimaxExecutionStageId;
    label: string;
  }>;
}

interface VimaxSkillRuntimeBindingRequest {
  skillId?: unknown;
  capabilityIds?: unknown;
  operationOrder?: unknown;
}

const STAGE_LABELS: Record<VimaxExecutionStageId, string> = {
  project: '项目准备',
  plan: '创作规划',
  reference_assets: '参考素材',
  video: '片段生成',
  delivery: '结果交付',
};

function deriveExecutionStageIds(operationOrder: string[]): VimaxExecutionStageId[] {
  const stages: VimaxExecutionStageId[] = [];
  if (operationOrder.includes('delivery.manage-tasks')) stages.push('project');
  if (operationOrder.includes('director.plan')) stages.push('plan');
  if (operationOrder.includes('director.reference-assets')) stages.push('reference_assets');
  if (operationOrder.includes('director.video')) stages.push('video');
  if (operationOrder.some(operationId => operationId.startsWith('delivery.'))) stages.push('delivery');
  return stages;
}

export function resolveVimaxSkillRuntimeBinding(
  request: VimaxSkillRuntimeBindingRequest = {},
): VimaxSkillRuntimeBinding {
  const presetId = typeof request.skillId === 'string' && request.skillId.trim()
    ? request.skillId.trim()
    : 'short-drama';
  const composition = resolveVimaxSkillCapabilityComposition(presetId);
  const operationOrder = [...composition.operationOrder];
  return {
    presetId: composition.presetId,
    capabilityIds: [...composition.requiredCapabilityIds],
    operationOrder,
    executionStages: deriveExecutionStageIds(operationOrder).map(id => ({ id, label: STAGE_LABELS[id] })),
  };
}

export function parseVimaxSkillRuntimeBinding(value: unknown): VimaxSkillRuntimeBinding | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.presetId !== 'string') return undefined;
  let trusted: VimaxSkillRuntimeBinding;
  try {
    trusted = resolveVimaxSkillRuntimeBinding({ skillId: record.presetId });
  } catch {
    return undefined;
  }
  const capabilityIds = Array.isArray(record.capabilityIds) ? record.capabilityIds : [];
  const operationOrder = Array.isArray(record.operationOrder) ? record.operationOrder : [];
  const executionStages = Array.isArray(record.executionStages) ? record.executionStages : [];
  const stringsMatch = (actual: unknown[], expected: string[]) => (
    actual.length === expected.length && actual.every((item, index) => item === expected[index])
  );
  const stagesMatch = executionStages.length === trusted.executionStages.length
    && executionStages.every((stage, index) => {
      if (!stage || typeof stage !== 'object' || Array.isArray(stage)) return false;
      const stageRecord = stage as Record<string, unknown>;
      const expected = trusted.executionStages[index];
      return stageRecord.id === expected.id && stageRecord.label === expected.label;
    });
  return stringsMatch(capabilityIds, trusted.capabilityIds)
    && stringsMatch(operationOrder, trusted.operationOrder)
    && stagesMatch
    ? trusted
    : undefined;
}
