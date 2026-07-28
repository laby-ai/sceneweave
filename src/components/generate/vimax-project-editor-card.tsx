'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clientApiFetch } from '@/lib/client-api';
import type { ProductionProject } from '@/lib/production-project';
import {
  applyVimaxAssetEditorWriteback,
  applyVimaxStoryboardEditorWriteback,
  resolveVimaxProductionDirection,
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

interface DirectionWritebackResponse {
  success: boolean;
  productionProject?: ProductionProject;
  error?: string;
}

type StoryWritebackResponse = DirectionWritebackResponse & {
  invalidation?: {
    referenceAssets: number;
    videoSegments: number;
    finalVideos: number;
    nextStage: 'reference_assets';
  };
};

const emptyStoryDraft = {
  premise: '',
  protagonist: '',
  desire: '',
  obstacle: '',
  relationship: '',
  conflict: '',
  turningPoint: '',
  endingHook: '',
  emotionalArc: { start: '', shift: '', end: '' },
  continuityRules: '',
};

const notifyProjectUpdated = (taskId: string) => {
  window.dispatchEvent(new CustomEvent('huiying-vimax-project-updated', {
    detail: { taskId },
  }));
};

export function VimaxProjectEditorCard({ taskId, requestHeaders }: {
  taskId: string;
  requestHeaders?: Record<string, string>;
}) {
  const [project, setProject] = useState<ProductionProject | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedShotId, setSelectedShotId] = useState('');
  const [assetDraft, setAssetDraft] = useState({ name: '', summary: '', relatedShotIds: [] as string[] });
  const [shotDraft, setShotDraft] = useState({ prompt: '', duration: 1 });
  const [directionDraft, setDirectionDraft] = useState({ artStyle: '', directorManual: '' });
  const [storyDraft, setStoryDraft] = useState(emptyStoryDraft);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<'asset' | 'shot' | 'direction' | 'story' | ''>('');
  const [error, setError] = useState('');
  const [storyNotice, setStoryNotice] = useState('');
  const [shotNotice, setShotNotice] = useState('');
  const loadSequence = useRef(0);

  const view = useMemo(
    () => project ? resolveVimaxProjectEditorView({ productionProject: project }) : null,
    [project],
  );
  const selectedAsset = view?.editableAssets.find(asset => asset.id === selectedAssetId) || view?.editableAssets[0];
  const selectedShot = view?.shots.find(shot => shot.id === selectedShotId) || view?.shots[0];
  const selectedAssetVersion = selectedAsset?.metadata?.assetVersion as { number?: number; status?: string } | undefined;

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

  useEffect(() => {
    if (!project) return;
    setDirectionDraft(resolveVimaxProductionDirection(project));
    setStoryDraft({
      premise: project.storyBible.premise,
      protagonist: project.storyBible.protagonist,
      desire: project.storyBible.desire,
      obstacle: project.storyBible.obstacle,
      relationship: project.storyBible.relationship,
      conflict: project.storyBible.conflict,
      turningPoint: project.storyBible.turningPoint,
      endingHook: project.storyBible.endingHook,
      emotionalArc: { ...project.storyBible.emotionalArc },
      continuityRules: project.storyBible.continuityRules.join('\n'),
    });
  }, [project]);

  async function saveStory() {
    if (!project || pending) return;
    setPending('story');
    setError('');
    setStoryNotice('');
    try {
      const currentStory = project.storyBible;
      const patch: Record<string, unknown> = {};
      for (const field of [
        'premise',
        'protagonist',
        'desire',
        'obstacle',
        'relationship',
        'conflict',
        'turningPoint',
        'endingHook',
      ] as const) {
        if (storyDraft[field] !== currentStory[field]) patch[field] = storyDraft[field];
      }
      const emotionalArc = Object.fromEntries(
        (['start', 'shift', 'end'] as const)
          .filter(field => storyDraft.emotionalArc[field] !== currentStory.emotionalArc[field])
          .map(field => [field, storyDraft.emotionalArc[field]]),
      );
      if (Object.keys(emotionalArc).length > 0) patch.emotionalArc = emotionalArc;
      const rules = storyDraft.continuityRules.split('\n').map(rule => rule.trim()).filter(Boolean);
      if (JSON.stringify(rules) !== JSON.stringify(currentStory.continuityRules)) {
        patch.continuityRules = rules;
      }
      const response = await clientApiFetch<StoryWritebackResponse>(
        `/api/tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({
            action: 'update-story-bible',
            ...patch,
          }),
          redirectOnUnauthorized: false,
        },
      );
      if (!response.success || !response.productionProject) throw new Error(response.error || 'save_failed');
      setProject(response.productionProject);
      notifyProjectUpdated(taskId);
      const stoppedResults = (response.invalidation?.referenceAssets || 0)
        + (response.invalidation?.videoSegments || 0)
        + (response.invalidation?.finalVideos || 0);
      setStoryNotice(stoppedResults > 0
        ? `故事已更新，${stoppedResults} 项旧参考素材或视频已停用。下一步按新故事重新准备参考素材。`
        : '故事已更新。下一步按新故事准备参考素材。');
    } catch {
      setError('故事与角色 Bible 保存失败，请重试。当前草稿仍保留。');
    } finally {
      setPending('');
    }
  }

  async function saveDirection() {
    if (!project || pending) return;
    setPending('direction');
    setError('');
    try {
      const response = await clientApiFetch<DirectionWritebackResponse>(
        `/api/tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ action: 'update-production-direction', ...directionDraft }),
          redirectOnUnauthorized: false,
        },
      );
      if (!response.success || !response.productionProject) throw new Error(response.error || 'save_failed');
      setProject(response.productionProject);
    } catch {
      setError('制作方向保存失败，请重试。已保存的内容不会被覆盖。');
    } finally {
      setPending('');
    }
  }

  async function saveAsset(versionAction?: 'derive' | 'approve') {
    if (!project || !selectedAsset || pending) return;
    setPending('asset');
    setError('');
    try {
      const response = await clientApiFetch<VimaxAssetWritebackResponse>(
        `/api/production/projects/${encodeURIComponent(taskId)}/assets/${encodeURIComponent(selectedAsset.id)}`,
        {
          method: 'PATCH',
          headers: requestHeaders,
          body: JSON.stringify(versionAction === 'approve'
            ? { versionAction }
            : { ...assetDraft, ...(versionAction ? { versionAction } : {}) }),
          redirectOnUnauthorized: false,
        },
      );
      setProject(current => current ? applyVimaxAssetEditorWriteback(current, response) : current);
      if (response.asset) setSelectedAssetId(response.asset.id);
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
    setShotNotice('');
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
      notifyProjectUpdated(taskId);
      if (response.invalidation) {
        const retained = response.invalidation.retainedAcceptedSegments;
        setShotNotice(
          `分镜已更新。已保留前 ${retained} 个完成镜头；从镜头 ${response.invalidation.fromShotIndex} 起的旧参考图、片段和成片已停用，可仅重做受影响镜头。`,
        );
      }
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

      <details className="mt-3 rounded-lg border border-[#e2e7ee] bg-white p-3" open>
        <summary className="cursor-pointer text-[11px] font-medium text-[#4d5663]">故事与角色 Bible</summary>
        <p className="mt-1 text-[10px] text-[#7c8592]">修改故事后，旧参考图和成片会失效，避免把旧版本素材混入新故事。</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <textarea value={storyDraft.premise} onChange={event => setStoryDraft(current => ({ ...current, premise: event.target.value }))} aria-label="故事前提" placeholder="故事前提" rows={3} className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed sm:col-span-2" />
          <input value={storyDraft.protagonist} onChange={event => setStoryDraft(current => ({ ...current, protagonist: event.target.value }))} aria-label="主角" placeholder="主角" className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
          <input value={storyDraft.relationship} onChange={event => setStoryDraft(current => ({ ...current, relationship: event.target.value }))} aria-label="人物关系" placeholder="人物关系" className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
          <textarea value={storyDraft.desire} onChange={event => setStoryDraft(current => ({ ...current, desire: event.target.value }))} aria-label="角色目标" placeholder="角色目标" rows={2} className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <textarea value={storyDraft.obstacle} onChange={event => setStoryDraft(current => ({ ...current, obstacle: event.target.value }))} aria-label="主要阻碍" placeholder="主要阻碍" rows={2} className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <textarea value={storyDraft.conflict} onChange={event => setStoryDraft(current => ({ ...current, conflict: event.target.value }))} aria-label="核心冲突" placeholder="核心冲突" rows={2} className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <textarea value={storyDraft.turningPoint} onChange={event => setStoryDraft(current => ({ ...current, turningPoint: event.target.value }))} aria-label="中段转折" placeholder="中段转折" rows={2} className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <textarea value={storyDraft.endingHook} onChange={event => setStoryDraft(current => ({ ...current, endingHook: event.target.value }))} aria-label="结尾钩子" placeholder="结尾钩子" rows={2} className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed sm:col-span-2" />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input value={storyDraft.emotionalArc.start} onChange={event => setStoryDraft(current => ({ ...current, emotionalArc: { ...current.emotionalArc, start: event.target.value } }))} aria-label="起始情绪" placeholder="起始情绪" className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
          <input value={storyDraft.emotionalArc.shift} onChange={event => setStoryDraft(current => ({ ...current, emotionalArc: { ...current.emotionalArc, shift: event.target.value } }))} aria-label="转折情绪" placeholder="转折情绪" className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
          <input value={storyDraft.emotionalArc.end} onChange={event => setStoryDraft(current => ({ ...current, emotionalArc: { ...current.emotionalArc, end: event.target.value } }))} aria-label="结尾情绪" placeholder="结尾情绪" className="rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
        </div>
        <textarea value={storyDraft.continuityRules} onChange={event => setStoryDraft(current => ({ ...current, continuityRules: event.target.value }))} aria-label="连续性规则" placeholder={'每行一条连续性规则\n例如：关键道具始终在主角左手'} rows={4} className="mt-2 w-full resize-y rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
        <button type="button" disabled={Boolean(pending)} onClick={() => void saveStory()} className="mt-2 rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">{pending === 'story' ? '正在保存…' : '保存故事'}</button>
        {storyNotice ? (
          <p
            role="status"
            data-testid="story-invalidation-notice"
            className="mt-2 rounded-lg border border-[#cfe0ff] bg-[#f3f7ff] px-2.5 py-2 text-[11px] leading-5 text-[#3653a5]"
          >
            {storyNotice}
          </p>
        ) : null}
      </details>

      <div className="mt-3 rounded-lg border border-[#e2e7ee] bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium text-[#4d5663]">制作方向</p>
            <p className="mt-0.5 text-[10px] text-[#7c8592]">画风和导演约束会写入项目，并约束后续参考素材与每个视频镜头。</p>
          </div>
          <button type="button" disabled={Boolean(pending)} onClick={() => void saveDirection()} className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">{pending === 'direction' ? '正在保存…' : '保存方向'}</button>
        </div>
        <input value={directionDraft.artStyle} onChange={event => setDirectionDraft(current => ({ ...current, artStyle: event.target.value }))} aria-label="整体画风" placeholder="整体画风" className="mt-2 w-full rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs" />
        <textarea value={directionDraft.directorManual} onChange={event => setDirectionDraft(current => ({ ...current, directorManual: event.target.value }))} aria-label="导演手册" placeholder="导演手册：轴线、动作、构图、光色与叙事约束" rows={3} className="mt-2 w-full resize-y rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
      </div>

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
          {selectedAssetVersion ? (
            <p className="mt-2 text-[10px] text-[#7c8592]">
              版本 {selectedAssetVersion.number || '—'} · {{ draft: '待批准', approved: '已批准', superseded: '历史版本', failed: '生成失败' }[selectedAssetVersion.status || ''] || '未知状态'}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!selectedAsset || Boolean(pending) || assetDraft.relatedShotIds.length === 0} onClick={() => void saveAsset()} className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">{pending === 'asset' ? '正在保存…' : '保存素材'}</button>
            <button type="button" disabled={!selectedAsset || Boolean(pending) || assetDraft.relatedShotIds.length === 0} onClick={() => void saveAsset('derive')} className="rounded-lg border border-[#cfd7e3] bg-white px-3 py-1.5 text-[11px] font-medium text-[#4d5663] disabled:opacity-50">保存为新版本</button>
            {selectedAssetVersion?.status === 'draft' ? (
              <button type="button" disabled={Boolean(pending)} onClick={() => void saveAsset('approve')} className="rounded-lg border border-[#bcd0ff] bg-[#eef4ff] px-3 py-1.5 text-[11px] font-medium text-[#2f6bff] disabled:opacity-50">批准此版本</button>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-[#e2e7ee] bg-white p-3">
          <label className="text-[11px] font-medium text-[#4d5663]" htmlFor={`shot-${taskId}`}>项目分镜</label>
          <select id={`shot-${taskId}`} value={selectedShot?.id || ''} onChange={event => setSelectedShotId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe5ed] bg-white px-2.5 py-2 text-xs text-[#313844]">
            {view.shots.map(shot => <option key={shot.id} value={shot.id}>镜头 {shot.index} · {shot.duration} 秒</option>)}
          </select>
          <textarea value={shotDraft.prompt} onChange={event => setShotDraft(current => ({ ...current, prompt: event.target.value }))} aria-label="分镜提示词" rows={4} className="mt-2 w-full resize-y rounded-lg border border-[#dfe5ed] px-2.5 py-2 text-xs leading-relaxed" />
          <label className="mt-2 flex items-center gap-2 text-[11px] text-[#596270]">时长（秒）<input type="number" min={1} max={30} value={shotDraft.duration} onChange={event => setShotDraft(current => ({ ...current, duration: Number(event.target.value) }))} className="w-20 rounded-lg border border-[#dfe5ed] px-2 py-1.5 text-xs" /></label>
          <button type="button" disabled={!selectedShot || Boolean(pending)} onClick={() => void saveShot()} className="mt-2 rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">{pending === 'shot' ? '正在保存…' : '保存分镜'}</button>
          {shotNotice ? (
            <p
              className="mt-2 rounded-lg border border-[#c9dafd] bg-[#f3f7ff] px-2.5 py-2 text-[11px] leading-relaxed text-[#325da8]"
              data-testid="shot-invalidation-notice"
              role="status"
            >
              {shotNotice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
