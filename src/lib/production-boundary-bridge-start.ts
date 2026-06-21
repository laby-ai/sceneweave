import type { BYOKConnection } from '@/lib/byok-provider';
import { submitVideoWithBYOK, waitForVideoWithBYOK } from '@/lib/byok-provider';
import {
  completeTask,
  createTask,
  failTask,
  getTaskFresh,
  startTask,
  updateTask,
  updateTaskProgress,
} from '@/lib/task-manager';
import { extractLastFrameForHandoff, type LastFrameExtractionResult } from '@/lib/video-frame-extraction';
import type { ProductionAssemblyPlan, ProductionSegmentPlan } from './production-assembly-plan';
import { patchStorySegmentContractInputs } from './production-story-segment-contract';
import type { BoundaryBridge } from './trailer-beat-sheet';

export interface ProductionBoundaryBridgeStartPayload {
  version: 'yh-boundary-bridge-start-payload-v1';
  boundaryBridgeId: string;
  boundaryIndex: number;
  previousSegmentId: string;
  nextSegmentId: string;
  sourceLastFrameImage: string;
  targetFirstFrameImage: string | null;
  bridgeDurationSeconds: number;
  bridgePrompt: string;
  providerPrompt: string;
  providerPromptPreview: string;
  providerPromptLength: number;
  audioBridgeCue: string;
  previousAudioCue: string | null;
  previousStoryStateCue: string | null;
  nextOpeningContract: string;
  writebackTarget: {
    nextSegmentIndex: number;
    bridgeStrategy: 'transition-bridge';
    firstFrameSource: 'new-camera-image';
  };
  readiness: {
    pass: boolean;
    blockers: string[];
    warnings: string[];
  };
}

export interface BoundaryBridgeArtifactPatch {
  bridgeVideoUrl: string;
  bridgeLastFrameUrl?: string | null;
  newCameraImageUrl: string;
  providerTaskId?: string | null;
}

export interface BoundaryBridgeWritebackResult {
  assemblyPlan: ProductionAssemblyPlan;
  boundary: BoundaryBridge;
  nextSegment: ProductionSegmentPlan;
}

export interface StartProductionBoundaryBridgeInput {
  parentTaskId?: string;
  boundaryIndex?: number;
  dryRun?: boolean;
  allowRealCost?: boolean;
  generateAudio?: boolean;
}

export interface StartProductionBoundaryBridgeResult {
  success: true;
  dryRun: boolean;
  usedRealKey: boolean;
  incurredCost: boolean;
  parentTaskId: string;
  childTaskId?: string;
  boundaryIndex: number;
  bridgeDuration: number;
  startPayload: ProductionBoundaryBridgeStartPayload;
  nextAction?: string;
  message?: string;
}

export class ProductionBoundaryBridgeStartError extends Error {
  details: Record<string, unknown>;
  status: number;

  constructor(message: string, details: Record<string, unknown> = {}, status = 409) {
    super(message);
    this.name = 'ProductionBoundaryBridgeStartError';
    this.details = details;
    this.status = status;
  }
}

export function redactProductionBoundaryBridgeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  return message
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]');
}

function findBoundary(assemblyPlan: ProductionAssemblyPlan, boundaryIndex: number) {
  return assemblyPlan.boundaryBridgePlan?.boundaries.find(boundary => boundary.index === boundaryIndex) || null;
}

function normalizeProviderText(value: string | null | undefined) {
  return String(value || '')
    .replace(/【[^】]{1,48}】/g, ' ')
    .replace(/[<>`{}[\]|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactProviderPrompt(lines: string[]) {
  const prompt = lines
    .map(line => normalizeProviderText(line))
    .filter(Boolean)
    .join('。')
    .replace(/。+/g, '。')
    .trim();
  if (prompt.length <= 950) return prompt;
  return `${prompt.slice(0, 650).trim()}。${prompt.slice(-240).trim()}`.slice(0, 950);
}

function previousAudioCue(segment: ProductionSegmentPlan) {
  return segment.expectedOutputs.audioCue || segment.audioState?.audioCue || null;
}

function previousStoryCue(segment: ProductionSegmentPlan) {
  return segment.expectedOutputs.storyStateCue || null;
}

function updateParentAssemblyPlan(parentTaskId: string, assemblyPlan: ProductionAssemblyPlan, message: string) {
  const parentTask = getTaskFresh(parentTaskId);
  if (!parentTask?.result) return null;

  return updateTask(parentTaskId, {
    result: {
      ...parentTask.result,
      assemblyPlan,
    },
    message,
  });
}

function markBoundaryBridgeStale(params: {
  assemblyPlan: ProductionAssemblyPlan;
  boundaryIndex: number;
  reason: string;
}) {
  return {
    ...params.assemblyPlan,
    boundaryBridgePlan: params.assemblyPlan.boundaryBridgePlan
      ? {
          ...params.assemblyPlan.boundaryBridgePlan,
          boundaries: params.assemblyPlan.boundaryBridgePlan.boundaries.map(boundary =>
            boundary.index === params.boundaryIndex
              ? {
                  ...boundary,
                  status: 'stale' as const,
                  readiness: {
                    pass: false,
                    blockers: ['boundary-bridge-provider-failed'],
                    warnings: [params.reason],
                  },
                }
              : boundary
          ),
        }
      : params.assemblyPlan.boundaryBridgePlan,
    nextAction: `边界 ${params.boundaryIndex + 1}->${params.boundaryIndex + 2} bridge 生成失败，保留已完成片段，需重试该 boundary。`,
  };
}

function evaluateBoundaryBridgeStart(assemblyPlan: ProductionAssemblyPlan, boundaryIndex: number) {
  const boundary = findBoundary(assemblyPlan, boundaryIndex);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!boundary) {
    return {
      boundary: null,
      previousSegment: null,
      nextSegment: null,
      sourceLastFrameImage: null,
      targetFirstFrameImage: null,
      readiness: {
        pass: false,
        blockers: [`boundary-${boundaryIndex}-missing`],
        warnings,
      },
    };
  }

  const previousSegment = assemblyPlan.segments.find(segment => segment.id === boundary.previousSegmentId) || null;
  const nextSegment = assemblyPlan.segments.find(segment => segment.id === boundary.nextSegmentId) || null;
  const sourceLastFrameImage = boundary.sourceLastFrameUrl || previousSegment?.expectedOutputs.lastFrameUrl || null;
  const targetFirstFrameImage = boundary.targetFirstFrameUrl
    || nextSegment?.expectedInputs.bridgeFirstFrameUrl
    || nextSegment?.expectedInputs.firstFrameUrl
    || null;

  if (!previousSegment) blockers.push('previous-segment-missing');
  if (!nextSegment) blockers.push('next-segment-missing');
  if (previousSegment && previousSegment.status !== 'completed') blockers.push('previous-segment-not-completed');
  if (!sourceLastFrameImage) blockers.push('previous-last-frame-missing');
  if (boundary.status === 'stale') blockers.push('boundary-bridge-stale');
  if (boundary.status === 'blocked' && sourceLastFrameImage) warnings.push('boundary-status-blocked-but-source-tail-present');
  if (!targetFirstFrameImage) warnings.push('target-first-frame-will-be-derived-from-bridge-output');
  if (boundary.bridgeVideoUrl && boundary.newCameraImageUrl) warnings.push('boundary-bridge-already-generated');

  return {
    boundary,
    previousSegment,
    nextSegment,
    sourceLastFrameImage,
    targetFirstFrameImage,
    readiness: {
      pass: blockers.length === 0,
      blockers,
      warnings,
    },
  };
}

export function buildProductionBoundaryBridgeStartPayload(
  assemblyPlan: ProductionAssemblyPlan,
  boundaryIndex: number
): ProductionBoundaryBridgeStartPayload {
  const evaluation = evaluateBoundaryBridgeStart(assemblyPlan, boundaryIndex);
  const { boundary, previousSegment, nextSegment, sourceLastFrameImage, targetFirstFrameImage, readiness } = evaluation;

  if (!boundary || !previousSegment || !nextSegment || !sourceLastFrameImage || !readiness.pass) {
    throw new ProductionBoundaryBridgeStartError('边界桥接 artifact 未就绪，拒绝启动 bridge 生成。', {
      code: 'boundary-bridge-start-not-ready',
      boundaryIndex,
      readiness,
    });
  }

  const previousAudio = previousAudioCue(previousSegment);
  const previousStory = previousStoryCue(previousSegment);
  const bridgePrompt = [
    boundary.bridgePrompt,
    `承接上镜：从上一段最后一帧开始，保持人物站位、服装、关键道具、场景方向和情绪，不重新开场。`,
    `下一段入口：${boundary.targetOpeningContract}`,
    `声音桥接：${boundary.audioBridgeCue}`,
  ].join('\n');
  const providerPrompt = compactProviderPrompt([
    '两段短剧之间的 2 秒 transition bridge video，风格、服装、场景、角色脸型和道具状态必须一致',
    `承接上镜：上一段最后一帧已经作为参考图输入；开头必须复现该图像的人物站位、朝向、道具位置和情绪余韵`,
    `上一段故事状态：${previousStory || '保持上一段结尾的角色目标、冲突和道具状态'}`,
    `上一段声音状态：${previousAudio || '保持上一段环境声尾音和角色呼吸，不新增解释性旁白'}`,
    `桥接动作：${boundary.bridgePrompt}`,
    `下一段开场合约：${boundary.targetOpeningContract}`,
    '输出要求：最后 0.5 秒形成可截图的 new-camera image，作为下一段首帧；不要硬切到新人物、新服装、新空间或新景别',
    '声音要求：保留环境声、脚步、衣料、器物或风声的连续感；如果有对白，只承接角色口型和情绪，不生成背景解说',
  ]);

  return {
    version: 'yh-boundary-bridge-start-payload-v1',
    boundaryBridgeId: boundary.id,
    boundaryIndex: boundary.index,
    previousSegmentId: boundary.previousSegmentId,
    nextSegmentId: boundary.nextSegmentId,
    sourceLastFrameImage,
    targetFirstFrameImage,
    bridgeDurationSeconds: boundary.bridgeDurationSeconds,
    bridgePrompt,
    providerPrompt,
    providerPromptPreview: providerPrompt.slice(0, 520),
    providerPromptLength: providerPrompt.length,
    audioBridgeCue: boundary.audioBridgeCue,
    previousAudioCue: previousAudio,
    previousStoryStateCue: previousStory,
    nextOpeningContract: boundary.targetOpeningContract,
    writebackTarget: {
      nextSegmentIndex: nextSegment.index,
      bridgeStrategy: 'transition-bridge',
      firstFrameSource: 'new-camera-image',
    },
    readiness,
  };
}

export function applyBoundaryBridgeArtifactWriteback(params: {
  assemblyPlan: ProductionAssemblyPlan;
  boundaryIndex: number;
  patch: BoundaryBridgeArtifactPatch;
}): BoundaryBridgeWritebackResult {
  const evaluation = evaluateBoundaryBridgeStart(params.assemblyPlan, params.boundaryIndex);
  const { boundary, previousSegment, nextSegment, sourceLastFrameImage } = evaluation;

  if (!boundary || !previousSegment || !nextSegment || !sourceLastFrameImage) {
    throw new ProductionBoundaryBridgeStartError('边界桥接 artifact 写回失败：缺少边界、上下游片段或上一段尾帧。', {
      code: 'boundary-bridge-writeback-not-ready',
      boundaryIndex: params.boundaryIndex,
      readiness: evaluation.readiness,
    });
  }

  const bridgeFirstFrameUrl = params.patch.newCameraImageUrl;
  const sourceAssetId = `boundary-bridge-${boundary.index + 1}-${boundary.index + 2}`;
  const previousAudio = previousAudioCue(previousSegment);
  const previousStory = previousStoryCue(previousSegment);
  const updatedBoundary: BoundaryBridge = {
    ...boundary,
    sourceLastFrameUrl: sourceLastFrameImage,
    targetFirstFrameUrl: bridgeFirstFrameUrl,
    bridgeVideoUrl: params.patch.bridgeVideoUrl,
    bridgeLastFrameUrl: params.patch.bridgeLastFrameUrl || bridgeFirstFrameUrl,
    newCameraImageUrl: bridgeFirstFrameUrl,
    status: 'generated',
    readiness: {
      pass: true,
      blockers: [],
      warnings: ['next-segment-uses-new-camera-image-from-boundary-bridge'],
    },
  };
  const updatedNextSegment: ProductionSegmentPlan = {
    ...nextSegment,
    expectedInputs: {
      ...nextSegment.expectedInputs,
      firstFrameUrl: bridgeFirstFrameUrl,
      previousLastFrameUrl: sourceLastFrameImage,
      sourceSegmentId: previousSegment.id,
      sourceAssetId,
      continuityPrompt: [
        `使用边界桥接 ${boundary.index + 1}->${boundary.index + 2} 的 new-camera image 作为本段首帧。`,
        '开头必须接住桥接片段最后 0.5 秒的站位、镜头方向、道具状态和情绪，再推进本段新信息。',
      ].join(''),
      previousAudioCue: previousAudio,
      audioContinuityPrompt: previousAudio
        ? `承接边界桥接和上一段声音状态：${previousAudio}；不新增解释性背景解说。`
        : nextSegment.expectedInputs.audioContinuityPrompt,
      previousStoryStateCue: previousStory,
      storyContinuityPrompt: previousStory
        ? `承接边界桥接后的故事状态：${previousStory}；不得把下一段重新开场。`
        : nextSegment.expectedInputs.storyContinuityPrompt,
      boundaryBridgeId: boundary.id,
      boundaryBridgePrompt: [
        boundary.bridgePrompt,
        `已生成 bridgeVideoUrl，并抽取 newCameraImageUrl 作为下一段首帧。`,
      ].join('\n'),
      bridgeFirstFrameUrl,
      bridgeStrategy: 'transition-bridge',
    },
    storySegmentContract: nextSegment.storySegmentContract
      ? patchStorySegmentContractInputs({
          contract: nextSegment.storySegmentContract,
          firstFrameUrl: bridgeFirstFrameUrl,
          previousLastFrameUrl: sourceLastFrameImage,
          sourceSegmentId: previousSegment.id,
          sourceAssetId,
          previousAudioCue: previousAudio,
          previousStoryStateCue: previousStory,
        })
      : nextSegment.storySegmentContract,
  };
  const updatedSegments = params.assemblyPlan.segments.map(segment =>
    segment.id === nextSegment.id ? updatedNextSegment : segment
  );
  const assemblyPlan: ProductionAssemblyPlan = {
    ...params.assemblyPlan,
    boundaryBridgePlan: params.assemblyPlan.boundaryBridgePlan
      ? {
          ...params.assemblyPlan.boundaryBridgePlan,
          boundaries: params.assemblyPlan.boundaryBridgePlan.boundaries.map(item =>
            item.id === boundary.id ? updatedBoundary : item
          ),
        }
      : params.assemblyPlan.boundaryBridgePlan,
    segments: updatedSegments,
    assembly: {
      ...params.assemblyPlan.assembly,
      strategy: 'boundary-bridge-concat',
    },
    nextAction: `边界 ${boundary.index + 1}->${boundary.index + 2} 已生成 bridge artifact；下一段应使用 new-camera image 启动，而不是直接复用上一段尾帧硬接。`,
  };

  return {
    assemblyPlan,
    boundary: updatedBoundary,
    nextSegment: updatedNextSegment,
  };
}

async function runBoundaryBridgeProviderJob(params: {
  byokConnection: BYOKConnection;
  parentTaskId: string;
  childTaskId: string;
  boundaryIndex: number;
  assemblyPlan: ProductionAssemblyPlan;
  startPayload: ProductionBoundaryBridgeStartPayload;
  ratio: string;
  videoModel?: string;
  generateAudio?: boolean;
}) {
  const {
    byokConnection,
    parentTaskId,
    childTaskId,
    boundaryIndex,
    assemblyPlan,
    startPayload,
    ratio,
    videoModel,
    generateAudio,
  } = params;
  let providerTaskId: string | undefined;
  let bridgeVideoUrl: string | undefined;
  let newCameraImageUrl: string | undefined;
  let frameExtraction: LastFrameExtractionResult | undefined;

  try {
    const submitResult = await submitVideoWithBYOK(byokConnection, {
      prompt: startPayload.providerPrompt,
      duration: 5,
      ratio,
      model: videoModel,
      firstFrameImage: startPayload.sourceLastFrameImage,
      generateAudio,
      cameraFixed: false,
      watermark: false,
    });
    providerTaskId = submitResult.taskId;
    updateTaskProgress(childTaskId, 18, '边界 bridge 已提交到 Ark，等待生成...', `供应商任务 ${submitResult.taskId}`);

    const videoResult = await waitForVideoWithBYOK(
      byokConnection,
      submitResult.taskId,
      (status, attempt) => {
        updateTaskProgress(
          childTaskId,
          Math.min(88, 20 + attempt),
          `Ark 边界 bridge 生成中：${status.rawStatus || status.status}`,
          '该任务只负责上一段尾帧到下一段首帧的桥接，不直接产出整段。'
        );
      },
      { maxAttempts: 180, intervalMs: 3000 }
    );
    bridgeVideoUrl = videoResult.videoUrl;
    frameExtraction = videoResult.lastFrameUrl ? undefined : await extractLastFrameForHandoff(videoResult.videoUrl);
    newCameraImageUrl = videoResult.lastFrameUrl || frameExtraction?.lastFrameUrl;

    if (!newCameraImageUrl) {
      throw new Error('bridge 视频已生成，但未取得可写回的 new-camera image，停止下游片段启动。');
    }

    const latestParentTask = getTaskFresh(parentTaskId);
    const latestPlan = (latestParentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined) || assemblyPlan;
    const writeback = applyBoundaryBridgeArtifactWriteback({
      assemblyPlan: latestPlan,
      boundaryIndex,
      patch: {
        bridgeVideoUrl: videoResult.videoUrl,
        bridgeLastFrameUrl: newCameraImageUrl,
        newCameraImageUrl,
        providerTaskId: submitResult.taskId,
      },
    });
    updateParentAssemblyPlan(
      parentTaskId,
      writeback.assemblyPlan,
      `边界 ${boundaryIndex + 1}->${boundaryIndex + 2} bridge 已生成并写回 new-camera image。`
    );

    completeTask(childTaskId, {
      videoUrl: videoResult.videoUrl,
      providerTaskId: submitResult.taskId,
      lastFrameUrl: newCameraImageUrl,
      hasAudio: Boolean(generateAudio),
      handoff: {
        requiresTailFrame: true,
        lastFrameUrlPresent: true,
        lastFrameSource: videoResult.lastFrameUrl ? 'provider' : frameExtraction?.source === 'object-storage' || frameExtraction?.source === 'public-frame-handoff' || frameExtraction?.source === 'base64-data-url'
          ? 'extracted'
          : null,
        punchThroughReady: true,
      },
      boundaryBridge: {
        version: 'yh-boundary-bridge-runtime-v1',
        boundaryIndex,
        bridgeVideoUrl: videoResult.videoUrl,
        newCameraImageUrl,
        sourceLastFrameImage: startPayload.sourceLastFrameImage,
        nextSegmentId: startPayload.nextSegmentId,
      },
      ...(frameExtraction ? { lastFrameExtraction: frameExtraction.diagnostics } : {}),
    });
  } catch (error) {
    const message = redactProductionBoundaryBridgeError(error);
    const currentTask = getTaskFresh(childTaskId);
    updateTask(childTaskId, {
      result: {
        ...(currentTask?.result || {}),
        ...(bridgeVideoUrl ? { videoUrl: bridgeVideoUrl } : {}),
        ...(providerTaskId ? { providerTaskId } : {}),
        ...(newCameraImageUrl ? { lastFrameUrl: newCameraImageUrl } : {}),
        handoff: {
          requiresTailFrame: true,
          lastFrameUrlPresent: Boolean(newCameraImageUrl),
          lastFrameSource: null,
          punchThroughReady: false,
        },
        boundaryBridge: {
          version: 'yh-boundary-bridge-runtime-v1',
          boundaryIndex,
          status: 'failed',
          error: message,
        },
        ...(frameExtraction ? { lastFrameExtraction: frameExtraction.diagnostics } : {}),
      },
    });
    failTask(childTaskId, message);

    const latestParentTask = getTaskFresh(parentTaskId);
    const latestPlan = (latestParentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined) || assemblyPlan;
    updateParentAssemblyPlan(parentTaskId, markBoundaryBridgeStale({
      assemblyPlan: latestPlan,
      boundaryIndex,
      reason: message,
    }), `边界 ${boundaryIndex + 1}->${boundaryIndex + 2} bridge 生成失败，已阻断下游片段伪成功。`);
  }
}

export function startProductionBoundaryBridge(
  input: StartProductionBoundaryBridgeInput,
  byokConnection?: BYOKConnection
): StartProductionBoundaryBridgeResult {
  const parentTaskId = input.parentTaskId;
  const boundaryIndex = typeof input.boundaryIndex === 'number'
    ? input.boundaryIndex
    : Number(input.boundaryIndex);

  if (!parentTaskId || !Number.isFinite(boundaryIndex)) {
    throw new ProductionBoundaryBridgeStartError(
      '请提供 parentTaskId 与 boundaryIndex。',
      { code: 'boundary-bridge-start-input-invalid' },
      400
    );
  }

  const parentTask = getTaskFresh(parentTaskId);
  const assemblyPlan = parentTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  if (!parentTask?.result || !assemblyPlan) {
    throw new ProductionBoundaryBridgeStartError(
      '父任务或 assemblyPlan 不存在，请先创建 production assembly plan。',
      { code: 'boundary-bridge-parent-missing' },
      404
    );
  }

  const startPayload = buildProductionBoundaryBridgeStartPayload(assemblyPlan, boundaryIndex);

  if (input.dryRun !== false) {
    updateTask(parentTaskId, {
      message: `边界 ${boundaryIndex + 1}->${boundaryIndex + 2} bridge dry-run 通过，尚未调用供应商。`,
      result: {
        ...parentTask.result,
        latestBoundaryBridgeStartPayload: {
          ...startPayload,
          providerPrompt: startPayload.providerPrompt,
        },
      },
    });

    return {
      success: true,
      dryRun: true,
      usedRealKey: false,
      incurredCost: false,
      parentTaskId,
      boundaryIndex,
      bridgeDuration: startPayload.bridgeDurationSeconds,
      startPayload,
      nextAction: '若要真实生成 boundary bridge，请带 BYOK headers 并设置 allowRealCost=true、dryRun=false。',
    };
  }

  if (input.allowRealCost !== true) {
    throw new ProductionBoundaryBridgeStartError(
      '真实 boundary bridge 生成可能产生费用，必须显式设置 allowRealCost=true。',
      { code: 'boundary-bridge-real-cost-not-allowed' },
      400
    );
  }

  if (!byokConnection) {
    throw new ProductionBoundaryBridgeStartError(
      '真实 boundary bridge 生成需要在设置页或请求头提供 Ark Plan API Base、API Key 和视频模型。',
      { code: 'boundary-bridge-byok-missing' },
      400
    );
  }

  const childTaskId = createTask('video', {
    workflow: 'production-boundary-bridge',
    parentTaskId,
    boundaryIndex,
    boundaryBridgeId: startPayload.boundaryBridgeId,
    previousSegmentId: startPayload.previousSegmentId,
    nextSegmentId: startPayload.nextSegmentId,
    ratio: typeof parentTask.config?.ratio === 'string' ? parentTask.config.ratio : '16:9',
    videoModel: byokConnection.videoModel || byokConnection.model,
    bridgeStartPayload: {
      ...startPayload,
      providerPrompt: startPayload.providerPrompt,
    },
    generateAudio: input.generateAudio === true,
  });

  startTask(childTaskId);
  updateTaskProgress(childTaskId, 10, '正在提交边界 bridge 视频任务（Ark BYOK）...', 'bridge 成功后会抽取 new-camera image 并写回下一段首帧。');

  void runBoundaryBridgeProviderJob({
    byokConnection,
    parentTaskId,
    childTaskId,
    boundaryIndex,
    assemblyPlan,
    startPayload,
    ratio: typeof parentTask.config?.ratio === 'string' ? parentTask.config.ratio : '16:9',
    videoModel: byokConnection.videoModel || byokConnection.model,
    generateAudio: input.generateAudio === true,
  });

  return {
    success: true,
    dryRun: false,
    usedRealKey: true,
    incurredCost: true,
    parentTaskId,
    childTaskId,
    boundaryIndex,
    bridgeDuration: 5,
    startPayload,
    message: '边界 bridge 真实生成已启动，可在任务中心轮询该子任务；成功后自动写回 next firstFrameUrl。',
  };
}
