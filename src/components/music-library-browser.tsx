'use client';

/**
 * 公开音乐库浏览器组件 v1.0
 *
 * 功能：
 * - 搜索/关键词过滤
 * - 分类标签切换（18种BGM类型）
 * - 情绪标签筛选
 * - 曲目列表展示（名称/艺术家/时长/BPM/情绪）
 * - 实时音频预览播放/暂停
 * - 选中曲目回调
 * - 分页加载
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Search,
  Play,
  Pause,
  Clock,
  Music2,
  X,
  ChevronLeft,
  ChevronRight,
  Library,
  Headphones,
  CheckCircle2,
  Loader2,
  Filter,
} from 'lucide-react';

// BGM类型定义（复用集中定义）
import { getBgmTypeList, type BgmTypeId } from '@/constants/bgm-types';
import type { LibraryTrack, LibrarySearchResult } from '@/constants/music-library';

// ============================================================
// 类型定义
// ============================================================

interface Props {
  /** 是否显示浏览器 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选择曲目回调 */
  onSelectTrack: (track: LibraryTrack) => void;
  /** 当前已选曲目ID（用于高亮） */
  selectedId?: string;
}

// ============================================================
// 辅助函数
// ============================================================

/** 格式化时长 mm:ss */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** 获取分类的图标和颜色 */
function getCategoryStyle(category: string): { icon: string; bgColor: string; textColor: string } {
  const bgmType = getBgmTypeList().find(b => b.id === category);
  if (bgmType) {
    return {
      icon: bgmType.icon,
      bgColor: bgmType.bgColor || 'bg-secondary/20',
      textColor: bgmType.color || 'text-muted-foreground',
    };
  }
  return { icon: '🎵', bgColor: 'bg-secondary/20', textColor: 'text-muted-foreground' };
}

/** 获取授权类型的中文名称 */
function getLicenseLabel(license: string): string {
  const map: Record<string, string> = {
    'royalty-free': '免版权',
    'cc0': 'CC0公有领域',
    'cc-by': 'CC-BY署名',
    'cc-by-sa': 'CC-BY-SA相同方式共享',
  };
  return map[license] || license;
}

// ============================================================
// 主组件
// ============================================================

export default function MusicLibraryBrowser({ open, onClose, onSelectTrack, selectedId }: Props) {
  // 搜索状态
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [mood, setMood] = useState<string>('');
  const [page, setPage] = useState(1);

  // 数据状态
  const [result, setResult] = useState<LibrarySearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 播放状态
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 防抖搜索定时器
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ============================================================
  // 数据加载
  // ============================================================

  const loadTracks = useCallback(async (searchQuery?: string, cat?: string, m?: string, p?: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery !== undefined) params.set('query', searchQuery);
      if (cat && cat !== 'all') params.set('category', cat);
      if (m) params.set('mood', m);
      params.set('page', String(p ?? page));
      params.set('pageSize', '12');

      const res = await fetch(`/api/bgm/library?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setResult(data.data);
      }
    } catch (error) {
      console.error('[MusicLibrary] 加载失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  // 初始加载 + 参数变化时重新加载
  useEffect(() => {
    if (open) {
      loadTracks(query, category, mood, page);
    }
  }, [open, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // 防抖搜索
  const handleSearchChange = (value: string) => {
    setQuery(value);
    setPage(1); // 重置到第一页

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadTracks(value, category, mood, 1);
    }, 400);
  };

  // 分类切换
  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
    loadTracks(query, cat, mood, 1);
  };

  // 情绪筛选
  const handleMoodClick = (m: string) => {
    setMood(mood === m ? '' : m);
    setPage(1);
    loadTracks(query, category, mood === m ? '' : m, 1);
  };

  // ============================================================
  // 音频播放控制
  // ============================================================

  const handlePlayPause = async (track: LibraryTrack, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // 如果正在播放同一首 → 暂停
    if (isPlaying && playingId === track.id) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    // 停止当前播放
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // 播放新曲目
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlayingId(null);
      };
    }

    audioRef.current.src = track.url;
    try {
      await audioRef.current.play();
      setPlayingId(track.id);
      setIsPlaying(true);
    } catch (err) {
      console.error('[MusicLibrary] 播放失败:', err);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingId(null);
  };

  // 关闭时停止播放
  useEffect(() => {
    return () => stopPlayback();
  }, [open]);

  // ============================================================
  // 渲染
  // ============================================================

  if (!open) return null;

  const categories = result?.filters.categories || [];
  const moods = result?.filters.moods || [];
  const tracks = result?.tracks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { stopPlayback(); onClose(); }}
      />

      {/* 主面板 */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* ===== 头部栏 ===== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Library className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">公开音乐库</h2>
              <p className="text-xs text-muted-foreground">免费免版权音乐 · 可商用</p>
            </div>
          </div>
          <button
            onClick={() => { stopPlayback(); onClose(); }}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===== 搜索栏 ===== */}
        <div className="px-5 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索曲目、艺术家、风格..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-border rounded-lg text-sm text-white placeholder:text-foreground/30 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
            {query && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/70 hover:text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ===== 分类标签栏 ===== */}
        <div className="px-5 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {/* 全部 */}
            <button
              onClick={() => handleCategoryChange('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                category === 'all'
                  ? 'bg-red-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-accent/30 text-muted-foreground hover:bg-accent hover:text-foreground/80'
              }`}
            >
              全部
            </button>
            {/* 各分类 */}
            {getBgmTypeList().map((bgm) => (
              <button
                key={bgm.id}
                onClick={() => handleCategoryChange(bgm.id)}
                title={bgm.description}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  category === bgm.id
                    ? `${bgm.bgColor} ${bgm.color} shadow-lg`
                    : 'bg-accent/30 text-muted-foreground hover:bg-accent hover:text-foreground/80'
                }`}
              >
                <span className="text-xs">{bgm.icon}</span>
                <span>{bgm.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== 内容区域（可滚动）===== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 统计信息 */}
          {result && !isLoading && (
            <div className="flex items-center justify-between text-xs text-foreground/70">
              <span>
                共 <span className="text-foreground/70 font-medium">{result.total}</span> 首曲目
                {query && ` · 搜索 "${query}"`}
                {category !== 'all' && ` · ${getBgmTypeList().find(b => b.id === category)?.name || category}`}
              </span>
              <span>{result.page}/{result.totalPages} 页</span>
            </div>
          )}

          {/* 情绪标签筛选 */}
          {moods.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-foreground/30" />
              {moods.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleMoodClick(m.id)}
                  className={`px-2 py-0.5 rounded-full text-[11px] transition-all ${
                    mood === m.id
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-accent/30 text-foreground/70 hover:bg-accent hover:text-muted-foreground border border-transparent'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* 曲目列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-red-400" />
            </div>
          ) : tracks.length > 0 ? (
            <div className="space-y-2">
              {tracks.map((track) => {
                const isSelected = track.id === selectedId;
                const isCurrentPlaying = playingId === track.id;
                const catStyle = getCategoryStyle(track.category);

                return (
                  <div
                    key={track.id}
                    className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-500/15 border-red-500/50 ring-1 ring-purple-500/30'
                        : 'bg-slate-800/50 border-border/50 hover:border-border hover:bg-slate-800'
                    }`}
                    onClick={() => onSelectTrack(track)}
                  >
                    <div className="flex items-start gap-3">
                      {/* 播放按钮 */}
                      <button
                        onClick={(e) => handlePlayPause(track, e)}
                        className={`flex-shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          isCurrentPlaying
                            ? 'bg-red-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-accent/50 text-muted-foreground group-hover:bg-red-500/30 group-hover:text-red-300'
                        }`}
                      >
                        {isCurrentPlaying && isPlaying ? (
                          <Pause className="w-4 h-4" fill="currentColor" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                        )}
                      </button>

                      {/* 曲目信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium truncate ${isSelected ? 'text-red-200' : 'text-white'}`}>
                            {track.title}
                          </h3>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-foreground/70 truncate">{track.artist}</p>

                        {/* 元数据行 */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {/* 分类标签 */}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${catStyle.bgColor} ${catStyle.textColor}`}>
                            <span>{catStyle.icon}</span>
                            {track.category}
                          </span>

                          {/* 时长 */}
                          <span className="inline-flex items-center gap-1 text-[10px] text-foreground/35">
                            <Clock className="w-3 h-3" />
                            {formatDuration(track.duration)}
                          </span>

                          {/* BPM */}
                          {track.bpm > 0 && (
                            <span className="text-[10px] text-foreground/35">{track.bpm} BPM</span>
                          )}

                          {/* 授权类型 */}
                          <span className="text-[10px] text-green-400/60">{getLicenseLabel(track.license)}</span>

                          {/* 情绪标签 */}
                          {track.moods.slice(0, 2).map((m) => (
                            <span key={m} className="text-[10px] text-foreground/30">{m}</span>
                          ))}
                        </div>
                      </div>

                      {/* 右侧操作区 */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/20"
                          onClick={(e) => { e.stopPropagation(); onSelectTrack(track); }}
                        >
                          使用此曲
                        </Button>
                      </div>
                    </div>

                    {/* 描述（展开显示） */}
                    {(isSelected || isCurrentPlaying) && (
                      <p className="mt-2.5 pt-2.5 border-t border-border/50 text-xs text-foreground/30 leading-relaxed">
                        {track.description}
                      </p>
                    )}

                    {/* 来源标注 */}
                    <div className="absolute bottom-2 right-3 text-[9px] text-foreground/15">
                      via {track.source}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Headphones className="w-12 h-12 text-foreground/10 mb-4" />
              <p className="text-foreground/70 text-sm mb-1">未找到匹配的曲目</p>
              <p className="text-foreground/25 text-xs">尝试更换关键词或分类</p>
              {(query || category !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 text-foreground/70 hover:text-muted-foreground"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                    setMood('');
                    setPage(1);
                    loadTracks('', 'all', '', 1);
                  }}
                >
                  清除所有筛选
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ===== 底部分页栏 ===== */}
        {!isLoading && result && result.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-border/50 bg-slate-800/30">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-foreground/70">
              第 {page} / {result.totalPages} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(result.totalPages, p + 1))}
              disabled={page >= result.totalPages}
              className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
