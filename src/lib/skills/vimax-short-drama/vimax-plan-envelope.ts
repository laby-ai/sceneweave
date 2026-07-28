import type { BYOKConnection } from '@/lib/byok-provider';
import { isHappyHorseR2VModel } from '@/lib/happyhorse-r2v-adapter';
import { createTask, type TaskOwner } from '@/lib/task-manager';
import type { VimaxAgentPlan, VimaxAgentStepBody } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import { buildProductionBackedVimaxPlan } from '@/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { persistVimaxPlanTask } from '@/lib/skills/vimax-short-drama/vimax-plan-task';
import { buildVimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '@/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';
import { applyVimaxShotGenerationRoutes } from '@/lib/skills/vimax-short-drama/vimax-shot-generation-route';
import { normalizeVimaxInitialReferenceIds } from '@/lib/skills/vimax-short-drama/vimax-initial-references';
import { normalizeVimaxProjectAttachmentIds } from '@/lib/skills/vimax-short-drama/vimax-project-attachments';
import {
  buildVimaxContinuityContract,
  resolveVimaxProviderHandoffMode,
} from '@/lib/skills/vimax-short-drama/vimax-continuity-contract';

interface VimaxPlanEnvelopeConfig {
  apiKey?: string;
  imageApiKey?: string;
  imageModel: string;
  videoModel: string;
}

interface CreatePersistedVimaxPlanEnvelopeInput {
  owner: TaskOwner;
  prompt: string;
  model: string;
  basePlan: VimaxAgentPlan;
  body: VimaxAgentStepBody;
  config: VimaxPlanEnvelopeConfig;
  planConnection?: BYOKConnection;
  imageConnection?: BYOKConnection;
  videoConnection?: BYOKConnection;
  existingTaskId?: string;
}

export function createPersistedVimaxPlanEnvelope(input: CreatePersistedVimaxPlanEnvelopeInput) {
  const taskId = input.existingTaskId || createTask('storyboard', {
    prompt: input.prompt,
    duration: `${input.body.duration || 30}s`,
    ratio: input.body.ratio || '16:9',
    resolution: input.body.resolution || '720p',
    style: input.body.style || '电影感短剧',
    sceneType: input.body.sceneType || 'drama',
    workflow: 'vimax-agent',
    skillId: input.body.skillId,
    referenceIds: normalizeVimaxInitialReferenceIds(input.body.referenceIds),
    projectId: input.body.projectId,
    projectAttachmentIds: normalizeVimaxProjectAttachmentIds(input.body.projectAttachmentIds),
  }, input.owner);
  const built = buildProductionBackedVimaxPlan(input.prompt, input.basePlan, input.body, taskId);
  const workflow = resolveVimaxSkillRuntimeBinding({ skillId: input.body.skillId });
  const planModel = input.planConnection?.model || input.model;
  const imageModel = input.imageConnection?.imageModel || input.config.imageModel;
  const videoModel = input.videoConnection?.videoModel || input.config.videoModel;
  const { plan, assemblyPlan } = applyVimaxShotGenerationRoutes({
    plan: built.plan,
    assemblyPlan: built.assemblyPlan,
    provider: input.videoConnection?.provider || 'ark-video-v3',
    configuredModel: videoModel,
  });
  const continuity = buildVimaxContinuityContract({
    productionProject: built.productionProject,
    assemblyPlan,
    imageModel,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: input.videoConnection?.provider || 'ark-video-v3',
      model: videoModel,
    }),
  });
  const productionPlan = buildVimaxProductionPlan({
    title: plan.title,
    ratio: input.body.ratio || '16:9',
    resolution: input.body.resolution || '720p',
    planModel,
    imageModel,
    videoModel,
    providerReadiness: {
      plan: Boolean(input.planConnection?.apiKey || input.config.apiKey),
      referenceAssets: Boolean(
        (input.imageConnection?.apiKey && input.imageConnection.imageModel) || input.config.imageApiKey,
      ),
      video: Boolean(input.videoConnection?.videoModel && input.videoConnection.apiKey)
        || Boolean(input.config.imageApiKey),
    },
    referenceAssetsRequired: input.videoConnection?.provider !== 'happyhorse-dashscope'
      || isHappyHorseR2VModel(videoModel),
    assets: plan.assets,
    shots: plan.shots,
    workflow,
    continuity,
  });
  persistVimaxPlanTask({
    taskId,
    prompt: input.prompt,
    plan,
    productionPlan,
    productionProject: built.productionProject,
    assemblyPlan,
  });
  return { taskId, plan, productionPlan };
}
