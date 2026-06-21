import type { BackgroundTask } from './task-manager';
import { getTaskFresh, updateTask } from './task-manager';
import { markAssemblyPlanStaleForProjectChange } from './production-artifact-stale';
import type { ProductionAssemblyPlan } from './production-assembly-plan';
import type { ProductionProject } from './production-project';
import type { ShotStatus } from './video-production/types';

type ProductionStoryboardShot = ProductionProject['storyboard']['shots'][number];

export interface ProductionStoryboardShotPatchInput {
  prompt?: unknown;
  duration?: unknown;
  shotType?: unknown;
  shotTypeLabel?: unknown;
  subtitleText?: unknown;
  narrationText?: unknown;
  status?: unknown;
}

export interface ProductionStoryboardShotWritebackResult {
  task: BackgroundTask;
  productionProject: ProductionProject;
  shot: ProductionStoryboardShot;
  changedFields: string[];
}

const allowedStatuses = new Set<ProductionStoryboardShot['status']>([
  'planned',
  'ready',
  'running',
  'failed',
  'completed',
  'pending',
]);

function asText(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} 不能为空`);
  return trimmed;
}

function asOptionalText(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串`);
  return value.trim();
}

function asDuration(value: unknown) {
  if (value === undefined) return undefined;
  const duration = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(duration) || duration < 1 || duration > 120) {
    throw new Error('duration 必须是 1 到 120 秒之间的数字');
  }
  return Math.round(duration);
}

function asStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowedStatuses.has(value as ProductionStoryboardShot['status'])) {
    throw new Error(`status 不受支持：${String(value)}`);
  }
  return value as ProductionStoryboardShot['status'];
}

function getProductionProject(task: BackgroundTask) {
  const project = task.result?.productionProject;
  if (!project || typeof project !== 'object') {
    throw new Error(`任务 ${task.id} 缺少 productionProject，无法写回分镜镜头`);
  }
  return project as ProductionProject;
}

function toShotListStatus(status: ProductionStoryboardShot['status']): ShotStatus {
  if (status === 'running') return 'generating';
  if (status === 'completed') return 'approved';
  if (status === 'failed') return 'revision';
  return 'planned';
}

function updateShotList(project: ProductionProject, nextShot: ProductionStoryboardShot) {
  return {
    ...project.semanticPlan.shotList,
    scenes: project.semanticPlan.shotList.scenes.map(scene => ({
      ...scene,
      shots: scene.shots.map(shot => (
        shot.shotId === nextShot.id
          ? {
              ...shot,
              duration: nextShot.duration,
              description: nextShot.prompt,
              visualPrompt: nextShot.prompt,
              dialogue: nextShot.subtitleText || nextShot.narrationText || '',
              status: toShotListStatus(nextShot.status),
              version: (shot.version || 1) + 1,
            }
          : shot
      )),
    })),
  };
}

function updateDag(project: ProductionProject, nextShot: ProductionStoryboardShot) {
  return {
    ...project.semanticPlan.dag,
    nodes: project.semanticPlan.dag.nodes.map(node => (
      node.nodeId === `n_video_${nextShot.id}`
        ? {
            ...node,
            name: `视频片段-${nextShot.index}`,
            status: nextShot.status === 'ready' ? 'pending' : node.status,
            result: {
              ...node.result,
              shotId: nextShot.id,
              expectedDuration: nextShot.duration,
              prompt: nextShot.prompt,
              subtitleText: nextShot.subtitleText,
              narrationText: nextShot.narrationText,
              shotType: nextShot.shotType,
              shotTypeLabel: nextShot.shotTypeLabel,
            },
          }
        : node
    )),
  };
}

export function patchProductionStoryboardShotFromCanvas(params: {
  taskId: string;
  shotId: string;
  patch: ProductionStoryboardShotPatchInput;
}): ProductionStoryboardShotWritebackResult {
  const taskId = params.taskId.trim();
  const shotId = params.shotId.trim();

  if (!taskId) throw new Error('缺少 taskId');
  if (!shotId) throw new Error('缺少 shotId');

  const task = getTaskFresh(taskId);
  if (!task) throw new Error(`任务 ${taskId} 不存在或已过期`);

  const productionProject = getProductionProject(task);
  const shotIndex = productionProject.storyboard.shots.findIndex(shot => shot.id === shotId);
  if (shotIndex < 0) {
    throw new Error(`制作项目 ${productionProject.id} 中不存在镜头 ${shotId}`);
  }

  const currentShot = productionProject.storyboard.shots[shotIndex];
  const nextShot: ProductionStoryboardShot = { ...currentShot };
  const changedFields: string[] = [];

  const prompt = asText(params.patch.prompt, 'prompt');
  if (prompt !== undefined && prompt !== currentShot.prompt) {
    nextShot.prompt = prompt;
    changedFields.push('prompt');
  }

  const duration = asDuration(params.patch.duration);
  if (duration !== undefined && duration !== currentShot.duration) {
    nextShot.duration = duration;
    changedFields.push('duration');
  }

  const shotType = asOptionalText(params.patch.shotType, 'shotType');
  if (shotType !== undefined && shotType !== (currentShot.shotType || '')) {
    nextShot.shotType = shotType;
    changedFields.push('shotType');
  }

  const shotTypeLabel = asOptionalText(params.patch.shotTypeLabel, 'shotTypeLabel');
  if (shotTypeLabel !== undefined && shotTypeLabel !== (currentShot.shotTypeLabel || '')) {
    nextShot.shotTypeLabel = shotTypeLabel;
    changedFields.push('shotTypeLabel');
  }

  const subtitleText = asOptionalText(params.patch.subtitleText, 'subtitleText');
  if (subtitleText !== undefined && subtitleText !== (currentShot.subtitleText || '')) {
    nextShot.subtitleText = subtitleText;
    changedFields.push('subtitleText');
  }

  const narrationText = asOptionalText(params.patch.narrationText, 'narrationText');
  if (narrationText !== undefined && narrationText !== (currentShot.narrationText || '')) {
    nextShot.narrationText = narrationText;
    changedFields.push('narrationText');
  }

  const status = asStatus(params.patch.status);
  if (status !== undefined && status !== currentShot.status) {
    nextShot.status = status;
    changedFields.push('status');
  }

  if (changedFields.length === 0) {
    return { task, productionProject, shot: currentShot, changedFields };
  }

  const nextShots = productionProject.storyboard.shots.map((shot, index) => (
    index === shotIndex ? nextShot : shot
  ));
  const totalDuration = nextShots.reduce((sum, shot) => sum + shot.duration, 0);
  const storyboardAssetId = productionProject.semanticPlan.assetLinks.storyboardAssetId;

  const nextProject: ProductionProject = {
    ...productionProject,
    duration: totalDuration,
    semanticPlan: {
      ...productionProject.semanticPlan,
      shotList: updateShotList(productionProject, nextShot),
      dag: updateDag(productionProject, nextShot),
    },
    assets: productionProject.assets.map(asset => (
      asset.id === storyboardAssetId
        ? {
            ...asset,
            summary: `${nextShots.length} 个镜头，约 ${totalDuration}s，已从画布更新镜头 ${nextShot.index}`,
            metadata: {
              ...(asset.metadata || {}),
              updatedShotId: nextShot.id,
              updatedFromCanvasAt: new Date().toISOString(),
            },
          }
        : asset
    )),
    storyboard: {
      ...productionProject.storyboard,
      shotCount: nextShots.length,
      totalDuration,
      shots: nextShots,
    },
  };
  const stale = markAssemblyPlanStaleForProjectChange({
    productionProject: nextProject,
    assemblyPlan: task.result?.assemblyPlan as ProductionAssemblyPlan | undefined,
    changedShotIds: [shotId],
    reason: 'storyboard-shot-writeback',
  });

  const updatedTask = updateTask(task.id, {
    result: {
      ...(task.result || {}),
      productionProject: nextProject,
      ...(stale.assemblyPlan ? { assemblyPlan: stale.assemblyPlan } : {}),
    },
  });

  if (!updatedTask) throw new Error(`任务 ${task.id} 写回失败`);

  return {
    task: updatedTask,
    productionProject: nextProject,
    shot: nextShot,
    changedFields,
  };
}
