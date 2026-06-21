"use client";

import { Film, FileText, LayoutGrid, PenLine } from 'lucide-react';

export type FilmShotViewMode = 'grid' | 'list' | 'keyframe';

const VISUAL_STYLE_OPTIONS = [
  { id: 'cinematic', label: '电影感', emoji: '🎥' },
  { id: 'cartoon', label: '卡通', emoji: '🎨' },
  { id: 'elegant', label: '优雅', emoji: '✨' },
  { id: 'healing', label: '治愈', emoji: '🌿' },
  { id: 'modern', label: '现代简约', emoji: '📐' },
  { id: 'neon', label: '霓虹', emoji: '🌃' },
  { id: 'retro', label: '复古', emoji: '📻' },
  { id: 'ink_wash', label: '水墨', emoji: '🖌️' },
  { id: 'cyberpunk', label: '赛博朋克', emoji: '🤖' },
  { id: 'minimalist', label: '极简黑白', emoji: '⬛' },
];

const SHOT_VIEW_OPTIONS = [
  { mode: 'grid' as const, label: '卡片', icon: LayoutGrid },
  { mode: 'keyframe' as const, label: '关键帧', icon: Film },
  { mode: 'list' as const, label: '列表', icon: FileText },
];

export function FilmVisualStageToolbar({
  filmVisualStyle,
  shotViewMode,
  onFilmVisualStyleChange,
  onShotViewModeChange,
  onOpenPromptManager,
}: {
  filmVisualStyle: string;
  shotViewMode: FilmShotViewMode;
  onFilmVisualStyleChange: (style: string) => void;
  onShotViewModeChange: (mode: FilmShotViewMode) => void;
  onOpenPromptManager: () => void;
}) {
  return (
    <>
      <div className="p-2 rounded-lg bg-accent/20 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-foreground/50">视觉风格</span>
          {filmVisualStyle && (
            <button
              onClick={() => onFilmVisualStyleChange('')}
              className="text-[10px] text-foreground/30 hover:text-primary transition-all"
            >
              清除
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {VISUAL_STYLE_OPTIONS.map(style => (
            <button
              key={style.id}
              onClick={() => onFilmVisualStyleChange(style.label)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                filmVisualStyle === style.label
                  ? 'bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]'
                  : 'bg-accent/30 border-border/50 text-foreground/60 hover:border-[#EF4444]/20 hover:text-foreground/80'
              }`}
            >
              {style.emoji} {style.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/20">
        <span className="text-[10px] text-foreground/40 flex-shrink-0">视图:</span>
        {SHOT_VIEW_OPTIONS.map(({ mode, label, icon: ViewIcon }) => (
          <button
            key={mode}
            onClick={() => onShotViewModeChange(mode)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              shotViewMode === mode ? 'bg-primary text-white' : 'bg-accent/40 text-foreground/50 hover:text-foreground/80'
            }`}
          >
            <ViewIcon className="w-3 h-3" />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onOpenPromptManager}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
        >
          <PenLine className="w-3 h-3" />提示词管理
        </button>
      </div>
    </>
  );
}
