import type { BYOKConnection } from '@/lib/byok-provider';
import { submitVideoWithBYOK, waitForVideoWithBYOK } from '@/lib/byok-provider';
import type { ProductionAssemblyPlan, ProductionSegmentPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import { applySegmentAssetWriteback } from '@/lib/production-segment-assets';
import { describeStorySegmentCue } from '@/lib/production-story-segment-contract';
import {
  buildProductionSegmentStartPayload,
  ProductionSegmentStartPayloadError,
  type ProductionSegmentStartPayload,
} from '@/lib/production-segment-start-payload';
import { evaluateSegmentTailFrameForHandoff } from '@/lib/production-segment-tail-frame';
import { evaluateProductionSegmentTransition } from '@/lib/production-segment-transition';
import {
  completeTask,
  failTask,
  getTaskFresh,
  startTask,
  updateTask,
  updateTaskProgress,
} from '@/lib/task-manager';
import {
  extractLastFrameForHandoff,
  type LastFrameExtractionResult,
} from '@/lib/video-frame-extraction';

function segmentAudioCue(segment: ProductionSegmentPlan) {
  return segment.audioState?.audioCue || segment.shotFrameContract?.audioDescription || null;
}

function segmentStoryStateCue(segment: ProductionSegmentPlan) {
  return segment.expectedOutputs.storyStateCue || describeStorySegmentCue(segment.storySegmentContract);
}

export interface StartProductionSegmentInput {
  childTaskId?: string;
  parentTaskId?: string;
  segmentIndex?: number;
  dryRun?: boolean;
  allowRealCost?: boolean;
  generateAudio?: boolean;
}

export interface StartProductionSegmentResult {
  success: true;
  dryRun: boolean;
  usedRealKey: boolean;
  incurredCost: boolean;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
  duration: number;
  firstFrameImagePresent: boolean;
  previousLastFrameImagePresent: boolean;
  startPayload: Omit<ProductionSegmentStartPayload, 'prompt'>;
  nextAction?: string;
  message?: string;
}

export class ProductionSegmentStartError extends Error {
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProductionSegmentStartError';
    this.status = status;
    this.details = details;
  }
}

export function redactProductionSegmentStartError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/ark-[0-9a-fA-F-]{20,}/g, 'ark-[REDACTED]');
}

function getSegmentLocator(input: StartProductionSegmentInput) {
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

function updateParentSegment(
  parentTaskId: string,
  segmentIndex: number,
  patch: Omit<Partial<ProductionSegmentPlan>, 'expectedOutputs' | 'status'> & {
    status: ProductionSegmentPlan['status'];
    expectedOutputs?: Partial<ProductionSegmentPlan['expectedOutputs']>;
  }
) {
  const parentTask = getTaskFresh(parentTaskId);
  const assemblyPlan = parentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  const productionProject = parentTask?.result?.productionProject as ProductionProject | undefined;
  if (!parentTask?.result || !assemblyPlan) return null;

  const writeback = applySegmentAssetWriteback({
    productionProject,
    assemblyPlan,
    segmentIndex,
    patch,
  });

  const assemblyQueue = parentTask.result.assemblyQueue && typeof parentTask.result.assemblyQueue === 'object'
    ? {
      ...parentTask.result.assemblyQueue,
      status: writeback.assemblyPlan.status,
      updatedAt: new Date().toISOString(),
    }
    : parentTask.result.assemblyQueue;

  return updateTask(parentTaskId, {
    result: {
      ...parentTask.result,
      productionProject: writeback.productionProject || parentTask.result.productionProject,
      assemblyPlan: writeback.assemblyPlan,
      assemblyQueue,
    },
    message: writeback.assemblyPlan.status === 'failed'
      ? `第 ${segmentIndex + 1} 个片段失败，可在任务中心重试该片段。`
      : `第 ${segmentIndex + 1} 个片段状态已更新：${patch.status || 'queued'}`,
  });
}

async function runSegmentProviderJob(params: {
  byokConnection: BYOKConnection;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
  segmentCount: number;
  segment: ProductionSegmentPlan;
  ratio: string;
  videoModel?: string;
  generateAudio?: boolean;
}) {
  const {
    byokConnection,
    parentTaskId,
    childTaskId,
    segmentIndex,
    segmentCount,
    segment,
    ratio,
    videoModel,
    generateAudio,
  } = params;
  const startPayload = buildProductionSegmentStartPayload(segment);
  let providerTaskId: string | undefined;
  let partialVideoUrl: string | undefined;
  let partialLastFrameUrl: string | undefined;
  let lastFrameExtraction: LastFrameExtractionResult | undefined;

  try {
    const submitResult = await submitVideoWithBYOK(byokConnection, {
      prompt: startPayload.providerPrompt,
      duration: Math.min(Math.max(segment.duration, 5), 10),
      ratio,
      model: videoModel,
      firstFrameImage: startPayload.firstFrameImage || undefined,
      generateAudio,
    });
    providerTaskId = submitResult.taskId;
    updateTaskProgress(childTaskId, 18, '片段已提交到 Ark，等待生成...', `供应商任务 ${submitResult.taskId}`);
    updateParentSegment(parentTaskId, segmentIndex, {
      status: 'running',
      expectedOutputs: {
        taskId: childTaskId,
        providerTaskId: submitResult.taskId,
      },
    });

    const videoResult = await waitForVideoWithBYOK(
      byokConnection,
      submitResult.taskId,
      (status, attempt) => {
        updateTaskProgress(
          childTaskId,
          Math.min(88, 20 + attempt),
          `Ark 片段生成中：${status.rawStatus || status.status}`,
          '长任务可留在后台，失败后只需重试该片段。'
        );
      },
      { maxAttempts: 180, intervalMs: 3000 }
    );
    partialVideoUrl = videoResult.videoUrl;

    lastFrameExtraction = videoResult.lastFrameUrl
      ? undefined
      : await extractLastFrameForHandoff(videoResult.videoUrl);
    const extractedLastFrameUrl = lastFrameExtraction?.lastFrameUrl;
    const tailFrame = evaluateSegmentTailFrameForHandoff({
      segmentIndex,
      segmentCount,
      providerLastFrameUrl: videoResult.lastFrameUrl,
      extractedLastFrameUrl,
    });
    if (!tailFrame.ok) {
      throw new Error(`${tailFrame.reason} ${tailFrame.nextAction} [segment-tail-frame-missing]`);
    }
    const lastFrameUrl = tailFrame.lastFrameUrl || undefined;
    partialLastFrameUrl = lastFrameUrl;

    completeTask(childTaskId, {
      videoUrl: videoResult.videoUrl,
      providerTaskId: submitResult.taskId,
      lastFrameUrl,
      audioCue: segmentAudioCue(segment),
      storyStateCue: segmentStoryStateCue(segment),
      hasAudio: Boolean(generateAudio),
      handoff: {
        requiresTailFrame: tailFrame.requiresTailFrame,
        lastFrameUrlPresent: Boolean(lastFrameUrl),
        lastFrameSource: tailFrame.source,
        punchThroughReady: tailFrame.ok && (!tailFrame.requiresTailFrame || Boolean(lastFrameUrl)),
      },
      ...(lastFrameExtraction ? { lastFrameExtraction: lastFrameExtraction.diagnostics } : {}),
      segments: [{
        index: segmentIndex,
        taskId: childTaskId,
        providerTaskId: submitResult.taskId,
        status: 'completed',
        videoUrl: videoResult.videoUrl,
        lastFrameUrl,
        lastFrameSource: tailFrame.source,
        audioCue: segmentAudioCue(segment),
        storyStateCue: segmentStoryStateCue(segment),
        hasAudio: Boolean(generateAudio),
      }],
    });
    updateParentSegment(parentTaskId, segmentIndex, {
      status: 'completed',
      error: null,
      completedAt: new Date().toISOString(),
      expectedOutputs: {
        taskId: childTaskId,
        providerTaskId: submitResult.taskId,
        videoUrl: videoResult.videoUrl,
        lastFrameUrl: lastFrameUrl || null,
        audioCue: segmentAudioCue(segment),
        storyStateCue: segmentStoryStateCue(segment),
        hasAudio: Boolean(generateAudio),
      },
    });
  } catch (error) {
    const message = redactProductionSegmentStartError(error);
    if (providerTaskId || partialVideoUrl || partialLastFrameUrl) {
      const currentTask = getTaskFresh(childTaskId);
      updateTask(childTaskId, {
        result: {
          ...(currentTask?.result || {}),
          ...(partialVideoUrl ? { videoUrl: partialVideoUrl } : {}),
          ...(providerTaskId ? { providerTaskId } : {}),
          ...(partialLastFrameUrl ? { lastFrameUrl: partialLastFrameUrl } : {}),
          handoff: {
            requiresTailFrame: segmentIndex < segmentCount - 1,
            lastFrameUrlPresent: Boolean(partialLastFrameUrl),
            lastFrameSource: null,
            punchThroughReady: false,
          },
          ...(lastFrameExtraction ? { lastFrameExtraction: lastFrameExtraction.diagnostics } : {}),
          segments: [{
            index: segmentIndex,
            taskId: childTaskId,
            ...(providerTaskId ? { providerTaskId } : {}),
            status: 'failed',
            ...(partialVideoUrl ? { videoUrl: partialVideoUrl } : {}),
            ...(partialLastFrameUrl ? { lastFrameUrl: partialLastFrameUrl } : {}),
            audioCue: segmentAudioCue(segment),
            hasAudio: providerTaskId ? Boolean(generateAudio) : null,
            error: message,
          }],
        },
      });
    }
    failTask(childTaskId, message);
    updateParentSegment(parentTaskId, segmentIndex, {
      status: 'failed',
      error: message,
      completedAt: new Date().toISOString(),
      expectedOutputs: {
        taskId: childTaskId,
        providerTaskId: providerTaskId || null,
        videoUrl: partialVideoUrl || null,
        lastFrameUrl: partialLastFrameUrl || null,
        audioCue: segmentAudioCue(segment),
        hasAudio: providerTaskId ? Boolean(generateAudio) : null,
      },
    });
  }
}

export function startProductionAssemblySegment(
  input: StartProductionSegmentInput,
  byokConnection?: BYOKConnection
): StartProductionSegmentResult {
  const { childTask, parentTaskId, segmentIndex } = getSegmentLocator(input);

  if (!parentTaskId || !Number.isFinite(segmentIndex)) {
    throw new ProductionSegmentStartError(
      '请提供 childTaskId，或同时提供 parentTaskId 与 segmentIndex。',
      400
    );
  }

  const parentTask = getTaskFresh(parentTaskId);
  const assemblyPlan = parentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  const segment = assemblyPlan?.segments.find(item => item.index === segmentIndex);
  const resolvedChildTask = childTask || (segment?.expectedOutputs.taskId
    ? getTaskFresh(segment.expectedOutputs.taskId)
    : undefined);

  if (!parentTask?.result || !assemblyPlan || !segment || !resolvedChildTask) {
    throw new ProductionSegmentStartError(
      '父任务、片段计划或片段子任务不存在，请先运行 assembly-plan/queue。',
      404
    );
  }

  if (resolvedChildTask.config?.workflow !== 'production-assembly-segment') {
    throw new ProductionSegmentStartError('目标任务不是绘影片段视频子任务，拒绝启动。', 400);
  }

  const transitionReadiness = evaluateProductionSegmentTransition(assemblyPlan, segmentIndex);
  if (!transitionReadiness.ok) {
    throw new ProductionSegmentStartError(
      transitionReadiness.reason || '片段依赖未就绪，拒绝启动真实视频生成。',
      409,
      {
        code: 'segment-handoff-not-ready',
        transitionReadiness,
        nextAction: segmentIndex > 0
          ? '先完成上一段并写回 lastFrameUrl，再启动本段，禁止只靠文本 prompt 衔接。'
          : '请检查片段队列和 assemblyPlan。',
      }
    );
  }

  let startPayload: ProductionSegmentStartPayload;
  try {
    startPayload = buildProductionSegmentStartPayload(segment);
  } catch (error) {
    if (error instanceof ProductionSegmentStartPayloadError) {
      throw new ProductionSegmentStartError(error.message, 409, error.details);
    }
    throw error;
  }
  const startPayloadSummary: Omit<ProductionSegmentStartPayload, 'prompt'> = {
    version: startPayload.version,
    usesShotFrameContract: startPayload.usesShotFrameContract,
    contractVersion: startPayload.contractVersion,
    variationType: startPayload.variationType,
    firstFrameImage: startPayload.firstFrameImage,
    previousLastFrameImage: startPayload.previousLastFrameImage,
    promptPreview: startPayload.promptPreview,
    providerPrompt: startPayload.providerPrompt,
    providerPromptPreview: startPayload.providerPromptPreview,
    providerPromptLength: startPayload.providerPromptLength,
    visualStoryEvidence: startPayload.visualStoryEvidence,
    storySegmentContract: startPayload.storySegmentContract,
    audioState: startPayload.audioState,
    audioEventContract: startPayload.audioEventContract,
    audioContinuity: startPayload.audioContinuity,
    storyContinuity: startPayload.storyContinuity,
    boundaryBridge: startPayload.boundaryBridge,
    readiness: startPayload.readiness,
  };

  if (input.dryRun !== false) {
    updateTask(resolvedChildTask.id, {
      progress: 5,
      stage: '片段启动前检查通过',
      message: 'Dry-run 未调用供应商：片段 prompt、duration、父任务、队列关系和首尾帧合约 payload 均可追踪。',
      config: {
        ...resolvedChildTask.config,
        segmentStartPayload: startPayloadSummary,
        generateAudio: input.generateAudio === true,
      },
    });
    updateParentSegment(parentTaskId, segmentIndex, {
      status: 'queued',
      error: null,
      expectedOutputs: { taskId: resolvedChildTask.id },
    });

    return {
      success: true,
      dryRun: true,
      usedRealKey: false,
      incurredCost: false,
      parentTaskId,
      childTaskId: resolvedChildTask.id,
      segmentIndex,
      duration: segment.duration,
      firstFrameImagePresent: Boolean(startPayload.firstFrameImage),
      previousLastFrameImagePresent: Boolean(startPayload.previousLastFrameImage),
      startPayload: startPayloadSummary,
      nextAction: '若要真实生成该片段，请带 BYOK headers 并设置 allowRealCost=true、dryRun=false。',
    };
  }

  if (input.allowRealCost !== true) {
    throw new ProductionSegmentStartError(
      '真实片段生成可能产生费用，必须显式设置 allowRealCost=true。',
      400
    );
  }

  if (!byokConnection) {
    throw new ProductionSegmentStartError(
      '真实片段生成需要在设置页或请求头提供 Ark Plan API Base、API Key 和视频模型。',
      400
    );
  }

  startTask(resolvedChildTask.id);
  updateTaskProgress(resolvedChildTask.id, 10, '正在提交片段视频任务（Ark BYOK）...', '片段任务将独立写回父级 assemblyPlan。');
  updateTask(resolvedChildTask.id, {
      config: {
        ...resolvedChildTask.config,
        segmentStartPayload: startPayloadSummary,
        generateAudio: input.generateAudio === true,
      },
    });
  updateParentSegment(parentTaskId, segmentIndex, {
    status: 'running',
    error: null,
    startedAt: new Date().toISOString(),
    expectedOutputs: { taskId: resolvedChildTask.id },
  });

  void runSegmentProviderJob({
    byokConnection,
    parentTaskId,
    childTaskId: resolvedChildTask.id,
    segmentIndex,
    segmentCount: assemblyPlan.segmentCount,
    segment,
    ratio: typeof resolvedChildTask.config.ratio === 'string' ? resolvedChildTask.config.ratio : '16:9',
    videoModel: typeof resolvedChildTask.config.videoModel === 'string' ? resolvedChildTask.config.videoModel : undefined,
    generateAudio: input.generateAudio === true,
  });

  return {
    success: true,
    dryRun: false,
    usedRealKey: true,
    incurredCost: true,
    parentTaskId,
    childTaskId: resolvedChildTask.id,
    segmentIndex,
    duration: Math.min(Math.max(segment.duration, 5), 10),
    firstFrameImagePresent: Boolean(startPayload.firstFrameImage),
    previousLastFrameImagePresent: Boolean(startPayload.previousLastFrameImage),
    startPayload: startPayloadSummary,
    message: '片段真实生成已启动，可在任务中心轮询该子任务和父级 assemblyPlan。',
  };
}
