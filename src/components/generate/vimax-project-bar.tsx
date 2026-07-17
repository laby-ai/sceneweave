'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Pencil, Plus, X } from 'lucide-react';

interface VimaxProjectBarProps {
  title: string;
  onBack: () => void;
  onNewProject: () => void;
  onRenameProject: (title: string) => void;
}

export function VimaxProjectBar({ title, onBack, onNewProject, onRenameProject }: VimaxProjectBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [editing, title]);

  const commitRename = () => {
    const nextTitle = draft.trim();
    if (!nextTitle) return;
    onRenameProject(nextTitle);
    setEditing(false);
  };

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
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') commitRename();
                    if (event.key === 'Escape') setEditing(false);
                  }}
                  aria-label="项目名称"
                  maxLength={60}
                  className="min-w-0 rounded-lg border border-[#b8cbff] bg-white px-2 py-1 text-sm font-semibold text-[#20232a] outline-none ring-2 ring-[#2f6bff]/10"
                />
                <button type="button" onClick={commitRename} aria-label="保存项目名称" className="rounded-lg p-1.5 text-[#2f6bff] hover:bg-[#edf3ff]">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setEditing(false)} aria-label="取消重命名" className="rounded-lg p-1.5 text-[#7c8490] hover:bg-[#f3f5f8]">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="truncate text-sm font-semibold text-[#20232a]">{title}</div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="重命名项目"
                  className="shrink-0 rounded-md p-1 text-[#9298a3] transition hover:bg-[#f1f4f8] hover:text-[#2f6bff]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
