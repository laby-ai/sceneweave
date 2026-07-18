import type { BYOKConnection, BYOKVideoStatus } from '@/lib/byok-provider';
import { getVideoStatusWithBYOK } from '@/lib/byok-provider';
import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import { applySegmentAssetWriteback } from '@/lib/production-segment-assets';
import { evaluateSegmentTailFrameForHandoff } from '@/lib/production-segment-tail-frame';
import {
  completeTask,
  getTaskFresh,
  updateTask,
} from '@/lib/task-manager';
import { describeStorySegmentCue } from '@/lib/production-story-segment-contract';
import { extractLastFrameForHandoff } from '@/lib/video-frame-extraction';

function segmentAudioCue(segment: ProductionAssemblyPlan['segments'][number] | undefined) {
  return segment?.audioState?.audioCue || segment?.shotFrameContract?.audioDescription || null;
}

function segmentStoryStateCue(segment: ProductionAssemblyPlan['segments'][number] | undefined) {
  return segment?.expectedOutputs?.storyStateCue
    || (segment?.storySegmentContract ? describeStorySegmentCue(segment.storySegmentContract) : null);
}

export interface RecoverProductionSegmentProviderTaskInput {
  childTaskId: string;
}

export interface RecoverProductionSegmentProviderTaskResult {
  success: true;
  usedRealKey: true;
  incurredCost: false;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
  providerTaskIdPresent: true;
  providerStatus: 'succeeded';
  videoUrlPresent: true;
  lastFrameUrlPresent: boolean;
  lastFrameSource: 'provider' | 'extracted' | null;
  nextSegmentFirstFrameUrl?: string | null;
}

export interface PendingProductionSegmentProviderTaskResult {
  success: false;
  usedRealKey: true;
  incurredCost: false;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
  providerTaskIdPresent: true;
  providerStatus: 'queued' | 'running' | 'unknown';
  nextAction: string;
}

export type ProductionSegmentProviderRecoveryResult =
  | RecoverProductionSegmentProviderTaskResult
  | PendingProductionSegmentProviderTaskResult;

export class ProductionSegmentProviderRecoveryError extends Error {
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProductionSegmentProviderRecoveryError';
    this.status = status;
    this.details = details;
  }
}

type VideoStatusFetcher = (connection: BYOKConnection, taskId: string) => Promise<BYOKVideoStatus>;

function getProviderTaskId(childTask: ReturnType<typeof getTaskFresh>, segment?: ProductionAssemblyPlan['segments'][number]) {
  const resultProviderTaskId = typeof childTask?.result?.providerTaskId === 'string'
    ? childTask.result.providerTaskId
    : undefined;
  const nestedProviderTaskId = Array.isArray(childTask?.result?.segments)
    && typeof childTask.result.segments[0]?.providerTaskId === 'string'
    ? childTask.result.segments[0].providerTaskId
    : undefined;
  const segmentProviderTaskId = typeof segment?.expectedOutputs?.providerTaskId === 'string'
    ? segment.expectedOutputs.providerTaskId
    : undefined;

  return resultProviderTaskId || nestedProviderTaskId || segmentProviderTaskId || '';
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

function updateParentWithProviderResult(params: {
  parentTaskId: string;
  assemblyPlan: ProductionAssemblyPlan;
  productionProject?: ProductionProject;
  segmentIndex: number;
  childTaskId: string;
  providerTaskId: string;
  videoUrl: string;
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
        taskId: params.childTaskId,
        providerTaskId: params.providerTaskId,
        videoUrl: params.videoUrl,
        lastFrameUrl: params.lastFrameUrl,
        audioCue: segmentAudioCue(params.assemblyPlan.segments[params.segmentIndex]),
        storyStateCue: segmentStoryStateCue(params.assemblyPlan.segments[params.segmentIndex]),
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
    message: `第 ${params.segmentIndex + 1} 个片段已从 providerTaskId 续查恢复并写回。`,
  });
}

export async function recoverProductionSegmentProviderTask(
  input: RecoverProductionSegmentProviderTaskInput,
  byokConnection: BYOKConnection,
  options: { getVideoStatus?: VideoStatusFetcher } = {}
): Promise<ProductionSegmentProviderRecoveryResult> {
  const {
    childTask,
    parentTaskId,
    assemblyPlan,
    productionProject,
    segmentIndex,
    segment,
  } = getParentSegment(input.childTaskId);

  if (!childTask || childTask.config?.workflow !== 'production-assembly-segment') {
    throw new ProductionSegmentProviderRecoveryError('目标任务不是绘影片段视频子任务。', 404);
  }
  if (!parentTaskId || !assemblyPlan || !segment || !Number.isFinite(segmentIndex)) {
    throw new ProductionSegmentProviderRecoveryError('父任务或 assemblyPlan 不完整，无法续查供应商任务。', 404);
  }

  const providerTaskId = getProviderTaskId(childTask, segment);
  if (!providerTaskId) {
    throw new ProductionSegmentProviderRecoveryError('该失败片段没有 providerTaskId，必须重新生成片段。', 409);
  }

  const getVideoStatus = options.getVideoStatus || getVideoStatusWithBYOK;
  const providerStatus = await getVideoStatus(byokConnection, providerTaskId);
  if (providerStatus.status === 'queued' || providerStatus.status === 'running' || providerStatus.status === 'unknown') {
    updateTask(input.childTaskId, {
      stage: '供应商任务仍在处理中',
      message: '已续查 providerTaskId；供应商尚未返回视频，稍后可再次恢复，不会重复提交生成。',
      result: {
        ...(childTask.result || {}),
        providerTaskId,
      },
    });

    return {
      success: false,
      usedRealKey: true,
      incurredCost: false,
      parentTaskId,
      childTaskId: input.childTaskId,
      segmentIndex,
      providerTaskIdPresent: true,
      providerStatus: providerStatus.status,
      nextAction: '稍后再次调用 provider 恢复；不要 forceResubmit，避免重复扣费。',
    };
  }

  if (providerStatus.status === 'failed') {
    throw new ProductionSegmentProviderRecoveryError(
      providerStatus.error || '供应商确认该视频任务失败；如需重试必须显式重新生成该片段。',
      409,
      { providerStatus: 'failed', providerTaskIdPresent: true }
    );
  }

  if (!providerStatus.videoUrl) {
    throw new ProductionSegmentProviderRecoveryError('供应商任务已成功但缺少 videoUrl，无法写回片段。', 409);
  }

  const extraction = providerStatus.lastFrameUrl
    ? undefined
    : await extractLastFrameForHandoff(providerStatus.videoUrl);
  const tailFrame = evaluateSegmentTailFrameForHandoff({
    segmentIndex,
    segmentCount: assemblyPlan.segmentCount,
    providerLastFrameUrl: providerStatus.lastFrameUrl,
    extractedLastFrameUrl: extraction?.lastFrameUrl,
  });
  if (!tailFrame.ok) {
    updateTask(input.childTaskId, {
      result: {
        ...(childTask.result || {}),
        providerTaskId,
        videoUrl: providerStatus.videoUrl,
        ...(extraction ? { lastFrameExtraction: extraction.diagnostics } : {}),
      },
    });
    throw new ProductionSegmentProviderRecoveryError(
      `${tailFrame.reason} ${tailFrame.nextAction} [segment-provider-recovery-tail-missing]`,
      409,
      { extraction: extraction?.diagnostics }
    );
  }

  updateTask(input.childTaskId, {
    status: 'running',
    stage: '供应商任务已完成，正在恢复写回',
    error: undefined,
    completedAt: undefined,
  });
  completeTask(input.childTaskId, {
    ...(childTask.result || {}),
    videoUrl: providerStatus.videoUrl,
    providerTaskId,
    lastFrameUrl: tailFrame.lastFrameUrl || undefined,
    audioCue: segmentAudioCue(segment),
    storyStateCue: segmentStoryStateCue(segment),
    hasAudio: childTask.result?.hasAudio === true ? true : null,
    handoff: {
      requiresTailFrame: tailFrame.requiresTailFrame,
      lastFrameUrlPresent: Boolean(tailFrame.lastFrameUrl),
      lastFrameSource: tailFrame.source,
      punchThroughReady: true,
    },
    ...(extraction ? { lastFrameExtraction: extraction.diagnostics } : {}),
    segments: [{
      index: segmentIndex,
      taskId: input.childTaskId,
      providerTaskId,
      status: 'completed',
      videoUrl: providerStatus.videoUrl,
      lastFrameUrl: tailFrame.lastFrameUrl || undefined,
      lastFrameSource: tailFrame.source,
      audioCue: segmentAudioCue(segment),
      storyStateCue: segmentStoryStateCue(segment),
      hasAudio: childTask.result?.hasAudio === true ? true : null,
    }],
  });

  const updatedParent = updateParentWithProviderResult({
    parentTaskId,
    assemblyPlan,
    productionProject,
    segmentIndex,
    childTaskId: input.childTaskId,
    providerTaskId,
    videoUrl: providerStatus.videoUrl,
    lastFrameUrl: tailFrame.lastFrameUrl,
  });
  const nextSegment = (updatedParent?.result?.assemblyPlan as ProductionAssemblyPlan | undefined)
    ?.segments.find(item => item.index === segmentIndex + 1);

  return {
    success: true,
    usedRealKey: true,
    incurredCost: false,
    parentTaskId,
    childTaskId: input.childTaskId,
    segmentIndex,
    providerTaskIdPresent: true,
    providerStatus: 'succeeded',
    videoUrlPresent: true,
    lastFrameUrlPresent: Boolean(tailFrame.lastFrameUrl),
    lastFrameSource: tailFrame.source,
    nextSegmentFirstFrameUrl: nextSegment?.expectedInputs.firstFrameUrl || null,
  };
}
