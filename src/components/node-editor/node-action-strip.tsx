'use client';

import { useState } from 'react';
import { getBYOKRequestHeaders } from '@/lib/byok-client';

interface NodeActionStripData {
  generatedVideo?: string;
  videoUrl?: string;
  productionTaskId?: string;
  taskId?: string;
  parentTaskId?: string;
  childTaskId?: string;
  segmentIndex?: number | string;
  productionAssetKind?: string;
  assetKind?: string;
  segmentStatus?: string;
  status?: string;
  error?: unknown;
  segmentError?: unknown;
  lastFrameUrl?: string;
  providerTaskId?: string;
}

const openNodeDetails = (nodeId: string, event: React.MouseEvent) => {
  event.stopPropagation();
  window.dispatchEvent(new CustomEvent('huiying-node-open-details', { detail: { nodeId } }));
};

export const NodeActionStrip = ({ id, data }: { id: string; data: NodeActionStripData }) => {
  const [actionState, setActionState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [actionMessage, setActionMessage] = useState('');
  const mediaUrl = data.generatedVideo || data.videoUrl;
  const taskId = data.productionTaskId || data.taskId;
  const parentTaskId = data.productionTaskId || data.parentTaskId;
  const childTaskId = data.childTaskId || (data.productionTaskId && data.taskId !== data.productionTaskId ? data.taskId : undefined);
  const segmentIndex = Number(data.segmentIndex);
  const assetKind = data.productionAssetKind || data.assetKind;
  const segmentStatus = String(data.segmentStatus || data.status || '');
  const hasSegmentVideo = Boolean(mediaUrl);
  const hasSegmentError = Boolean(data.error || data.segmentError);
  const hasLastFrame = Boolean(data.lastFrameUrl);
  const hasProviderTaskId = Boolean(data.providerTaskId);
  const canExport = assetKind === 'finalVideo' || assetKind === 'deliverable';
  const canRecoverProviderTask = (assetKind === 'videoSegment' || assetKind === 'assemblySegment')
    && childTaskId
    && hasProviderTaskId
    && (segmentStatus === 'failed' || segmentStatus === 'error' || hasSegmentError);
  const canRetrySegment = (assetKind === 'videoSegment' || assetKind === 'assemblySegment')
    && parentTaskId
    && Number.isFinite(segmentIndex)
    && !hasSegmentVideo
    && (segmentStatus === 'failed' || segmentStatus === 'error' || hasSegmentError);
  const canRecoverTailFrame = (assetKind === 'videoSegment' || assetKind === 'assemblySegment')
    && childTaskId
    && hasSegmentVideo
    && !hasLastFrame
    && (segmentStatus === 'failed' || segmentStatus === 'error' || hasSegmentError);
  const canMergeSegments = (assetKind === 'finalVideo' || assetKind === 'deliverable') && parentTaskId;

  const runNodeAction = async (
    event: React.MouseEvent,
    action: 'retry-segment' | 'recover-provider-task' | 'recover-tail-frame' | 'merge-segments',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActionState('running');
    setActionMessage(action === 'retry-segment'
      ? '正在重新排队片段...'
      : action === 'recover-provider-task'
        ? '正在续查供应商任务...'
        : action === 'recover-tail-frame'
          ? '正在从 partial video 恢复尾帧...'
          : '正在调用本地合成...');

    try {
      const response = action === 'merge-segments'
        ? await fetch(`/api/tasks/${encodeURIComponent(parentTaskId!)}/merge-segments`, {
          method: 'POST',
        })
        : await fetch(action === 'recover-provider-task'
          ? '/api/production/assembly-plan/segment/recover-provider-task'
          : action === 'recover-tail-frame'
            ? '/api/production/assembly-plan/segment/recover-tail-frame'
            : '/api/production/assembly-plan/segment/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify(action === 'recover-provider-task' || action === 'recover-tail-frame'
            ? { childTaskId }
            : { parentTaskId, segmentIndex }),
        });
      const result = await response.json().catch(() => ({}));
      const pendingProviderRecovery = action === 'recover-provider-task' && response.status === 202;
      if (!response.ok || (result?.success === false && !pendingProviderRecovery)) {
        throw new Error(result?.error || `操作失败：${response.status}`);
      }
      setActionState('done');
      setActionMessage(action === 'retry-segment'
        ? `片段已重新排队：${result.childTaskId || childTaskId || '待刷新'}`
        : action === 'recover-provider-task'
          ? (pendingProviderRecovery
            ? '供应商仍在生成，稍后可再次查询，不会重复扣费'
            : `供应商结果已恢复：尾帧${result.lastFrameUrlPresent ? '已写回' : '待补齐'}`)
          : action === 'recover-tail-frame'
            ? `尾帧已恢复：下一段首帧${result.nextSegmentFirstFrameUrl ? '已写入' : '待刷新'}`
            : `已合成：${result.segmentCount || 0} 段`);
      window.dispatchEvent(new CustomEvent('huiying-node-action-completed', {
        detail: {
          action,
          nodeId: id,
          taskId: parentTaskId,
          childTaskId: result.childTaskId || childTaskId,
          result,
        },
      }));
    } catch (error) {
      setActionState('error');
      setActionMessage(error instanceof Error ? error.message : '节点操作失败');
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
      <button
        type="button"
        className="nodrag nopan rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-100 hover:border-cyan-200/50 hover:bg-cyan-300/20"
        onClick={(event) => openNodeDetails(id, event)}
      >
        详情
      </button>
      {mediaUrl ? (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="nodrag nopan rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100 hover:border-amber-200/50 hover:bg-amber-300/20"
          onClick={(event) => event.stopPropagation()}
        >
          打开
        </a>
      ) : null}
      {taskId ? (
        <a
          href={`/?section=tasks&taskId=${encodeURIComponent(taskId)}`}
          className="nodrag nopan rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[11px] text-violet-100 hover:border-violet-200/50 hover:bg-violet-300/20"
          onClick={(event) => event.stopPropagation()}
        >
          任务
        </a>
      ) : null}
      {canExport && taskId ? (
        <a
          href={`/api/production/export?taskId=${encodeURIComponent(taskId)}&format=cut-draft-json`}
          target="_blank"
          rel="noreferrer"
          className="nodrag nopan rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100 hover:border-emerald-200/50 hover:bg-emerald-300/20"
          onClick={(event) => event.stopPropagation()}
        >
          导出
        </a>
      ) : null}
      {canRetrySegment ? (
        <button
          type="button"
          data-testid={`node-action-retry-segment-${id}`}
          disabled={actionState === 'running'}
          className="nodrag nopan rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-100 hover:border-sky-200/50 hover:bg-sky-300/20 disabled:cursor-wait disabled:opacity-60"
          onClick={(event) => runNodeAction(event, 'retry-segment')}
        >
          重排队
        </button>
      ) : null}
      {canRecoverProviderTask ? (
        <button
          type="button"
          data-testid={`node-action-recover-provider-task-${id}`}
          disabled={actionState === 'running'}
          className="nodrag nopan rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100 hover:border-emerald-200/50 hover:bg-emerald-300/20 disabled:cursor-wait disabled:opacity-60"
          onClick={(event) => runNodeAction(event, 'recover-provider-task')}
        >
          查供应商
        </button>
      ) : null}
      {canRecoverTailFrame ? (
        <button
          type="button"
          data-testid={`node-action-recover-tail-frame-${id}`}
          disabled={actionState === 'running'}
          className="nodrag nopan rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-0.5 text-[11px] text-orange-100 hover:border-orange-200/50 hover:bg-orange-300/20 disabled:cursor-wait disabled:opacity-60"
          onClick={(event) => runNodeAction(event, 'recover-tail-frame')}
        >
          恢复尾帧
        </button>
      ) : null}
      {canMergeSegments ? (
        <button
          type="button"
          data-testid={`node-action-merge-segments-${id}`}
          disabled={actionState === 'running'}
          className="nodrag nopan rounded-full border border-teal-300/20 bg-teal-400/10 px-2 py-0.5 text-[11px] text-teal-100 hover:border-teal-200/50 hover:bg-teal-300/20 disabled:cursor-wait disabled:opacity-60"
          onClick={(event) => runNodeAction(event, 'merge-segments')}
        >
          合成
        </button>
      ) : null}
      {actionMessage ? (
        <span
          data-testid={`node-action-status-${id}`}
          className={`basis-full text-[10px] ${
            actionState === 'error' ? 'text-amber-200' : actionState === 'done' ? 'text-emerald-200' : 'text-slate-300'
          }`}
        >
          {actionMessage}
        </span>
      ) : null}
    </div>
  );
};
