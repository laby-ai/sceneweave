'use client';

import { ArrowLeft, Plus } from 'lucide-react';

interface VimaxProjectBarProps {
  title: string;
  onBack: () => void;
  onNewProject: () => void;
}

export function VimaxProjectBar({ title, onBack, onNewProject }: VimaxProjectBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#e8ebf0] bg-white/90 px-6 py-3.5 text-[#181a20] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回项目"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e4e7ec] bg-white text-[#4d5560] transition hover:border-[#ccd5e2] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#20232a]">{title}</div>
            <div className="mt-0.5 text-xs text-[#9298a3]">Vimax 对话式创作</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onNewProject}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#e1e5eb] bg-white px-3.5 py-2 text-sm font-medium text-[#303640] transition hover:border-[#cbd5e4] hover:bg-[#f8faff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
        >
          <Plus className="h-4 w-4" />
          新建项目
        </button>
      </div>
    </header>
  );
}
