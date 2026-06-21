import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import { applySegmentAssetWriteback } from '@/lib/production-segment-assets';
import { evaluateSegmentTailFrameForHandoff } from '@/lib/production-segment-tail-frame';
import {
  completeTask,
  getTaskFresh,
  updateTask,
} from '@/lib/task-manager';
import { extractLastFrameForHandoff } from '@/lib/video-frame-extraction';

function segmentAudioCue(segment: ProductionAssemblyPlan['segments'][number] | undefined) {
  return segment?.audioState?.audioCue || segment?.shotFrameContract?.audioDescription || null;
}

export interface RecoverProductionSegmentTailFrameInput {
  childTaskId: string;
}

export interface RecoverProductionSegmentTailFrameResult {
  success: true;
  usedRealKey: false;
  incurredCost: false;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
  lastFrameSource: 'provider' | 'extracted' | null;
  uploadSource: string | null;
  nextSegmentFirstFrameUrl?: string | null;
}

export class ProductionSegmentTailRecoveryError extends Error {
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProductionSegmentTailRecoveryError';
    this.status = status;
    this.details = details;
  }
}

function getParentSegment(childTaskId: string) {
  const childTask = getTaskFresh(childTaskId);
  const parentTaskId = typeof childTask?.config?.parentTaskId === 'string'
    ? childTask.config.parentTaskId
    : undefined;
  const segmentIndex = typeof childTask?.config?.assemblySegmentIndex === 'number'
    ? childTask.config.assemblySegmentIndex
    : Number(childTask?.config?.assemblySegmentIndex);
  const parentTask = parentTaskId ? getTaskFresh(parentTaskId) : undefined;
  const assemblyPlan = parentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;

  return {
    childTask,
    parentTaskId,
    parentTask,
    assemblyPlan,
    productionProject: parentTask?.result?.productionProject as ProductionProject | undefined,
    segmentIndex,
    segment: assemblyPlan?.segments.find(item => item.index === segmentIndex),
  };
}

function isWritebackReadyProject(project?: ProductionProject): project is ProductionProject {
  return Boolean(
    project
    && Array.isArray(project.assets)
    && Array.isArray(project.stages)
    && project.graph
    && Array.isArray(project.graph.nodes)
    && Array.isArray(project.graph.edges)
    && project.storyboard
    && Array.isArray(project.storyboard.shots)
    && project.semanticPlan
    && project.semanticPlan.dag
    && Array.isArray(project.semanticPlan.dag.nodes)
    && project.output
  );
}

function updateParentWithRecoveredTailFrame(params: {
  parentTaskId: string;
  assemblyPlan: ProductionAssemblyPlan;
  productionProject?: ProductionProject;
  segmentIndex: number;
  videoUrl: string;
  providerTaskId?: string;
  lastFrameUrl: string | null;
}) {
  const parentTask = getTaskFresh(params.parentTaskId);
  if (!parentTask?.result) return null;

  const writeback = applySegmentAssetWriteback({
    productionProject: isWritebackReadyProject(params.productionProject) ? params.productionProject : undefined,
    assemblyPlan: params.assemblyPlan,
    segmentIndex: params.segmentIndex,
    patch: {
      status: 'completed',
      error: null,
      completedAt: new Date().toISOString(),
      expectedOutputs: {
        taskId: parentTask.result.assemblyPlan?.segments?.[params.segmentIndex]?.expectedOutputs?.taskId || null,
        providerTaskId: params.providerTaskId || null,
        videoUrl: params.videoUrl,
        lastFrameUrl: params.lastFrameUrl,
        audioCue: segmentAudioCue(params.assemblyPlan.segments[params.segmentIndex]),
        hasAudio: null,
      },
    },
  });

  const assemblyQueue = parentTask.result.assemblyQueue && typeof parentTask.result.assemblyQueue === 'object'
    ? {
      ...parentTask.result.assemblyQueue,
      status: writeback.assemblyPlan.status,
      updatedAt: new Date().toISOString(),
    }
    : parentTask.result.assemblyQueue;

  return updateTask(params.parentTaskId, {
    result: {
      ...parentTask.result,
      productionProject: writeback.productionProject || parentTask.result.productionProject,
      assemblyPlan: writeback.assemblyPlan,
      assemblyQueue,
    },
    message: `第 ${params.segmentIndex + 1} 个片段尾帧已从 partial video 恢复并写回。`,
  });
}

export async function recoverProductionSegmentTailFrame(
  input: RecoverProductionSegmentTailFrameInput
): Promise<RecoverProductionSegmentTailFrameResult> {
  const {
    childTask,
    parentTaskId,
    assemblyPlan,
    productionProject,
    segmentIndex,
  } = getParentSegment(input.childTaskId);

  if (!childTask || childTask.config?.workflow !== 'production-assembly-segment') {
    throw new ProductionSegmentTailRecoveryError('目标任务不是绘影片段视频子任务。', 404);
  }
  if (!parentTaskId || !assemblyPlan || !Number.isFinite(segmentIndex)) {
    throw new ProductionSegmentTailRecoveryError('父任务或 assemblyPlan 不完整，无法恢复尾帧。', 404);
  }

  const videoUrl = typeof childTask.result?.videoUrl === 'string' ? childTask.result.videoUrl : '';
  if (!videoUrl) {
    throw new ProductionSegmentTailRecoveryError('该片段没有可复用的 partial videoUrl，必须重新生成片段。', 409);
  }

  const providerTaskId = typeof childTask.result?.providerTaskId === 'string'
    ? childTask.result.providerTaskId
    : undefined;
  const extraction = await extractLastFrameForHandoff(videoUrl);
  const tailFrame = evaluateSegmentTailFrameForHandoff({
    segmentIndex,
    segmentCount: assemblyPlan.segmentCount,
    providerLastFrameUrl: typeof childTask.result?.lastFrameUrl === 'string' ? childTask.result.lastFrameUrl : undefined,
    extractedLastFrameUrl: extraction.lastFrameUrl,
  });

  if (!tailFrame.ok) {
    updateTask(input.childTaskId, {
      result: {
        ...(childTask.result || {}),
        lastFrameExtraction: extraction.diagnostics,
      },
    });
    throw new ProductionSegmentTailRecoveryError(
      `${tailFrame.reason} ${tailFrame.nextAction} [segment-tail-frame-recovery-failed]`,
      409,
      { extraction: extraction.diagnostics }
    );
  }

  completeTask(input.childTaskId, {
    ...(childTask.result || {}),
    videoUrl,
    providerTaskId,
    lastFrameUrl: tailFrame.lastFrameUrl || undefined,
    audioCue: segmentAudioCue(assemblyPlan.segments[segmentIndex]),
    hasAudio: childTask.result?.hasAudio === true ? true : null,
    handoff: {
      requiresTailFrame: tailFrame.requiresTailFrame,
      lastFrameUrlPresent: Boolean(tailFrame.lastFrameUrl),
      lastFrameSource: tailFrame.source,
      punchThroughReady: true,
    },
    lastFrameExtraction: extraction.diagnostics,
    segments: [{
      index: segmentIndex,
      taskId: input.childTaskId,
      ...(providerTaskId ? { providerTaskId } : {}),
      status: 'completed',
      videoUrl,
      lastFrameUrl: tailFrame.lastFrameUrl || undefined,
      lastFrameSource: tailFrame.source,
      audioCue: segmentAudioCue(assemblyPlan.segments[segmentIndex]),
      hasAudio: childTask.result?.hasAudio === true ? true : null,
    }],
  });

  const updatedParent = updateParentWithRecoveredTailFrame({
    parentTaskId,
    assemblyPlan,
    productionProject,
    segmentIndex,
    videoUrl,
    providerTaskId,
    lastFrameUrl: tailFrame.lastFrameUrl,
  });
  const nextSegment = (updatedParent?.result?.assemblyPlan as ProductionAssemblyPlan | undefined)
    ?.segments.find(item => item.index === segmentIndex + 1);

  return {
    success: true,
    usedRealKey: false,
    incurredCost: false,
    parentTaskId,
    childTaskId: input.childTaskId,
    segmentIndex,
    lastFrameSource: tailFrame.source,
    uploadSource: extraction.diagnostics.uploadSource,
    nextSegmentFirstFrameUrl: nextSegment?.expectedInputs.firstFrameUrl || null,
  };
}
