import type { BYOKConnection } from '@/lib/byok-provider';
import type {
  VimaxAgentPlan,
  VimaxAgentReferenceAsset,
} from './vimax-agent-contract';
import { callVimaxReferenceImages, type VimaxSubjectReferenceRegistry } from './vimax-reference-assets';
import {
  assertVimaxProductionPlanForPhase,
  type VimaxProductionPlan,
} from './vimax-production-plan';
import { resolveVimaxSkillPresetForRuntime } from './vimax-skill-presets';
import { updateTask, type BackgroundTask } from '@/lib/task-manager';

export interface VimaxReferencePhaseConfig {
  textModel: string;
  imageModel: string;
  videoModel: string;
  imageApiKey: string;
  imageApiBase: string;
  selectorApiKey: string;
  selectorApiBase: string;
  selectorModel?: string;
}

export interface VimaxReferencePhaseInput {
  task: BackgroundTask;
  plan: VimaxAgentPlan;
  productionPlan: VimaxProductionPlan;
  planningConnection?: BYOKConnection;
  imageConnection?: BYOKConnection;
  initialReferenceAssets?: VimaxAgentReferenceAsset[];
  config: VimaxReferencePhaseConfig;
}

export async function runVimaxReferenceAssetsPhase(input: VimaxReferencePhaseInput) {
  const productionPlan = assertVimaxProductionPlanForPhase(input.productionPlan, 'reference_assets', {
    plan: input.planningConnection?.model || input.config.textModel,
    referenceAssets: input.imageConnection?.imageModel || input.planningConnection?.imageModel || input.config.imageModel,
    video: input.config.videoModel,
  });
  const preset = resolveVimaxSkillPresetForRuntime(productionPlan.workflow.presetId);
  if (!productionPlan.continuity) {
    throw new Error('制作计划缺少连续性契约，请返回计划阶段重新确认。');
  }

  const result = await callVimaxReferenceImages({
    plan: input.plan,
    preset,
    continuity: productionPlan.continuity,
    config: {
      imageApiKey: input.imageConnection?.apiKey || input.config.imageApiKey,
      imageApiBase: input.imageConnection?.apiBase || input.config.imageApiBase,
      imageModel: input.imageConnection?.imageModel || input.planningConnection?.imageModel || input.config.imageModel,
      selectorApiKey: input.config.selectorApiKey,
      selectorApiBase: input.config.selectorApiBase,
      selectorModel: input.planningConnection?.model || input.config.selectorModel,
    },
    existingAssets: Array.isArray(input.task.result?.vimaxReferenceAssets)
      ? input.task.result.vimaxReferenceAssets as VimaxAgentReferenceAsset[]
      : [],
    existingSubjectRegistry: input.task.result?.vimaxSubjectReferenceRegistry as VimaxSubjectReferenceRegistry | undefined,
    initialReferenceAssets: input.initialReferenceAssets,
  });

  if (!updateTask(input.task.id, {
    result: {
      ...(input.task.result || {}),
      vimaxReferenceAssets: result.assets,
      vimaxSubjectReferenceRegistry: result.subjectRegistry,
    },
  })) throw new Error('角色定妆与参考素材保存失败。');

  return { productionPlan, ...result };
}
