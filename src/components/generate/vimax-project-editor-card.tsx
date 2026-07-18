'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clientApiFetch } from '@/lib/client-api';
import type { ProductionProject } from '@/lib/production-project';
import {
  applyVimaxAssetEditorWriteback,
  applyVimaxStoryboardEditorWriteback,
  resolveVimaxProjectEditorView,
} from '@/lib/skills/vimax-short-drama/vimax-project-editor';
import type {
  VimaxAssetWritebackResponse,
  VimaxStoryboardWritebackResponse,
} from '@/lib/skills/vimax-short-drama/vimax-project-editor';

interface TaskResponse {
  success: boolean;
  task?: { result?: unknown };
}

export function VimaxProjectEditorCard({ taskId, requestHeaders }: {
  taskId: string;
  requestHeaders?: Record<string, string>;
}) {
  const [project, setProject] = useState<ProductionProject | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedShotId, setSelectedShotId] = useState('');
  const [assetDraft, setAssetDraft] = useState({ name: '', summary: '', relatedShotIds: [] as string[] });
  const [shotDraft, setShotDraft] = useState({ prompt: '', duration: 1 });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<'asset' | 'shot' | ''>('');
  const [error, setError] = useState('');
  const loadSequence = useRef(0);

  const view = useMemo(
    () => project ? resolveVimaxProjectEditorView({ productionProject: project }) : null,
    [project],
  );
  const selectedAsset = view?.editableAssets.find(asset => asset.id === selectedAssetId) || view?.editableAssets[0];
  const selectedShot = view?.shots.find(shot => shot.id === selectedShotId) || view?.shots[0];

  const loadProject = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await clientApiFetch<TaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}`, {
        headers: requestHeaders,
        redirectOnUnauthorized: false,
      });
      const recovered = resolveVimaxProjectEditorView(response.task?.result);
      if (!recovered) throw new Error('project_not_ready');
      if (sequence !== loadSequence.current) return;
      setProject(recovered.project);
      setSelectedAssetId(current => recovered.editableAssets.some(asset => asset.id === current)
        ? current
        : recovered.editableAssets[0]?.id || '');
      setSelectedShotId(current => recovered.shots.some(shot => shot.id === current)
        ? current
        : recovered.shots[0]?.id || '');
    } catch {
      if (sequence === loadSequence.current) setError('制作内容加载失败，请重试。');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [requestHeaders, taskId]);

  useEffect(() => {
    void loadProject();
    return () => { loadSequence.current += 1; };
  }, [loadProject]);

  useEffect(() => {
    if (!selectedAsset || !view) return;
    setAssetDraft({
      name: selectedAsset.name,
      summary: selectedAsset.summary,
      relatedShotIds: selectedAsset.relatedShotIds?.length
        ? selectedAsset.relatedShotIds
        : view.shots.map(shot => shot.id),
    });
  }, [selectedAsset, view]);

  useEffect(() => {
    if (!selectedShot) return;
    setShotDraft({ prompt: selectedShot.prompt, duration: selectedShot.duration });
  }, [selectedShot]);

  async function saveAsset() {
    if (!project || !selectedAsset || pending) return;
    setPending('asset');
    setError('');
    try {
      const response = await clientApiFetch<VimaxAssetWritebackResponse>(
        `/api/production/projects/${encodeURIComponent(taskId)}/assets/${encodeURIComponent(selectedAsset.id)}`,
        {
          method: 'PATCH',
          headers: requestHeaders,
          body: JSON.stringify(assetDraft),
          redirectOnUnauthorized: false,
        },
      );
      setProject(current => current ? applyVimaxAssetEditorWriteback(current, response) : current);
    } catch {
      setError('素材保存失败，请重试。已保存的内容不会被覆盖。');
    } finally {
      setPending('');
    }
  }

  async function saveShot() {
    if (!project || !selectedShot || pending) return;
    setPending('shot');
    setError('');
    try {
      const response = await clientApiFetch<VimaxStoryboardWritebackResponse>(
        `/api/production/projects/${encodeURIComponent(taskId)}/storyboard/${encodeURIComponent(selectedShot.id)}`,
        {
          method: 'PATCH',
          headers: requestHeaders,
          body: JSON.stringify(shotDraft),
          redirectOnUnauthorized: false,
        },
      );
      setProject(current => current ? applyVimaxStoryboardEditorWriteback(current, response) : current);
    } catch {
      setError('分镜保存失败，请重试。已保存的内容不会被覆盖。');
    } finally {
      setPending('');
    }
  }

  if (loading) {
    return <div className="mt-3 rounded-xl border border-[#e3e7ed] bg-[#f8fafc] px-3 py-3 text-xs text-[#7c8592]">正在加载素材与分镜…</div>;
  }

  if (!view) {
    return (
      <div className="mt-3 rounded-xl border border-[#f0d7d7] bg-[#fff8f8] px-3 py-3 text-xs text-[#9a4545]">
        <p>{error || '暂时无法加载制作内容。'}</p>
        <button type="button" onClick={() => void loadProject()} className="mt-2 rounded-lg border border-[#e6c5c5] bg-white px-3 py-1.5 font-medium">重新加载</button>
      </div>
    );
  }

  return (
    <section className="mt-3 rounded-xl border border-[#dfe5ed] bg-[#f8fafc] p-3" data-testid="creation-project-editor">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#313844]">素材与分镜</p>
          <p className="mt-0.5 text-[11px] text-[#7c8592]">直接调整已有制作内容，保存后刷新仍会保留。</p>
        </div>
        <button type="button" disabled={Boolean(pending)} onClick={() => void loadProject()} className="rounded-lg border border-[#dfe5ed] bg-white px-2.5 py-1 text-[11px] text-[#596270] disabled:opacity-50">刷新内容</button>
      </div>

      {error ? <p role="alert" className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] text-red-600">{error}</p> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#e2e7ee] bg-white p-3">
          <label className="text-[11px] font-medium text-[#4d5663]" htmlFor={`asset-${taskId}`}>项目素材</label>
          <select id={`asset-${taskId}`} value={selectedAsset?.id || ''} onChange={event => setSelectedAssetId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe5ed] bg-white px-2.5 py-2 text-xs text-[#313844]">
            {view.editableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          <input value={assetDraft.name} onChange={event => setAssetDraft(current => ({ ...current, name: event.target.value }))} aria-label="素材名称" className="mt-2 w-full rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
          <textarea value={assetDraft.summary} onChange={event => setAssetDraft(current => ({ ...current, summary: event.target.value }))} aria-label="素材说明" rows={3} className="mt-2 w-full resize-y rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <fieldset className="mt-2 rounded-lg border border-[#e2e7ee] bg-[#f8fafc] px-2.5 py-2">
            <legend className="px-1 text-[11px] font-medium text-[#4d5663]">适用镜头</legend>
            <p className="mb-1.5 text-[10px] text-[#7c8592]">全选表示贯穿全片；只选部分镜头可记录服饰、道具或场景状态变化。</p>
            <div className="flex flex-wrap gap-2">
              {view.shots.map(shot => (
                <label key={shot.id} className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] text-[#4d5663]">
                  <input
                    type="checkbox"
                    checked={assetDraft.relatedShotIds.includes(shot.id)}
                    onChange={event => setAssetDraft(current => ({
                      ...current,
                      relatedShotIds: event.target.checked
                        ? [...current.relatedShotIds, shot.id]
                        : current.relatedShotIds.filter(shotId => shotId !== shot.id),
                    }))}
                  />
                  镜头 {shot.index}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" disabled={!selectedAsset || Boolean(pending) || assetDraft.relatedShotIds.length === 0} onClick={() => void saveAsset()} className="mt-2 rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">{pending === 'asset' ? '正在保存…' : '保存素材'}</button>
        </div>

        <div className="rounded-lg border border-[#e2e7ee] bg-white p-3">
          <label className="text-[11px] font-medium text-[#4d5663]" htmlFor={`shot-${taskId}`}>项目分镜</label>
          <select id={`shot-${taskId}`} value={selectedShot?.id || ''} onChange={event => setSelectedShotId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe5ed] bg-white px-2.5 py-2 text-xs text-[#313844]">
            {view.shots.map(shot => <option key={shot.id} value={shot.id}>镜头 {shot.index} · {shot.duration} 秒</option>)}
          </select>
          <textarea value={shotDraft.prompt} onChange={event => setShotDraft(current => ({ ...current, prompt: event.target.value }))} aria-label="分镜提示词" rows={4} className="mt-2 w-full resize-y rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <label className="mt-2 flex items-center gap-2 text-[11px] text-[#596270]">时长（秒）<input type="number" min={1} max={30} value={shotDraft.duration} onChange={event => setShotDraft(current => ({ ...current, duration: Number(event.target.value) }))} className="w-20 rounded-lg border border-[#dfe5ed] px-2 py-1.5 text-xs" /></label>
          <button type="button" disabled={!selectedShot || Boolean(pending)} onClick={() => void saveShot()} className="mt-2 rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">{pending === 'shot' ? '正在保存…' : '保存分镜'}</button>
        </div>
      </div>
    </section>
  );
}
