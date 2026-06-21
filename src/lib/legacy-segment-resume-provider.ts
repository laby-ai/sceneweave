import {
  getVideoStatusWithBYOK,
  submitVideoWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
} from '@/lib/byok-provider';
import { runWithBYOKVideoRetry } from '@/lib/byok-retry';
import { summarizeLegacySegmentTask } from '@/lib/legacy-segment-task-summary';
import { getTaskFresh, updateTask, type TaskResult } from '@/lib/task-manager';
import { extractLastFrameForHandoff } from '@/lib/video-frame-extraction';

type SegmentResult = NonNullable<TaskResult['segments']>[number];

interface LegacySegmentTransitionSnapshot {
  continuityPrompt: string;
  firstFrameUrl?: string | null;
}

interface RestoreLegacySegmentProviderVideoParams {
  byokConnection: BYOKConnection;
  taskId: string;
  segment: SegmentResult;
  segmentIndex: number;
  transition: LegacySegmentTransitionSnapshot;
  fallbackRatio?: string;
  forceResubmit?: boolean;
  onRetry?: (event: { attempt: number; delayMs: number; error: unknown }) => void;
}

export type LegacySegmentProviderRestoreResult =
  | {
      kind: 'completed';
      providerTaskId: string;
      videoUrl: string;
      lastFrameUrl?: string;
      incurredCost: boolean;
      usedExistingProviderTask: boolean;
    }
  | {
      kind: 'pending';
      providerTaskId: string;
      providerStatus: string;
      incurredCost: false;
    }
  | {
      kind: 'provider-failed';
      providerTaskId: string;
      error: string;
      incurredCost: false;
    }
  | {
      kind: 'tail-frame-missing';
      providerTaskId: string;
      videoUrl: string;
      error: string;
      incurredCost: boolean;
    };

function redactProviderError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || '未知错误'))
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

function getSegments(taskId: string): SegmentResult[] {
  const task = getTaskFresh(taskId);
  return Array.isArray(task?.result?.segments) ? task.result.segments : [];
}

function patchSegment(
  segments: SegmentResult[],
  segmentIndex: number,
  patch: Partial<SegmentResult>,
) {
  return segments.map(segment => (
    segment.index === segmentIndex
      ? { ...segment, ...patch }
      : segment
  ));
}

function updateSegments(
  taskId: string,
  segments: SegmentResult[],
  taskPatch: Parameters<typeof updateTask>[1] = {},
) {
  const task = getTaskFresh(taskId);
  const summary = summarizeLegacySegmentTask(task, segments);
  return updateTask(taskId, {
    ...taskPatch,
    result: {
      ...(task?.result || {}),
      segments,
      isPartial: summary.successSegmentCount < summary.segmentCount,
      segmentCount: summary.segmentCount,
      successSegmentCount: summary.successSegmentCount,
      failedSegments: summary.failedSegments,
    },
  });
}

async function completeWithTailFrame(params: {
  taskId: string;
  segmentIndex: number;
  providerTaskId: string;
  videoUrl: string;
  providerLastFrameUrl?: string;
  incurredCost: boolean;
  usedExistingProviderTask: boolean;
}): Promise<LegacySegmentProviderRestoreResult> {
  const summary = summarizeLegacySegmentTask(getTaskFresh(params.taskId), getSegments(params.taskId));
  const requiresTailFrame = params.segmentIndex < summary.segmentCount - 1;
  let lastFrameUrl = params.providerLastFrameUrl;

  if (!lastFrameUrl && requiresTailFrame) {
    updateTask(params.taskId, {
      stage: `第 ${params.segmentIndex + 1} 个片段已取回，正在抽取尾帧...`,
      message: '供应商未返回 lastFrameUrl，正在从已完成视频中本地抽帧，避免重复生成。',
    });
    const extraction = await extractLastFrameForHandoff(params.videoUrl);
    lastFrameUrl = extraction.lastFrameUrl;
    if (!lastFrameUrl) {
      const error = `${extraction.diagnostics.error || '尾帧抽取或上传失败'} [segment-tail-frame-missing]`;
      updateSegments(params.taskId, patchSegment(getSegments(params.taskId), params.segmentIndex, {
        status: 'failed',
        providerTaskId: params.providerTaskId,
        videoUrl: params.videoUrl,
        error,
      }), {
        status: 'failed',
        stage: `第 ${params.segmentIndex + 1} 个片段已取回但缺尾帧`,
        message: '已保留 partial video/providerTaskId；需要先修复尾帧通道再继续后续片段。',
        error,
      });
      return {
        kind: 'tail-frame-missing',
        providerTaskId: params.providerTaskId,
        videoUrl: params.videoUrl,
        error,
        incurredCost: params.incurredCost,
      };
    }
  }

  return {
    kind: 'completed',
    providerTaskId: params.providerTaskId,
    videoUrl: params.videoUrl,
    lastFrameUrl,
    incurredCost: params.incurredCost,
    usedExistingProviderTask: params.usedExistingProviderTask,
  };
}

async function reattachExistingProviderTask(
  params: RestoreLegacySegmentProviderVideoParams,
  providerTaskId: string,
): Promise<LegacySegmentProviderRestoreResult> {
  updateSegments(params.taskId, patchSegment(getSegments(params.taskId), params.segmentIndex, {
    status: 'running',
    providerTaskId,
  }), {
    status: 'running',
    stage: `正在查询第 ${params.segmentIndex + 1} 个片段的已有供应商任务...`,
    message: '检测到 providerTaskId，优先无费用取回结果，不重新提交视频生成。',
  });

  try {
    const status = await getVideoStatusWithBYOK(params.byokConnection, providerTaskId);
    if (status.status === 'succeeded' && status.videoUrl) {
      return completeWithTailFrame({
        taskId: params.taskId,
        segmentIndex: params.segmentIndex,
        providerTaskId,
        videoUrl: status.videoUrl,
        providerLastFrameUrl: status.lastFrameUrl,
        incurredCost: false,
        usedExistingProviderTask: true,
      });
    }
    if (status.status === 'failed') {
      const error = status.error || `供应商任务失败：${status.rawStatus || 'failed'}`;
      updateSegments(params.taskId, patchSegment(getSegments(params.taskId), params.segmentIndex, {
        status: 'failed',
        providerTaskId,
        error,
      }), {
        status: 'failed',
        stage: `第 ${params.segmentIndex + 1} 个片段供应商任务失败`,
        message: '如需重新烧一次费用，必须显式 forceResubmit=true。',
        error,
      });
      return { kind: 'provider-failed', providerTaskId, error, incurredCost: false };
    }
    updateTask(params.taskId, {
      stage: `第 ${params.segmentIndex + 1} 个片段仍在供应商侧生成中`,
      message: `供应商状态：${status.rawStatus || status.status}；稍后可再次恢复，不会重复提交。`,
    });
    return {
      kind: 'pending',
      providerTaskId,
      providerStatus: status.rawStatus || status.status,
      incurredCost: false,
    };
  } catch (error) {
    const message = redactProviderError(error);
    updateTask(params.taskId, {
      stage: `第 ${params.segmentIndex + 1} 个片段供应商状态查询失败`,
      message,
    });
    return { kind: 'provider-failed', providerTaskId, error: message, incurredCost: false };
  }
}

export async function restoreLegacySegmentProviderVideo(
  params: RestoreLegacySegmentProviderVideoParams
): Promise<LegacySegmentProviderRestoreResult> {
  const existingProviderTaskId = typeof params.segment.providerTaskId === 'string'
    ? params.segment.providerTaskId
    : '';
  if (existingProviderTaskId && !params.forceResubmit) {
    return reattachExistingProviderTask(params, existingProviderTaskId);
  }

  let providerTaskId = '';
  const videoResult = await runWithBYOKVideoRetry(
    async (attempt) => {
      const promptWithTransition = [
        `【片段衔接】${params.transition.continuityPrompt}`,
        params.transition.firstFrameUrl ? '【首帧参考】使用上一段 lastFrame 作为本段 firstFrame，先复现上一段末尾再推进。' : '',
        params.segment.prompt!,
      ].filter(Boolean).join('\n');
      const submitResult = await submitVideoWithBYOK(params.byokConnection, {
        prompt: promptWithTransition,
        duration: Math.min(Math.max(Number(params.segment.duration), 5), 10),
        ratio: params.segment.ratio || params.fallbackRatio || '16:9',
        model: params.segment.videoModel,
        firstFrameImage: params.transition.firstFrameUrl || undefined,
      });
      providerTaskId = submitResult.taskId;
      updateSegments(params.taskId, patchSegment(getSegments(params.taskId), params.segmentIndex, {
        status: 'running',
        providerTaskId,
      }), {
        stage: `第 ${params.segmentIndex + 1} 个片段已提交，等待 Ark 返回...`,
        message: `供应商任务已创建；这是第 ${attempt} 次提交。`,
      });
      return waitForVideoWithBYOK(
        params.byokConnection,
        submitResult.taskId,
        (status, pollAttempt) => {
          updateTask(params.taskId, {
            stage: `第 ${params.segmentIndex + 1} 个片段生成中：${status.rawStatus || status.status}`,
            message: `轮询 #${pollAttempt}；失败后仍可只重试该片段。`,
          });
        },
        { maxAttempts: 180, intervalMs: 3000 },
      );
    },
    {
      label: `恢复第 ${params.segmentIndex + 1} 个片段`,
      onRetry: params.onRetry,
    },
  );

  return completeWithTailFrame({
    taskId: params.taskId,
    segmentIndex: params.segmentIndex,
    providerTaskId,
    videoUrl: videoResult.videoUrl,
    providerLastFrameUrl: videoResult.lastFrameUrl,
    incurredCost: true,
    usedExistingProviderTask: false,
  });
}
