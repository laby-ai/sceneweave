import { buildProductionAssemblyPlan, type ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject, ProductionStoryBible } from '@/lib/production-project';
import { getTaskForOwner, updateTask, type TaskOwner } from '@/lib/task-manager';
import {
  buildVimaxProductionPlan,
  parseVimaxProductionPlan,
  refreshVimaxProductionPlanContinuity,
  skipsVimaxReferenceAssets,
  type VimaxProductionPlan,
} from '@/lib/skills/vimax-short-drama/vimax-production-plan';

export interface VimaxStoryBiblePatch {
  premise?: unknown;
  protagonist?: unknown;
  desire?: unknown;
  obstacle?: unknown;
  relationship?: unknown;
  conflict?: unknown;
  turningPoint?: unknown;
  endingHook?: unknown;
  emotionalArc?: {
    start?: unknown;
    shift?: unknown;
    end?: unknown;
  };
  continuityRules?: unknown;
}

export interface VimaxStoryBibleWriteback {
  productionProject: ProductionProject;
  productionPlan: VimaxProductionPlan;
  assemblyPlan: ProductionAssemblyPlan;
}

function requiredText(value: unknown, fallback: string, field: string, maxLength = 800) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} 不能为空`);
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function continuityRules(value: unknown, fallback: string[]) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) throw new Error('连续性规则格式不正确');
  const rules = value
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
  if (rules.length === 0) throw new Error('至少保留一条连续性规则');
  return rules;
}

function patchStoryBible(current: ProductionStoryBible, patch: VimaxStoryBiblePatch): ProductionStoryBible {
  return {
    ...current,
    premise: requiredText(patch.premise, current.premise, '故事前提'),
    protagonist: requiredText(patch.protagonist, current.protagonist, '主角'),
    desire: requiredText(patch.desire, current.desire, '角色目标'),
    obstacle: requiredText(patch.obstacle, current.obstacle, '主要阻碍'),
    relationship: requiredText(patch.relationship, current.relationship, '人物关系'),
    conflict: requiredText(patch.conflict, current.conflict, '核心冲突'),
    turningPoint: requiredText(patch.turningPoint, current.turningPoint, '中段转折'),
    endingHook: requiredText(patch.endingHook, current.endingHook, '结尾钩子'),
    emotionalArc: {
      start: requiredText(patch.emotionalArc?.start, current.emotionalArc.start, '起始情绪', 200),
      shift: requiredText(patch.emotionalArc?.shift, current.emotionalArc.shift, '转折情绪', 200),
      end: requiredText(patch.emotionalArc?.end, current.emotionalArc.end, '结尾情绪', 200),
    },
    continuityRules: continuityRules(patch.continuityRules, current.continuityRules),
  };
}

function rebuildProductionPlan(
  previous: VimaxProductionPlan,
  productionProject: ProductionProject,
  assemblyPlan: ProductionAssemblyPlan,
) {
  const route = (stage: 'plan' | 'reference_assets' | 'video') =>
    previous.providerRoutes.find(item => item.stage === stage);
  const fresh = buildVimaxProductionPlan({
    title: previous.title,
    ratio: previous.preferences.ratio,
    resolution: previous.preferences.resolution,
    planModel: route('plan')?.model || '',
    imageModel: route('reference_assets')?.model || '',
    videoModel: route('video')?.model || '',
    providerReadiness: {
      plan: Boolean(route('plan')?.ready),
      referenceAssets: Boolean(route('reference_assets')?.ready),
      video: Boolean(route('video')?.ready),
    },
    referenceAssetsRequired: !skipsVimaxReferenceAssets(previous),
    assets: productionProject.assets
      .filter(asset => ['script', 'character', 'scene', 'prop', 'storyboard'].includes(asset.kind))
      .map(asset => ({ kind: asset.kind, label: asset.name, prompt: asset.summary })),
    shots: productionProject.storyboard.shots.map(shot => ({
      index: shot.index,
      title: shot.phaseLabel || shot.dramaticPurpose || `镜头 ${shot.index}`,
      duration: shot.duration,
      camera: shot.shotTypeLabel || shot.shotType || '电影分镜',
      prompt: shot.prompt,
    })),
    workflow: previous.workflow,
  });
  return refreshVimaxProductionPlanContinuity({
    productionPlan: fresh,
    productionProject,
    assemblyPlan,
  });
}

export function updateVimaxStoryBibleForTask(input: {
  taskId: string;
  owner: TaskOwner;
  patch: VimaxStoryBiblePatch;
}): VimaxStoryBibleWriteback {
  const task = getTaskForOwner(input.taskId, input.owner);
  if (!task) throw new Error('创作项目不存在或无权访问');
  const project = task.result?.productionProject as ProductionProject | undefined;
  const previousPlan = parseVimaxProductionPlan(task.result?.productionPlan);
  if (!project?.storyBible || !previousPlan) throw new Error('当前项目缺少完整故事与制作合约');

  const storyBible = patchStoryBible(project.storyBible, input.patch);
  const changed = JSON.stringify(storyBible) !== JSON.stringify(project.storyBible);
  if (!changed) {
    const assemblyPlan = task.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
    if (!assemblyPlan) throw new Error('当前项目缺少分段制作合约');
    return { productionProject: project, productionPlan: previousPlan, assemblyPlan };
  }

  const productionProject: ProductionProject = {
    ...project,
    prompt: storyBible.premise,
    storyBible,
    assets: project.assets.map(asset => asset.kind === 'script'
      ? {
          ...asset,
          summary: storyBible.premise,
          metadata: {
            ...(asset.metadata || {}),
            storyBibleUpdatedAt: new Date().toISOString(),
          },
        }
      : asset),
  };
  const assemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: task.id });
  const productionPlan = rebuildProductionPlan(previousPlan, productionProject, assemblyPlan);
  const {
    vimaxReferenceAssets: _staleReferences,
    vimaxVideoResult: _staleVideo,
    ...retainedResult
  } = task.result || {};
  void _staleReferences;
  void _staleVideo;

  const updated = updateTask(task.id, {
    result: {
      ...retainedResult,
      productionProject,
      productionPlan,
      assemblyPlan,
    },
  });
  if (!updated) throw new Error('故事与角色 Bible 写回失败');
  return { productionProject, productionPlan, assemblyPlan };
}
