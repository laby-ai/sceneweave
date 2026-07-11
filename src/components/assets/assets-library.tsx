'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Download, GitBranch, Layers, Loader2, Search, Square, Trash2, UserPlus, Users, Video as VideoIcon, X } from 'lucide-react';

import { useVideoHistory } from '@/hooks/useVideoHistory';
import { clientApiFetch } from '@/lib/client-api';

type AssetKind = 'image' | 'video';
type AssetTab = 'history' | 'subjects' | 'canvas';
type TypeFilter = 'all' | 'image' | 'video' | 'audio' | 'doc';

interface UnifiedAsset {
  id: string;
  kind: AssetKind;
  url: string;
  poster?: string;
  title: string;
  createdAt: number;
  taskId?: string;
  source: 'history' | 'production' | 'historical';
}

interface ProductionAsset {
  id: string;
  title?: string;
  projectTitle?: string;
  videoUrl?: string;
  posterUrl?: string;
  taskId?: string;
  durationLabel?: string;
  createdAt?: number;
}

interface AssetsLibraryProps {
  finalVideoCaseAssets?: ProductionAsset[];
  segmentCaseAssets?: ProductionAsset[];
}

interface MediaLibraryResponse {
  success?: boolean;
  message?: string;
  assets?: UnifiedAsset[];
}

type SubjectType = 'character' | 'scene' | 'object';
type SubjectItem = {
  id: string;
  name: string;
  type: SubjectType;
  source: 'generated' | 'uploaded';
  createdAt: string;
  imageUrl: string;
};

interface SubjectResponse {
  success?: boolean;
  subjects?: SubjectItem[];
  subject?: SubjectItem;
}

const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  character: '角色',
  scene: '场景',
  object: '物件',
};

const TYPE_FILTERS: Array<{ id: TypeFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
  { id: 'doc', label: '文档' },
];

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return '今天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function videoPreviewUrl(url: string): string {
  return url.includes('#') ? url : `${url}#t=0.12`;
}

export function AssetsLibrary({ finalVideoCaseAssets = [], segmentCaseAssets = [] }: AssetsLibraryProps) {
  const router = useRouter();
  const { videoHistory, imageHistory, deleteVideoHistory, deleteImageHistory } = useVideoHistory();

  const [tab, setTab] = useState<AssetTab>('history');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [historicalAssets, setHistoricalAssets] = useState<UnifiedAsset[]>([]);
  const [historicalAssetError, setHistoricalAssetError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState<{ asset: UnifiedAsset; name: string; type: SubjectType } | null>(null);
  const [subjectSaving, setSubjectSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistoricalAssets() {
      try {
        const payload = await clientApiFetch<MediaLibraryResponse>('/api/assets/media-library?limit=80');
        if (payload.success !== true) {
          throw new Error(payload.message || '历史素材索引加载失败');
        }
        if (!cancelled) {
          setHistoricalAssets(Array.isArray(payload.assets) ? payload.assets : []);
          setHistoricalAssetError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setHistoricalAssets([]);
          setHistoricalAssetError(error instanceof Error ? error.message : '历史素材索引加载失败');
        }
      }
    }

    loadHistoricalAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSubjects = async () => {
    setSubjectsLoading(true);
    try {
      const payload = await clientApiFetch<SubjectResponse>('/api/subjects');
      setSubjects(payload.subjects || []);
      setSubjectError(null);
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体库加载失败');
    } finally {
      setSubjectsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'subjects') void loadSubjects();
  }, [tab]);

  const saveSubject = async () => {
    if (!subjectDraft || !subjectDraft.name.trim()) return;
    setSubjectSaving(true);
    try {
      const payload = await clientApiFetch<SubjectResponse>('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({
          name: subjectDraft.name.trim(),
          type: subjectDraft.type,
          referenceUrl: subjectDraft.asset.url,
          source: 'generated',
        }),
        timeoutMs: 25_000,
      });
      if (!payload.subject) throw new Error('主体保存失败');
      setSubjects(current => [payload.subject!, ...current.filter(item => item.id !== payload.subject!.id)]);
      setSubjectDraft(null);
      setSubjectError(null);
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体保存失败');
    } finally {
      setSubjectSaving(false);
    }
  };

  const removeSubject = async (id: string) => {
    try {
      await clientApiFetch(`/api/subjects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSubjects(current => current.filter(item => item.id !== id));
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体删除失败');
    }
  };

  const assets = useMemo<UnifiedAsset[]>(() => {
    const list: UnifiedAsset[] = [];
    historicalAssets.forEach(item => {
      list.push(item);
    });
    imageHistory.forEach(item => {
      if (item.imageUrls?.[0]) {
        list.push({ id: `img-${item.id}`, kind: 'image', url: item.imageUrls[0], title: item.prompt || '图片', createdAt: item.createdAt, source: 'history' });
      }
    });
    videoHistory.forEach(item => {
      if (item.videoUrl) {
        list.push({ id: `vid-${item.id}`, kind: 'video', url: item.videoUrl, title: item.prompt || '视频', createdAt: item.createdAt, source: 'history' });
      }
    });
    [...finalVideoCaseAssets, ...segmentCaseAssets].forEach(item => {
      if (item.videoUrl) {
        list.push({ id: `prod-${item.id}`, kind: 'video', url: item.videoUrl, poster: item.posterUrl, title: item.title || item.projectTitle || '成片', createdAt: item.createdAt || 0, taskId: item.taskId, source: 'production' });
      }
    });
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [historicalAssets, imageHistory, videoHistory, finalVideoCaseAssets, segmentCaseAssets]);

  const filtered = useMemo(() => {
    return assets.filter(asset => {
      if (typeFilter === 'image' && asset.kind !== 'image') return false;
      if (typeFilter === 'video' && asset.kind !== 'video') return false;
      if (typeFilter === 'audio' || typeFilter === 'doc') return false;
      if (search && !asset.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assets, typeFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedAsset[]>();
    filtered.forEach(asset => {
      const key = asset.createdAt ? dayLabel(asset.createdAt) : '更早';
      const arr = map.get(key) || [];
      arr.push(asset);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    selected.forEach(id => {
      if (id.startsWith('img-')) deleteImageHistory(id.slice(4));
      else if (id.startsWith('vid-')) deleteVideoHistory(id.slice(4));
    });
    setSelected(new Set());
    setSelectMode(false);
  };

  const syncToCutDraft = () => {
    const target = assets.find(asset => selected.has(asset.id) && asset.taskId) || assets.find(asset => asset.taskId);
    if (target?.taskId) {
      window.open(`/api/production/export?taskId=${encodeURIComponent(target.taskId)}&format=cut-draft-json`, '_blank');
    }
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center gap-6 border-b border-border/60 px-6 pt-5">
        {([['history', '生成历史'], ['subjects', '主体'], ['canvas', '画布']] as Array<[AssetTab, string]>).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative pb-3 text-sm font-medium transition-colors ${tab === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {label}
            {tab === id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#4F6CFF]" />}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <>
          <div className="flex flex-wrap items-center gap-2 px-6 py-4">
            {TYPE_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setTypeFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${typeFilter === filter.id ? 'bg-[#4F6CFF]/15 text-[#70E0FF]' : 'text-muted-foreground hover:bg-accent/60'}`}
              >
                {filter.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="搜索"
                  className="w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => { setSelectMode(value => !value); setSelected(new Set()); }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${selectMode ? 'border-[#4F6CFF]/40 bg-[#4F6CFF]/15 text-[#70E0FF]' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                批量操作
              </button>
              <button
                onClick={syncToCutDraft}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" /> 同步到剪映
              </button>
            </div>
          </div>

          {selectMode && selected.size > 0 && (
            <div className="mx-6 mb-2 flex items-center gap-3 rounded-lg bg-accent/50 px-3 py-2 text-xs">
              <span>已选 {selected.size} 项</span>
              <button onClick={deleteSelected} className="flex items-center gap-1 text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </button>
            </div>
          )}

          {historicalAssetError && (
            <div className="mx-6 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {historicalAssetError}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
            {grouped.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无生成资产，去「生成」创作后会自动归档到这里。</div>
            ) : (
              grouped.map(([label, items]) => (
                <section key={label} className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold">{label}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {items.map(asset => (
                      <div
                        key={asset.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
                      >
                        <button
                          type="button"
                          aria-label={`打开${asset.title}`}
                          onClick={() => selectMode ? toggleSelect(asset.id) : window.open(asset.url, '_blank')}
                          className="absolute inset-0 z-0"
                        />
                        {asset.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.poster || asset.url} alt={asset.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <video
                            src={videoPreviewUrl(asset.url)}
                            poster={asset.poster}
                            muted
                            playsInline
                            preload="none"
                            className="h-full w-full object-cover"
                          />
                        )}
                        {asset.kind === 'video' && (
                          <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                            <VideoIcon className="inline h-3 w-3" />
                          </span>
                        )}
                        {selectMode && (
                          <span className="absolute right-2 top-2 text-white drop-shadow">
                            {selected.has(asset.id) ? <CheckSquare className="h-5 w-5 text-[#70E0FF]" /> : <Square className="h-5 w-5" />}
                          </span>
                        )}
                        {!selectMode && asset.kind === 'image' && (
                          <button
                            type="button"
                            onClick={() => setSubjectDraft({ asset, name: asset.title, type: 'character' })}
                            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white opacity-0 backdrop-blur transition-opacity hover:bg-[#4F6CFF] group-hover:opacity-100 focus:opacity-100"
                            title="保存为主体"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2.5 pb-2.5 pt-8 text-left text-[11px] font-medium leading-tight text-white opacity-95">
                          <span className="line-clamp-2">{asset.title}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'subjects' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {subjectError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{subjectError}</div>}
          {subjectsLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 正在加载主体库</div>
          ) : subjects.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Users className="h-10 w-10 opacity-40" />
              <p className="text-sm">暂无主体。可在生成历史的图片卡片上选择“保存为主体”。</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {subjects.map(subject => (
                <article key={subject.id} className="group overflow-hidden rounded-xl border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={subject.imageUrl} alt={subject.name} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{subject.name}</p>
                      <p className="text-[11px] text-muted-foreground">{SUBJECT_TYPE_LABELS[subject.type]}</p>
                    </div>
                    <button type="button" onClick={() => void removeSubject(subject.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400" title="删除主体">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {subjectDraft && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">保存为主体</h3>
              <button type="button" onClick={() => setSubjectDraft(null)} className="rounded-md p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-3 block text-xs text-muted-foreground">名称
              <input value={subjectDraft.name} onChange={event => setSubjectDraft(current => current ? { ...current, name: event.target.value } : null)} maxLength={80} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#4F6CFF]" />
            </label>
            <div className="mb-4">
              <p className="mb-1.5 text-xs text-muted-foreground">类型</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SUBJECT_TYPE_LABELS) as SubjectType[]).map(type => <button key={type} type="button" onClick={() => setSubjectDraft(current => current ? { ...current, type } : null)} className={`rounded-lg border px-2 py-2 text-xs ${subjectDraft.type === type ? 'border-[#4F6CFF] bg-[#4F6CFF]/15 text-[#70E0FF]' : 'border-border text-muted-foreground'}`}>{SUBJECT_TYPE_LABELS[type]}</button>)}
              </div>
            </div>
            <button type="button" onClick={() => void saveSubject()} disabled={subjectSaving || !subjectDraft.name.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F6CFF] px-3 py-2 text-sm text-white disabled:opacity-40">
              {subjectSaving && <Loader2 className="h-4 w-4 animate-spin" />} 保存主体
            </button>
          </div>
        </div>
      )}

      {tab === 'canvas' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <button
            onClick={() => router.push('/canvas')}
            className="mb-4 flex items-center gap-2 rounded-xl border border-[#4F6CFF]/30 bg-[#4F6CFF]/10 px-4 py-2.5 text-sm text-[#70E0FF] hover:bg-[#4F6CFF]/15"
          >
            <GitBranch className="h-4 w-4" /> 进入无限画布
          </button>
          {finalVideoCaseAssets.filter(asset => asset.taskId).length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Layers className="h-4 w-4 opacity-40" /> 暂无画布工程。</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {finalVideoCaseAssets.filter(asset => asset.taskId).map(asset => (
                <button
                  key={asset.id}
                  onClick={() => router.push(`/canvas?taskId=${encodeURIComponent(asset.taskId!)}`)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm hover:border-[#4F6CFF]/40"
                >
                  <GitBranch className="h-4 w-4 text-[#70E0FF]" />
                  <span className="truncate">{asset.title || asset.projectTitle || '画布工程'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
