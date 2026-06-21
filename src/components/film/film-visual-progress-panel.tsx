"use client";

import { Sparkles } from 'lucide-react';

export type FilmVisualGenerationStage = 'idle' | 'character' | 'scene' | 'prop' | 'shot' | 'hybrid_frames' | 'hybrid_videos' | 'done';

type VisualAiStatus = {
  text: string;
  type: 'thinking' | 'responding' | 'done' | 'error';
};

type GenerationProgress = {
  completed: number;
  total: number;
  currentName: string;
};

type FilmVisualProgressPanelProps = {
  middleAiStatus: VisualAiStatus | null;
  generationStage: FilmVisualGenerationStage;
  generationProgress: GenerationProgress;
  isGenerating: boolean;
  progressMsg: string;
  onClearMiddleAiStatus: () => void;
};

const STAGE_ORDER: Exclude<FilmVisualGenerationStage, 'idle' | 'hybrid_frames' | 'hybrid_videos' | 'done'>[] = ['character', 'scene', 'prop', 'shot'];

const STAGE_LABELS: Record<Exclude<FilmVisualGenerationStage, 'idle'>, string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
  shot: '分镜',
  hybrid_frames: '首尾帧',
  hybrid_videos: '视频',
  done: '完成',
};

const STAGE_ICONS: Record<(typeof STAGE_ORDER)[number], string> = {
  character: '👤',
  scene: '🏞️',
  prop: '📦',
  shot: '🎬',
};

export function FilmVisualProgressPanel({
  middleAiStatus,
  generationStage,
  generationProgress,
  isGenerating,
  progressMsg,
  onClearMiddleAiStatus,
}: FilmVisualProgressPanelProps) {
  const progressPercent = generationProgress.total > 0
    ? `${Math.round((generationProgress.completed / generationProgress.total) * 100)}%`
    : '0%';
  const progressBackground = generationStage === 'done'
    ? 'linear-gradient(to right, #10b981, #34d399)'
    : 'linear-gradient(to right, #EF4444, #fb7185)';

  return (
    <>
      {middleAiStatus && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm whitespace-pre-wrap leading-relaxed ${middleAiStatus.type === 'error' ? 'text-destructive' : middleAiStatus.type === 'done' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>{middleAiStatus.text}</p>
          </div>
          <button onClick={onClearMiddleAiStatus} className="text-xs text-muted-foreground hover:text-red-400 flex-shrink-0">✕</button>
        </div>
      )}

      {generationStage !== 'idle' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          <div className="flex items-center border-b border-primary/10">
            {STAGE_ORDER.map((stg, idx) => {
              const isActive = generationStage === stg;
              const isDone = (generationStage === 'done') || (idx < STAGE_ORDER.indexOf(generationStage as (typeof STAGE_ORDER)[number]));
              return (
                <div key={stg} className={`flex-1 px-3 py-2 text-center transition-all ${isActive ? 'bg-primary/10' : isDone ? 'bg-emerald-500/5' : ''}`}>
                  <div className={`text-[10px] font-medium flex items-center justify-center gap-1 ${isActive ? 'text-primary' : isDone ? 'text-emerald-500' : 'text-foreground/30'}`}>
                    {isDone && !isActive ? '✓' : STAGE_ICONS[stg]} {STAGE_LABELS[stg]}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] text-primary/90 font-medium flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {generationStage === 'done'
                  ? '全部素材生成完成！'
                  : `正在生成${generationProgress.currentName || STAGE_LABELS[generationStage as Exclude<FilmVisualGenerationStage, 'idle'>]}...`
                }
              </div>
              <span className="text-[10px] text-foreground/50 font-mono">
                {generationProgress.completed}/{generationProgress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-accent/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: progressPercent, background: progressBackground }}
              />
            </div>
          </div>
        </div>
      )}

      {generationStage === 'idle' && isGenerating && progressMsg && (
        <div className="rounded-lg border border-[#ff333f]/20 bg-[#ff333f]/5 px-4 py-2.5">
          <div className="text-xs text-[#ff333f]/90 font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff333f] animate-pulse" />
            {progressMsg}
          </div>
        </div>
      )}
    </>
  );
}
