import { NextRequest, NextResponse } from 'next/server';

import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';
import { appendMissingLegacySegmentSnapshots } from '@/lib/legacy-segment-plan-rebuild';
import { restoreLegacySegmentProviderVideo } from '@/lib/legacy-segment-resume-provider';
import { summarizeLegacySegmentTask } from '@/lib/legacy-segment-task-summary';
import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';
import { archiveCompletedVideoTaskById } from '@/lib/production-video-task-archive-service';
import { evaluateLegacySegmentTransition } from '@/lib/production-segment-transition';
import { getTaskFresh, updateTask } from '@/lib/task-manager';
import type { TaskResult } from '@/lib/task-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResumeSegmentBody {
  segmentIndex?: number;
  dryRun?: boolean;
  allowRealCost?: boolean;
  mergeAfterComplete?: boolean;
  forceResubmit?: boolean;
}

type SegmentResult = NonNullable<TaskResult['segments']>[number];

function redactError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || '未知错误'))
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

function getSegments(task: ReturnType<typeof getTaskFresh>): SegmentResult[] {
  return Array.isArray(task?.result?.segments) ? task.result.segments : [];
}

function chooseSegmentIndex(task: ReturnType<typeof getTaskFresh>, requested?: number) {
  const segments = getSegments(task);
  if (Number.isFinite(requested)) return Number(requested);

  const failedFromResult = Array.isArray(task?.result?.failedSegments)
    ? task.result.failedSegments.find(index => Number.isFinite(index))
    : undefined;
  if (Number.isFinite(failedFromResult)) return Number(failedFromResult);

  const failedSegment = segments.find(segment => segment.status === 'failed');
  if (failedSegment) return failedSegment.index;

  const missingSegment = segments.find(segment => !segment.videoUrl);
  return missingSegment?.index;
}

function patchSegment(
  segments: SegmentResult[],
  segmentIndex: number,
  patch: Partial<SegmentResult>,
) {
  return segments.map(segment => {
    if (segment.index !== segmentIndex) return segment;
    return {
      ...segment,
      ...patch,
    };
  });
}

function updateTaskSegments(
  taskId: string,
  segments: SegmentResult[],
  extraResult: Partial<TaskResult> = {},
  taskPatch: Parameters<typeof updateTask>[1] = {},
) {
  const latestTask = getTaskFresh(taskId);
  const summary = summarizeLegacySegmentTask(latestTask, segments);
  return updateTask(taskId, {
    ...taskPatch,
    result: {
      ...(latestTask?.result || {}),
      ...extraResult,
      segments,
      isPartial: summary.successSegmentCount < summary.segmentCount,
      segmentCount: summary.segmentCount,
      successSegmentCount: summary.successSegmentCount,
      failedSegments: summary.failedSegments,
    },
  });
}

function getSegmentUrls(segments: SegmentResult[]) {
  return segments
    .map(segment => typeof segment.videoUrl === 'string' ? segment.videoUrl : '')
    .filter(Boolean);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const body = await request.json().catch(() => ({})) as ResumeSegmentBody;
  const task = getTaskFresh(taskId);

  if (!task) {
    return NextResponse.json({
      success: false,
      error: '任务不存在',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 404 });
  }

  let segments = getSegments(task);
  if (segments.length === 0) {
    return NextResponse.json({
      success: false,
      error: '该任务没有可恢复的分段快照。请先使用新版分段生成任务，确保每段写入 prompt/duration。',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 400 });
  }

  const rebuiltPlan = appendMissingLegacySegmentSnapshots(task, segments);
  if (rebuiltPlan.changed) {
    segments = rebuiltPlan.segments;
    updateTaskSegments(taskId, segments, {}, {
      stage: '已补齐缺失片段计划',
      message: '旧任务缺少后续片段快照，已根据原始 prompt/config 重建 pending 段，未产生视频费用。',
    });
  }

  const chosenIndex = chooseSegmentIndex(task, body.segmentIndex)
    ?? segments.find(item => !item.videoUrl)?.index;
  const segment = segments.find(item => item.index === chosenIndex);
  if (!segment) {
    return NextResponse.json({
      success: false,
      error: '未找到要恢复的片段。',
      usedRealKey: false,
      incurredCost: false,
      requestedSegmentIndex: chosenIndex,
    }, { status: 404 });
  }

  const resolvedSegmentIndex = segment.index;

  if (segment.videoUrl && segment.status === 'completed') {
    return NextResponse.json({
      success: false,
      error: '该片段已经完成，无需恢复。',
      usedRealKey: false,
      incurredCost: false,
      segmentIndex: resolvedSegmentIndex,
      ...summarizeLegacySegmentTask(task, segments),
    }, { status: 409 });
  }

  if (!segment.prompt || !segment.duration) {
    return NextResponse.json({
      success: false,
      error: '片段缺少 prompt 或 duration 快照，无法只补该片段；请重新生成新版分段任务。',
      usedRealKey: false,
      incurredCost: false,
      segmentIndex: resolvedSegmentIndex,
    }, { status: 400 });
  }

  const transition = evaluateLegacySegmentTransition(segments, resolvedSegmentIndex);
  if (!transition.ok) {
    updateTask(taskId, {
      stage: '片段衔接检查失败',
      message: transition.reason || '缺少上一段尾帧，不能启动后续片段。',
    });

    return NextResponse.json({
      success: false,
      error: transition.reason || '片段衔接检查失败',
      usedRealKey: false,
      incurredCost: false,
      taskId,
      segmentIndex: resolvedSegmentIndex,
      transition,
      nextAction: '先恢复或重新生成上一段，并确保写回 lastFrameUrl，再启动本段。',
    }, { status: 409 });
  }

  if (body.dryRun !== false) {
    updateTask(taskId, {
      stage: '片段恢复检查通过',
      message: `已定位第 ${resolvedSegmentIndex + 1} 个失败片段；真实恢复会使用上一段尾帧作为首帧参考，不会重跑已成功片段。`,
    });

    return NextResponse.json({
      success: true,
      dryRun: true,
      usedRealKey: false,
      incurredCost: false,
      taskId,
      segmentIndex: resolvedSegmentIndex,
      promptReady: true,
      duration: segment.duration,
      ratio: segment.ratio,
      videoModel: segment.videoModel,
      transition,
      ...summarizeLegacySegmentTask(task, segments),
      nextAction: '带 BYOK headers 并设置 dryRun=false、allowRealCost=true 后，可真实恢复该片段。',
    });
  }

  if (body.allowRealCost !== true) {
    return NextResponse.json({
      success: false,
      error: '真实恢复片段可能产生费用，必须显式设置 allowRealCost=true。',
      usedRealKey: false,
      incurredCost: false,
      segmentIndex: resolvedSegmentIndex,
    }, { status: 400 });
  }

  let byokConnection;
  try {
    byokConnection = extractBYOKConnection(request.headers);
  } catch (error) {
    if (isBYOKConfigError(error)) {
      return NextResponse.json({
        ...buildBYOKConfigErrorPayload(error),
        usedRealKey: false,
        incurredCost: false,
      }, { status: 400 });
    }
    throw error;
  }

  if (!byokConnection) {
    return NextResponse.json({
      success: false,
      error: '真实片段恢复需要在设置页或请求头提供 Ark Plan API Base、API Key 和视频模型。',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 400 });
  }

  try {
    const providerResult = await restoreLegacySegmentProviderVideo({
      byokConnection,
      taskId,
      segment,
      segmentIndex: resolvedSegmentIndex,
      transition,
      fallbackRatio: (task.config.ratio as string) || '16:9',
      forceResubmit: body.forceResubmit === true,
      onRetry: ({ attempt, delayMs, error }) => {
        updateTask(taskId, {
          stage: `第 ${resolvedSegmentIndex + 1} 个片段遇到供应商频率限制`,
          message: `第 ${attempt} 次提交失败，约 ${Math.ceil(delayMs / 1000)} 秒后自动重试：${redactError(error)}`,
        });
      },
    });
    if (providerResult.kind !== 'completed') {
      return NextResponse.json({
        success: false,
        usedRealKey: true,
        incurredCost: providerResult.incurredCost,
        taskId,
        segmentIndex: resolvedSegmentIndex,
        providerTaskIdPresent: Boolean(providerResult.providerTaskId),
        providerStatus: providerResult.kind === 'pending' ? providerResult.providerStatus : undefined,
        error: providerResult.kind === 'pending'
          ? '供应商任务仍未完成，稍后可再次恢复且不会重复提交。'
          : providerResult.error,
        nextAction: providerResult.kind === 'provider-failed'
          ? '确认供应商任务失败后，如确需重新生成，请显式设置 forceResubmit=true。'
          : '先修复尾帧/等待供应商完成，再恢复后续片段。',
        ...summarizeLegacySegmentTask(getTaskFresh(taskId) || task, getSegments(getTaskFresh(taskId))),
      }, { status: providerResult.kind === 'pending' ? 202 : 409 });
    }
    const { providerTaskId, videoUrl, lastFrameUrl } = providerResult;

    const completedSegments = patchSegment(getSegments(getTaskFresh(taskId)), resolvedSegmentIndex, {
      status: 'completed',
      providerTaskId,
      videoUrl,
      lastFrameUrl,
      error: undefined,
    });
    const completedSummary = summarizeLegacySegmentTask(getTaskFresh(taskId) || task, completedSegments);
    const allSegmentsComplete = completedSummary.successSegmentCount === completedSummary.segmentCount;
    const shouldMerge = body.mergeAfterComplete !== false && allSegmentsComplete;

    if (!shouldMerge) {
      updateTaskSegments(taskId, completedSegments, {}, {
        status: 'failed',
        stage: allSegmentsComplete ? '片段已补齐，等待合成' : '片段已恢复，仍有片段待补',
        progress: allSegmentsComplete ? 92 : Math.max(task.progress || 0, 75),
        message: allSegmentsComplete
          ? '所有片段已有视频 URL，可调用合成恢复。'
          : '该片段已恢复，但任务中仍存在缺失片段。',
      });

      return NextResponse.json({
        success: true,
        usedRealKey: true,
        incurredCost: providerResult.incurredCost,
        taskId,
      segmentIndex: resolvedSegmentIndex,
      videoUrl,
      merged: false,
        ...completedSummary,
      });
    }

    const segmentUrls = getSegmentUrls(completedSegments);
    const mergeResult = await mergeVideosWithLocalFfmpeg(segmentUrls);
    updateTaskSegments(taskId, completedSegments, {
      videoUrl: mergeResult.videoUrl,
      mergeRecovery: {
        method: 'resume-segment-local-ffmpeg',
        recoveredSegmentIndex: resolvedSegmentIndex,
        outputPath: mergeResult.outputPath,
        bytes: mergeResult.bytes,
        recoveredAt: new Date().toISOString(),
      },
    }, {
      status: 'completed',
      stage: '已完成',
      progress: 100,
      message: '缺失片段已补齐，并已使用本地 FFmpeg 合成为成片。',
      completedAt: Date.now(),
      error: undefined,
    });

    let archivedProduction: {
      productionProjectId: string;
      segmentAssetCount: number;
      finalVideoAssetCount: number;
      assemblyStatus: string;
    } | null = null;
    try {
      const archived = archiveCompletedVideoTaskById(taskId);
      archivedProduction = {
        productionProjectId: archived.productionProjectId,
        segmentAssetCount: archived.segmentAssetCount,
        finalVideoAssetCount: archived.finalVideoAssetCount,
        assemblyStatus: archived.assemblyStatus,
      };
      updateTask(taskId, {
        message: `缺失片段已补齐并合成为成片，已自动归档 ${archived.segmentAssetCount} 个 videoSegment 和 ${archived.finalVideoAssetCount} 个 finalVideo 资产。`,
      });
    } catch (archiveError) {
      const safeArchiveError = redactError(archiveError);
      updateTask(taskId, {
        message: `缺失片段已补齐并合成为成片，但制作项目归档失败：${safeArchiveError}。可稍后重试归档。`,
      });
      console.warn(`[Task ${taskId}] resume-segment archive failed:`, safeArchiveError);
    }

    return NextResponse.json({
      success: true,
      usedRealKey: true,
      incurredCost: providerResult.incurredCost,
      taskId,
      segmentIndex: resolvedSegmentIndex,
      videoUrl: mergeResult.videoUrl,
      merged: true,
      bytes: mergeResult.bytes,
      archivedProduction,
      ...summarizeLegacySegmentTask(getTaskFresh(taskId) || task, completedSegments),
    });
  } catch (error) {
    const message = redactError(error);
    const failedSegments = patchSegment(getSegments(getTaskFresh(taskId)), resolvedSegmentIndex, {
      status: 'failed',
      error: message,
    });
    updateTaskSegments(taskId, failedSegments, {}, {
      status: 'failed',
      stage: `第 ${resolvedSegmentIndex + 1} 个片段恢复失败`,
      progress: Math.max(task.progress || 0, 70),
      error: message,
      message: '已成功片段仍然保留；修复供应商问题后可再次只恢复该片段。',
      completedAt: Date.now(),
    });

    return NextResponse.json({
      success: false,
      usedRealKey: true,
      incurredCost: true,
      taskId,
      segmentIndex: resolvedSegmentIndex,
      error: message,
      ...summarizeLegacySegmentTask(getTaskFresh(taskId) || task, failedSegments),
    }, { status: 500 });
  }
}
