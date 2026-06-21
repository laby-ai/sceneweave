"use client";

import { StreamingScriptText } from '@/components/film/streaming-script-text';

export function FilmScriptProgressPanel({
  isGenerating,
  progressMsg,
  streamingScriptText,
}: {
  isGenerating: boolean;
  progressMsg: string;
  streamingScriptText: string;
}) {
  if (!isGenerating || (!progressMsg && !streamingScriptText)) {
    return null;
  }

  const progressMatch = progressMsg.match(/(\d+)%/);
  const progressWidth = progressMatch ? `${progressMatch[1]}%` : '30%';

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      {progressMsg && (
        <div className="px-4 py-2.5 border-b border-primary/10">
          <div className="text-[11px] text-primary/90 font-medium flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {progressMsg}
          </div>
          <div className="w-full h-1.5 bg-accent/30 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-gradient-to-r from-[#EF4444] to-rose-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: progressWidth }}
            />
          </div>
        </div>
      )}
      {streamingScriptText && (
        <div className="px-4 py-3">
          <div className="text-[10px] text-primary/70 font-medium mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            正在生成剧本...
          </div>
          <div
            ref={(el) => {
              if (el) {
                requestAnimationFrame(() => {
                  el.scrollTop = el.scrollHeight;
                });
              }
            }}
            className="text-xs leading-relaxed max-h-[55vh] overflow-y-auto scroll-smooth pr-1"
          >
            <StreamingScriptText raw={streamingScriptText} />
          </div>
        </div>
      )}
    </div>
  );
}
