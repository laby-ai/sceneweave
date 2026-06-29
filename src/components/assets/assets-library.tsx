'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Download, GitBranch, Layers, Search, Square, Trash2, Users, Video as VideoIcon } from 'lucide-react';

import { useVideoHistory } from '@/hooks/useVideoHistory';

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

  useEffect(() => {
    let cancelled = false;

    async function loadHistoricalAssets() {
      try {
        const response = await fetch('/api/assets/media-library?limit=80');
        const payload = await response.json();
        if (!response.ok || payload?.success !== true) {
          throw new Error(payload?.message || `历史素材索引加载失败：${response.status}`);
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
                      <button
                        key={asset.id}
                        onClick={() => selectMode ? toggleSelect(asset.id) : window.open(asset.url, '_blank')}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
                      >
                        {asset.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.url} alt={asset.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <video
                            src={videoPreviewUrl(asset.url)}
                            poster={asset.poster}
                            muted
                            playsInline
                            preload="metadata"
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
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2.5 pb-2.5 pt-8 text-left text-[11px] font-medium leading-tight text-white opacity-95">
                          <span className="line-clamp-2">{asset.title}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'subjects' && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">暂无主体。在「生成」里创建角色 / 场景后，会自动沉淀为可复用主体。</p>
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
