import type { BackgroundTask, TaskResult } from './task-manager';
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
  invalidation: {
    fromShotIndex: number;
    retainedAcceptedSegments: number;
    invalidatedShots: number;
    removedReferenceAssets: number;
    removedVideoSegments: number;
    removedFinalVideos: number;
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shotPosition(value: unknown) {
  if (!isRecord(value)) return null;
  const shotIndex = Number(value.shotIndex);
  if (Number.isInteger(shotIndex) && shotIndex > 0) return shotIndex - 1;
  const index = Number(value.index);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function retainBeforeShot<T>(value: unknown, fromShotPosition: number): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => {
    const position = shotPosition(item);
    return position === null || position < fromShotPosition;
  }) as T[];
}

function invalidateProjectFromShot(
  project: ProductionProject,
  nextShots: ProductionProject['storyboard']['shots'],
  fromShotPosition: number,
) {
  const affectedShotIds = new Set(nextShots.slice(fromShotPosition).map(shot => shot.id));
  const removedAssets = project.assets.filter(asset => {
    if (asset.kind === 'finalVideo') return true;
    if (asset.kind !== 'videoSegment') return false;
    if (!asset.relatedShotIds?.length) return true;
    return asset.relatedShotIds.some(shotId => affectedShotIds.has(shotId));
  });
  const removedAssetIds = new Set(removedAssets.map(asset => asset.id));
  const assets = project.assets
    .filter(asset => !removedAssetIds.has(asset.id))
    .map(asset => asset.kind === 'deliverable'
      ? {
          ...asset,
          status: 'pending' as const,
          summary: `镜头 ${fromShotPosition + 1} 起已调整，等待局部重做后重新交付`,
          metadata: undefined,
        }
      : asset);
  const retainedAssetIds = new Set(assets.map(asset => asset.id));

  return {
    productionProject: {
      ...project,
      assets,
      stages: project.stages.map(stage => {
        if (stage.id === 'assembly') {
          return {
            ...stage,
            status: 'pending' as const,
            summary: `已保留前 ${fromShotPosition} 个镜头，等待重做镜头 ${fromShotPosition + 1} 及后续镜头`,
            assetIds: stage.assetIds.filter(assetId => retainedAssetIds.has(assetId)),
          };
        }
        if (stage.id === 'delivery') {
          return {
            ...stage,
            status: 'pending' as const,
            summary: '等待受影响镜头完成后重新生成成片',
            assetIds: stage.assetIds.filter(assetId => retainedAssetIds.has(assetId)),
          };
        }
        return {
          ...stage,
          assetIds: stage.assetIds.filter(assetId => retainedAssetIds.has(assetId)),
        };
      }),
      graph: {
        nodes: project.graph.nodes.filter(node => retainedAssetIds.has(node.id)),
        edges: project.graph.edges.filter(edge =>
          retainedAssetIds.has(edge.from) && retainedAssetIds.has(edge.to)),
      },
      storyboard: {
        ...project.storyboard,
        shots: nextShots.map((shot, index) => (
          index >= fromShotPosition ? { ...shot, status: 'planned' as const } : shot
        )),
      },
      output: {
        ...project.output,
        status: 'pending' as const,
        canProceedToVideo: false,
        nextStep: `仅重做镜头 ${fromShotPosition + 1} 及后续受影响镜头`,
      },
    } satisfies ProductionProject,
    removedVideoSegments: removedAssets.filter(asset => asset.kind === 'videoSegment').length,
    removedFinalVideos: removedAssets.filter(asset => asset.kind === 'finalVideo').length,
  };
}

function invalidateTaskResultFromShot(
  result: TaskResult,
  fromShotPosition: number,
  productionProject: ProductionProject,
  assemblyPlan: ProductionAssemblyPlan | undefined,
) {
  const retainedReferences = retainBeforeShot<Record<string, unknown>>(
    result.vimaxReferenceAssets,
    fromShotPosition,
  );
  const retainedHappyHorseSegments = retainBeforeShot<Record<string, unknown>>(
    result.vimaxHappyHorseSegments,
    fromShotPosition,
  );
  const retainedLegacySegments = retainBeforeShot<NonNullable<TaskResult['segments']>[number]>(
    result.segments,
    fromShotPosition,
  );
  const {
    vimaxReferenceAssets: _references,
    vimaxReferenceTaskId: _referenceTaskId,
    vimaxVideoResult: _videoResult,
    vimaxVideoTaskId: _videoTaskId,
    vimaxVideoTaskStatus: _videoTaskStatus,
    vimaxHappyHorseSegments: _happyHorseSegments,
    assemblyQueue: _assemblyQueue,
    videoUrl: _videoUrl,
    imageUrls: _imageUrls,
    segments: _segments,
    isPartial: _isPartial,
    failedSegments: _failedSegments,
    failedSegmentsDetails: _failedSegmentDetails,
    successSegmentCount: _successSegmentCount,
    segmentCount: _segmentCount,
    ...retainedResult
  } = result;
  void _references;
  void _referenceTaskId;
  void _videoResult;
  void _videoTaskId;
  void _videoTaskStatus;
  void _happyHorseSegments;
  void _assemblyQueue;
  void _videoUrl;
  void _imageUrls;
  void _segments;
  void _isPartial;
  void _failedSegments;
  void _failedSegmentDetails;
  void _successSegmentCount;
  void _segmentCount;

  return {
    ...retainedResult,
    productionProject,
    ...(assemblyPlan ? { assemblyPlan } : {}),
    ...(retainedReferences.length > 0
      ? {
          vimaxReferenceAssets: retainedReferences,
          imageUrls: retainedReferences
            .map(asset => typeof asset.url === 'string' ? asset.url : '')
            .filter(Boolean),
        }
      : {}),
    ...(retainedHappyHorseSegments.length > 0
      ? { vimaxHappyHorseSegments: retainedHappyHorseSegments }
      : {}),
    ...(retainedLegacySegments.length > 0
      ? {
          segments: retainedLegacySegments,
          isPartial: true,
          successSegmentCount: retainedLegacySegments.filter(segment =>
            segment.status === 'completed' || Boolean(segment.videoUrl)).length,
          segmentCount: productionProject.storyboard.shotCount,
        }
      : {}),
  } satisfies TaskResult;
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
    return {
      task,
      productionProject,
      shot: currentShot,
      changedFields,
      invalidation: {
        fromShotIndex: currentShot.index,
        retainedAcceptedSegments: 0,
        invalidatedShots: 0,
        removedReferenceAssets: 0,
        removedVideoSegments: 0,
        removedFinalVideos: 0,
      },
    };
  }

  const nextShots = productionProject.storyboard.shots.map((shot, index) => (
    index === shotIndex ? nextShot : shot
  ));
  const totalDuration = nextShots.reduce((sum, shot) => sum + shot.duration, 0);
  const storyboardAssetId = productionProject.semanticPlan.assetLinks.storyboardAssetId;

  const editedProject: ProductionProject = {
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
  const invalidated = invalidateProjectFromShot(editedProject, nextShots, shotIndex);
  const nextProject = invalidated.productionProject;
  const stale = markAssemblyPlanStaleForProjectChange({
    productionProject: nextProject,
    assemblyPlan: task.result?.assemblyPlan as ProductionAssemblyPlan | undefined,
    changedShotIds: [shotId],
    reason: 'storyboard-shot-writeback',
  });
  const retainedReferences = retainBeforeShot<Record<string, unknown>>(
    task.result?.vimaxReferenceAssets,
    shotIndex,
  );
  const retainedAcceptedSegments = retainBeforeShot<Record<string, unknown>>(
    task.result?.vimaxHappyHorseSegments,
    shotIndex,
  ).length;
  const removedReferenceAssets = Array.isArray(task.result?.vimaxReferenceAssets)
    ? task.result.vimaxReferenceAssets.length - retainedReferences.length
    : 0;

  const updatedTask = updateTask(task.id, {
    result: invalidateTaskResultFromShot(
      task.result || {},
      shotIndex,
      nextProject,
      stale.assemblyPlan,
    ),
    message: `已保留前 ${shotIndex} 个完成镜头；镜头 ${shotIndex + 1} 及后续内容等待局部重做。`,
  });

  if (!updatedTask) throw new Error(`任务 ${task.id} 写回失败`);

  return {
    task: updatedTask,
    productionProject: nextProject,
    shot: nextProject.storyboard.shots[shotIndex],
    changedFields,
    invalidation: {
      fromShotIndex: nextShot.index,
      retainedAcceptedSegments,
      invalidatedShots: nextShots.length - shotIndex,
      removedReferenceAssets,
      removedVideoSegments: invalidated.removedVideoSegments,
      removedFinalVideos: invalidated.removedFinalVideos,
    },
  };
}
