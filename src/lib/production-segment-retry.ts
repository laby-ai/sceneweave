import type { ProductionAssemblyPlan, ProductionSegmentPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import {
  createTask,
  getTaskFresh,
  retryTask,
  updateTask,
} from '@/lib/task-manager';

export interface RetryProductionSegmentInput {
  childTaskId?: string;
  parentTaskId?: string;
  segmentIndex?: number;
}

export interface RetryProductionSegmentResult {
  success: true;
  usedRealKey: false;
  incurredCost: false;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
  childStatus: string;
  retryCount: number;
  nextAction: string;
}

export class ProductionSegmentRetryError extends Error {
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProductionSegmentRetryError';
    this.status = status;
    this.details = details;
  }
}

function getSegmentLocator(input: RetryProductionSegmentInput) {
  if (input.childTaskId) {
    const childTask = getTaskFresh(input.childTaskId);
    const parentTaskId = typeof childTask?.config?.parentTaskId === 'string'
      ? childTask.config.parentTaskId
      : undefined;
    const segmentIndex = typeof childTask?.config?.assemblySegmentIndex === 'number'
      ? childTask.config.assemblySegmentIndex
      : Number(childTask?.config?.assemblySegmentIndex);
    return { childTask, parentTaskId, segmentIndex };
  }

  return {
    childTask: undefined,
    parentTaskId: input.parentTaskId,
    segmentIndex: typeof input.segmentIndex === 'number' ? input.segmentIndex : Number(input.segmentIndex),
  };
}

function recomputeAssemblyStatus(segments: ProductionSegmentPlan[]): ProductionAssemblyPlan['status'] {
  const completedCount = segments.filter(segment => segment.status === 'completed').length;
  const failedCount = segments.filter(segment => segment.status === 'failed').length;
  const runningCount = segments.filter(segment => segment.status === 'running').length;
  if (failedCount > 0) return 'failed';
  if (completedCount === segments.length) return 'completed';
  if (runningCount > 0 || completedCount > 0) return 'partial';
  return 'planned';
}

function createSegmentTask(
  parentTaskId: string,
  productionProject: ProductionProject,
  assemblyPlan: ProductionAssemblyPlan,
  segment: ProductionSegmentPlan
) {
  return createTask('video', {
    prompt: segment.prompt,
    duration: String(segment.duration),
    ratio: productionProject.ratio || '16:9',
    style: productionProject.style,
    workflow: 'production-assembly-segment',
    parentTaskId,
    productionProjectId: assemblyPlan.productionProjectId,
    assemblySourceTaskId: assemblyPlan.sourceTaskId,
    assemblySegmentId: segment.id,
    assemblySegmentIndex: segment.index,
    shotId: segment.shotId,
    noAutoStart: true,
    costGuard: 'retry-queued-only-no-provider-call',
  });
}

function updateParentForRetry(
  parentTaskId: string,
  segmentIndex: number,
  childTaskId: string
) {
  const parentTask = getTaskFresh(parentTaskId);
  const assemblyPlan = parentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  if (!parentTask?.result || !assemblyPlan) return null;

  const segments = assemblyPlan.segments.map(segment => {
    if (segment.index > segmentIndex && segment.status === 'skipped') {
      return {
        ...segment,
        status: 'queued' as const,
        error: null,
        expectedInputs: {
          ...segment.expectedInputs,
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceAssetId: null,
          continuityPrompt: `等待第 ${segmentIndex + 1} 段重试完成并写回 lastFrameUrl 后再启动。`,
          previousAudioCue: null,
          audioContinuityPrompt: `等待第 ${segmentIndex + 1} 段重试完成并写回声音状态后再启动。`,
          previousStoryStateCue: null,
          storyContinuityPrompt: `等待第 ${segmentIndex + 1} 段重试完成并写回故事状态后再启动。`,
        },
        expectedOutputs: {
          ...segment.expectedOutputs,
          videoUrl: null,
          lastFrameUrl: null,
          providerTaskId: null,
        },
      };
    }
    if (segment.index !== segmentIndex) return segment;
    return {
      ...segment,
      status: 'queued' as const,
      error: null,
      startedAt: undefined,
      completedAt: undefined,
      expectedOutputs: {
        ...segment.expectedOutputs,
        taskId: childTaskId,
        videoUrl: null,
        lastFrameUrl: null,
        providerTaskId: null,
      },
    };
  });

  const status = recomputeAssemblyStatus(segments);
  const completedCount = segments.filter(segment => segment.status === 'completed').length;
  const firstFailed = segments.find(segment => segment.status === 'failed');

  const updatedPlan: ProductionAssemblyPlan = {
    ...assemblyPlan,
    status,
    segments,
    recovery: {
      ...assemblyPlan.recovery,
      resumeFromSegmentIndex: firstFailed?.index ?? completedCount,
    },
    nextAction: '失败片段已重新排队。确认 BYOK 视频模型后，可再次启动该片段；成功后会写回 videoUrl/lastFrameUrl。',
  };

  const assemblyQueue = parentTask.result.assemblyQueue && typeof parentTask.result.assemblyQueue === 'object'
    ? {
      ...parentTask.result.assemblyQueue,
      status,
      childTaskIds: Array.from(new Set([
        ...parentTask.result.assemblyQueue.childTaskIds,
        childTaskId,
      ])),
      updatedAt: new Date().toISOString(),
    }
    : parentTask.result.assemblyQueue;

  return updateTask(parentTaskId, {
    result: {
      ...parentTask.result,
      assemblyPlan: updatedPlan,
      assemblyQueue,
    },
    message: `第 ${segmentIndex + 1} 个片段已重新排队，等待重新启动。`,
  });
}

export function retryProductionAssemblySegment(
  input: RetryProductionSegmentInput
): RetryProductionSegmentResult {
  const { childTask, parentTaskId, segmentIndex } = getSegmentLocator(input);

  if (!parentTaskId || !Number.isFinite(segmentIndex)) {
    throw new ProductionSegmentRetryError(
      '请提供 childTaskId，或同时提供 parentTaskId 与 segmentIndex。',
      400
    );
  }

  const parentTask = getTaskFresh(parentTaskId);
  const assemblyPlan = parentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  const productionProject = parentTask?.result?.productionProject as ProductionProject | undefined;
  const segment = assemblyPlan?.segments.find(item => item.index === segmentIndex);
  const resolvedChildTask = childTask || (segment?.expectedOutputs.taskId
    ? getTaskFresh(segment.expectedOutputs.taskId)
    : undefined);

  if (!parentTask?.result || !assemblyPlan || !productionProject || !segment) {
    throw new ProductionSegmentRetryError(
      '父任务、制作项目或片段计划不存在，请先运行导演链和 assembly-plan。',
      404
    );
  }

  if (resolvedChildTask && resolvedChildTask.config?.workflow !== 'production-assembly-segment') {
    throw new ProductionSegmentRetryError('目标任务不是绘影片段视频子任务，拒绝重试。', 400);
  }

  if (segment.status === 'completed' || (segment.status !== 'failed' && segment.expectedOutputs?.videoUrl)) {
    throw new ProductionSegmentRetryError(
      '该片段已有完成视频，无需重新排队。若要覆盖生成，请先清除该片段 videoUrl。',
      409,
      { parentTaskId, segmentIndex }
    );
  }

  if (resolvedChildTask?.status === 'completed') {
    throw new ProductionSegmentRetryError(
      '该片段已经完成，无需重新排队。若要覆盖生成，请先清除对应片段结果。',
      409
    );
  }

  let childTaskId = resolvedChildTask?.id;
  let childStatus = resolvedChildTask?.status || 'missing';
  let retryCount = resolvedChildTask?.config?.retryCount || 0;

  if (!resolvedChildTask) {
    childTaskId = createSegmentTask(parentTaskId, productionProject, assemblyPlan, segment);
    childStatus = 'pending';
  } else if (resolvedChildTask.status === 'failed' || resolvedChildTask.status === 'cancelled') {
    const retriedTask = retryTask(resolvedChildTask.id);
    if (!retriedTask) {
      throw new ProductionSegmentRetryError(
        '子任务状态不允许重试，请刷新任务中心后再试。',
        409
      );
    }
    childTaskId = retriedTask.id;
    childStatus = retriedTask.status;
    retryCount = retriedTask.config.retryCount || 0;
  }

  const updatedParent = updateParentForRetry(parentTaskId, segmentIndex, childTaskId!);
  if (!updatedParent) {
    throw new ProductionSegmentRetryError('父任务状态更新失败，请刷新任务中心后重试。', 500);
  }

  return {
    success: true,
    usedRealKey: false,
    incurredCost: false,
    parentTaskId,
    childTaskId: childTaskId!,
    segmentIndex,
    childStatus,
    retryCount,
    nextAction: '片段已重新排队。下一步可调用 segment/start，带 BYOK headers 且显式 allowRealCost=true 才会真实生成。',
  };
}
