'use client';

import { RefreshCw, Search } from 'lucide-react';
import type { ProductionSegmentUiState } from '@/lib/production-segment-ui';

interface TaskCenterSegmentActionItem {
  index: number;
  status?: string;
  error?: string | null;
  expectedOutputs?: {
    taskId?: string | null;
    providerTaskId?: string | null;
  };
}

interface TaskCenterSegmentActionsProps {
  taskId: string;
  segment: TaskCenterSegmentActionItem;
  segmentUi: ProductionSegmentUiState;
  retryingKey: string | null;
  providerRecoveryKey: string | null;
  onRetry: (segmentIndex: number, childTaskId?: string | null) => void;
  onRecoverProviderTask: (segmentIndex: number, childTaskId?: string | null) => void;
}

export function TaskCenterSegmentActions({
  taskId,
  segment,
  segmentUi,
  retryingKey,
  providerRecoveryKey,
  onRetry,
  onRecoverProviderTask,
}: TaskCenterSegmentActionsProps) {
  const retryKey = `${taskId}:${segment.index}`;
  const providerKey = `${taskId}:${segment.index}:provider`;
  const childTaskId = segment.expectedOutputs?.taskId;
  const canRecoverProviderTask = Boolean(
    childTaskId
      && segment.expectedOutputs?.providerTaskId
      && (segment.status === 'failed' || segment.error)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRecoverProviderTask && (
        <button
          type="button"
          onClick={() => onRecoverProviderTask(segment.index, childTaskId)}
          disabled={providerRecoveryKey === providerKey}
          className="inline-flex items-center rounded bg-cyan-300/15 px-2 py-0.5 text-[10px] text-cyan-50 hover:bg-cyan-300/25 disabled:cursor-wait disabled:opacity-60"
          title="优先续查 providerTaskId，不重新提交生成，不产生新的视频生成费用。"
        >
          <Search className={`mr-1 h-3 w-3 ${providerRecoveryKey === providerKey ? 'animate-pulse' : ''}`} />
          {providerRecoveryKey === providerKey ? '查询中' : '查供应商'}
        </button>
      )}
      {segmentUi.canRetry && (
        <button
          type="button"
          onClick={() => onRetry(segment.index, childTaskId)}
          disabled={retryingKey === retryKey}
          className="inline-flex items-center rounded bg-amber-300/15 px-2 py-0.5 text-[10px] text-amber-50 hover:bg-amber-300/25 disabled:cursor-wait disabled:opacity-60"
          title={segmentUi.actionHint}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${retryingKey === retryKey ? 'animate-spin' : ''}`} />
          {retryingKey === retryKey ? '排队中' : '重新排队'}
        </button>
      )}
      {segmentUi.canCopyTaskId && childTaskId && (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(childTaskId)}
          className="rounded bg-black/25 px-2 py-0.5 text-[10px] text-violet-100/75 hover:text-white"
          title="复制子任务 ID"
        >
          {segmentUi.taskLabel}
        </button>
      )}
    </div>
  );
}
