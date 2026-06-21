export interface ProductionSegmentUiState {
  statusLabel: string;
  statusClassName: string;
  canRetry: boolean;
  canCopyTaskId: boolean;
  canOpenVideo: boolean;
  canOpenLastFrame: boolean;
  providerLabel: string | null;
  taskLabel: string | null;
  errorText: string | null;
  actionHint: string;
}

export function getProductionSegmentStatusClass(status?: string) {
  switch (status) {
    case 'completed':
      return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50';
    case 'running':
      return 'border-sky-300/25 bg-sky-300/10 text-sky-50';
    case 'failed':
      return 'border-amber-300/25 bg-amber-300/10 text-amber-50';
    case 'skipped':
      return 'border-slate-300/20 bg-slate-300/10 text-slate-100';
    default:
      return 'border-cyan-300/15 bg-cyan-300/10 text-cyan-50';
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return status || 'queued';
  }
}

export function deriveProductionSegmentUiState(
  segment: {
    status?: string;
    error?: string | null;
    expectedOutputs?: {
      taskId?: string | null;
      videoUrl?: string | null;
      lastFrameUrl?: string | null;
      providerTaskId?: string | null;
    };
  }
): ProductionSegmentUiState {
  const outputs = segment.expectedOutputs || {
    taskId: null,
    videoUrl: null,
    lastFrameUrl: null,
    providerTaskId: null,
  };
  const taskId = outputs.taskId || null;
  const videoUrl = outputs.videoUrl || null;
  const lastFrameUrl = outputs.lastFrameUrl || null;
  const providerTaskId = outputs.providerTaskId || null;
  const canRetry = segment.status === 'failed' && !videoUrl;

  return {
    statusLabel: statusLabel(segment.status),
    statusClassName: getProductionSegmentStatusClass(segment.status),
    canRetry,
    canCopyTaskId: Boolean(taskId),
    canOpenVideo: Boolean(videoUrl),
    canOpenLastFrame: Boolean(lastFrameUrl),
    providerLabel: providerTaskId ? `provider ${providerTaskId.slice(0, 10)}` : null,
    taskLabel: taskId ? `task ${taskId.slice(0, 8)}` : null,
    errorText: segment.error || null,
    actionHint: canRetry
      ? '该片段失败且没有可用视频资产，可以重新排队；不会直接产生供应商费用。'
      : videoUrl
        ? '该片段已有视频资产，可打开或用于后续合成。'
        : '等待片段任务推进或写回结果。',
  };
}
