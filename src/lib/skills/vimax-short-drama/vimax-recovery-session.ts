import { createTask, type TaskOwner } from '@/lib/task-manager';
import type { VimaxAgentPlan, VimaxAgentStepBody } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import { buildProductionBackedVimaxPlan } from '@/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { persistVimaxPlanTask } from '@/lib/skills/vimax-short-drama/vimax-plan-task';
import { parseVimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import { applyVimaxShotGenerationRoutes } from '@/lib/skills/vimax-short-drama/vimax-shot-generation-route';
import { resolveVimaxSkillPresetForRuntime } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

const DAY_MS = 24 * 60 * 60 * 1000;
const ASSET_KINDS = new Set<VimaxAgentPlan['assets'][number]['kind']>([
  'script', 'character', 'scene', 'prop', 'shot', 'reference',
]);
const SPATIAL_RELATIONS = new Set(['same-scene', 'new-scene']);
const TEMPORAL_RELATIONS = new Set(['continuous', 'elapsed', 'time-jump']);
const ROUTE_CONFIDENCE = new Set(['high', 'medium', 'low']);

function requiredText(value: unknown, label: string, maxLength = 8_000) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`恢复快照缺少${label}。`);
  return text.slice(0, maxLength);
}

function optionalText(value: unknown, maxLength = 8_000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function parseVimaxRecoveryPlan(value: unknown): VimaxAgentPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('恢复快照缺少创作计划。');
  }
  const raw = value as Partial<VimaxAgentPlan>;
  if (!Array.isArray(raw.shots) || raw.shots.length < 1 || raw.shots.length > 8) {
    throw new Error('恢复快照的分镜数量无效。');
  }
  const shots = raw.shots.map((shot, index) => ({
    index: Number.isFinite(Number(shot?.index)) ? Math.max(1, Math.floor(Number(shot.index))) : index + 1,
    title: requiredText(shot?.title, `第 ${index + 1} 镜标题`, 200),
    duration: Math.max(1, Math.min(15, Math.floor(Number(shot?.duration) || 5))),
    camera: optionalText(shot?.camera, 1_000) || '连续镜头',
    prompt: requiredText(shot?.prompt, `第 ${index + 1} 镜描述`),
    ...(SPATIAL_RELATIONS.has(String(shot?.spatialRelation))
      ? { spatialRelation: shot?.spatialRelation as NonNullable<typeof shot.spatialRelation> }
      : {}),
    ...(TEMPORAL_RELATIONS.has(String(shot?.temporalRelation))
      ? { temporalRelation: shot?.temporalRelation as NonNullable<typeof shot.temporalRelation> }
      : {}),
    ...(ROUTE_CONFIDENCE.has(String(shot?.routeConfidence))
      ? { routeConfidence: shot?.routeConfidence as NonNullable<typeof shot.routeConfidence> }
      : {}),
    ...(Array.isArray(shot?.conflictFlags)
      ? { conflictFlags: shot.conflictFlags.filter(flag => typeof flag === 'string').slice(0, 8) }
      : {}),
    ...(typeof shot?.referenceUrl === 'string' ? { referenceUrl: shot.referenceUrl.slice(0, 4_000) } : {}),
  }));
  const assets = Array.isArray(raw.assets) ? raw.assets.slice(0, 12).map((asset, index) => {
    const kind = ASSET_KINDS.has(asset?.kind) ? asset.kind : 'reference';
    return {
      kind,
      label: requiredText(asset?.label, `第 ${index + 1} 个素材名称`, 200),
      prompt: optionalText(asset?.prompt),
      ...(typeof asset?.referenceUrl === 'string' ? { referenceUrl: asset.referenceUrl.slice(0, 4_000) } : {}),
      ...(typeof asset?.videoUrl === 'string' ? { videoUrl: asset.videoUrl.slice(0, 4_000) } : {}),
    };
  }) : [];
  return {
    title: requiredText(raw.title, '作品标题', 300),
    summary: requiredText(raw.summary, '作品梗概'),
    assets,
    shots,
    nextAction: optionalText(raw.nextAction, 1_000) || '恢复已完成片段。',
  };
}

export function resolveVimaxRecoveryCreatedAfter(value: unknown, now = Date.now()) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return now - DAY_MS;
  return Math.max(now - DAY_MS, Math.min(now, Math.floor(parsed)));
}

export function restoreVimaxRecoveryTask(input: {
  owner: TaskOwner;
  body: VimaxAgentStepBody;
}) {
  const plan = parseVimaxRecoveryPlan(input.body.plan);
  const productionPlan = parseVimaxProductionPlan(input.body.productionPlan);
  if (!productionPlan) throw new Error('恢复快照缺少有效制作合约。');
  const preset = resolveVimaxSkillPresetForRuntime(productionPlan.workflow.presetId);
  const duration = plan.shots.reduce((sum, shot) => sum + shot.duration, 0);
  const prompt = [plan.summary, ...plan.shots.map(shot => shot.prompt)].join('\n');
  const trustedBody: VimaxAgentStepBody = {
    phase: 'plan',
    skillId: preset.id,
    sceneType: preset.sceneType,
    style: preset.style,
    duration,
    segmentCount: plan.shots.length,
    segmentDuration: Math.max(1, Math.round(duration / plan.shots.length)),
    ratio: productionPlan.preferences.ratio,
    resolution: productionPlan.preferences.resolution,
  };
  const taskId = createTask('storyboard', {
    prompt,
    duration: `${duration}s`,
    ratio: trustedBody.ratio,
    resolution: trustedBody.resolution,
    style: trustedBody.style,
    sceneType: trustedBody.sceneType,
    workflow: 'vimax-agent',
    skillId: preset.id,
  }, input.owner);
  const built = buildProductionBackedVimaxPlan(prompt, plan, trustedBody, taskId);
  const configuredVideoModel = productionPlan.providerRoutes.find(route => route.stage === 'video')?.model || '';
  const routed = applyVimaxShotGenerationRoutes({
    plan: built.plan,
    assemblyPlan: built.assemblyPlan,
    provider: configuredVideoModel.startsWith('happyhorse-') ? 'happyhorse-dashscope' : 'configured-provider',
    configuredModel: configuredVideoModel,
  });
  persistVimaxPlanTask({
    taskId,
    prompt,
    plan: routed.plan,
    productionProject: built.productionProject,
    assemblyPlan: routed.assemblyPlan,
    productionPlan,
  });
  return {
    taskId,
    createdAfter: resolveVimaxRecoveryCreatedAfter(input.body.recoverCreatedAfter),
  };
}
