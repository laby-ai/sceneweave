'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, RotateCcw, Rows3 } from 'lucide-react';

import { clientApiFetch } from '@/lib/client-api';
import {
  buildVimaxSegmentedProductionView,
  type VimaxSegmentedProductionAction,
  type VimaxSegmentedProductionTaskResult,
  type VimaxSegmentedProductionView,
} from '@/lib/skills/vimax-short-drama/vimax-segmented-production';

interface TaskResponse {
  success: boolean;
  task?: { result?: VimaxSegmentedProductionTaskResult };
}

interface ExportResponse {
  success: boolean;
  exportPackage: unknown;
}

const SEGMENT_STATUS: Record<string, string> = {
  queued: '等待制作',
  running: '制作中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
  planned: '已规划',
};

export function VimaxSegmentedProductionCard({
  taskId,
  requestHeaders,
}: {
  taskId: string;
  requestHeaders?: Record<string, string>;
}) {
  const [view, setView] = useState<VimaxSegmentedProductionView | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusyKey('refresh');
    setError(null);
    try {
      const response = await clientApiFetch<TaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}`, {
        headers: requestHeaders,
        redirectOnUnauthorized: false,
      });
      setView(buildVimaxSegmentedProductionView(taskId, response.task?.result));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取分段任务状态');
    } finally {
      setBusyKey(null);
    }
  }, [requestHeaders, taskId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const runAction = useCallback(async (action: VimaxSegmentedProductionAction, key: string) => {
    setBusyKey(key);
    setError(null);
    try {
      await clientApiFetch(action.path, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(action.body),
        redirectOnUnauthorized: false,
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '分段任务操作失败');
      setBusyKey(null);
    }
  }, [refresh, requestHeaders]);

  const downloadExport = useCallback(async () => {
    if (!view?.exportPath) return;
    setBusyKey('export');
    setError(null);
    try {
      const response = await clientApiFetch<ExportResponse>(view.exportPath, {
        headers: requestHeaders,
        redirectOnUnauthorized: false,
      });
      const blob = new Blob([JSON.stringify(response.exportPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `creation-cut-draft-${taskId.slice(0, 8)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '制作草稿导出失败');
    } finally {
      setBusyKey(null);
    }
  }, [requestHeaders, taskId, view]);

  if (!view && !error) {
    return <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#e3e7ed] bg-[#f8f9fb] px-3 py-3 text-xs text-[#858c97]"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在恢复分段制作状态…</div>;
  }

  return (
    <section className="mt-3 rounded-xl border border-[#dfe5ed] bg-[#f8fafc] p-3" data-testid="vimax-segmented-production">
      <div className="flex flex-wrap items-center gap-2">
        <Rows3 className="h-4 w-4 text-[#2f6bff]" />
        <h4 className="text-sm font-semibold text-[#303640]">分段制作</h4>
        {view ? <span className="rounded-full bg-[#edf3ff] px-2 py-0.5 text-[11px] text-[#2f6bff]">{view.statusLabel}</span> : null}
        <button type="button" onClick={() => void refresh()} disabled={Boolean(busyKey)} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#dfe4eb] bg-white px-2.5 py-1 text-[11px] text-[#68717d] disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${busyKey === 'refresh' ? 'animate-spin' : ''}`} />刷新
        </button>
      </div>

      {view?.segments.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {view.segments.map(segment => (
            <div key={segment.index} className="rounded-lg border border-[#e3e7ed] bg-white px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#3a414b]">{segment.title}</span>
                <span className="text-[#9299a4]">{segment.duration}s</span>
                <span className="ml-auto text-[#68717d]">{SEGMENT_STATUS[segment.status] || segment.status}</span>
              </div>
              {segment.error ? <p className="mt-1 line-clamp-2 text-red-500">该片段未完成，可单独重试。</p> : null}
              {segment.retryAction ? (
                <button type="button" onClick={() => void runAction(segment.retryAction!, `retry-${segment.index}`)} disabled={Boolean(busyKey)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700 disabled:opacity-50">
                  <RotateCcw className={`h-3 w-3 ${busyKey === `retry-${segment.index}` ? 'animate-spin' : ''}`} />仅重试此片段
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {view?.primaryAction ? (
          <button type="button" onClick={() => void runAction(view.primaryAction!, 'queue')} disabled={Boolean(busyKey)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6bff] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {busyKey === 'queue' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rows3 className="h-3.5 w-3.5" />}{view.primaryAction.label}
          </button>
        ) : null}
        {view?.exportPath ? (
          <button type="button" onClick={() => void downloadExport()} disabled={Boolean(busyKey)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4eb] bg-white px-3 py-1.5 text-xs font-medium text-[#555d68] disabled:opacity-50">
            {busyKey === 'export' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}导出制作草稿
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[#9299a4]">
        创建队列只保存片段任务，不会直接调用视频模型；失败片段可单独恢复。{view && !view.exportPath ? '完成交付准备后即可导出制作草稿。' : ''}
      </p>
    </section>
  );
}
