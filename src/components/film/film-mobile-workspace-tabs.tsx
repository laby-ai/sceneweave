"use client";

import { Clapperboard, ListTree, ScrollText } from 'lucide-react';

export type FilmMobileWorkspaceView = 'workflow' | 'workspace' | 'log';

type FilmMobileWorkspaceTabsProps = {
  activeView: FilmMobileWorkspaceView;
  onViewChange: (view: FilmMobileWorkspaceView) => void;
};

const MOBILE_VIEWS = [
  { key: 'workflow', label: '流程', icon: ListTree },
  { key: 'workspace', label: '工作区', icon: Clapperboard },
  { key: 'log', label: '日志', icon: ScrollText },
] as const;

export function FilmMobileWorkspaceTabs({ activeView, onViewChange }: FilmMobileWorkspaceTabsProps) {
  const activateView = (view: FilmMobileWorkspaceView) => {
    onViewChange(view);
    document.getElementById(`film-mobile-tab-${view}`)?.focus();
  };

  return (
    <div className="grid grid-cols-3 gap-1 border-b border-border/70 bg-card px-2 py-1.5 md:hidden" role="tablist" aria-label="影视创作工作区">
      {MOBILE_VIEWS.map(({ key, label, icon: Icon }) => {
        const selected = activeView === key;
        return (
          <button
            key={key}
            id={`film-mobile-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`film-mobile-panel-${key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onViewChange(key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateView(key);
                return;
              }
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const index = MOBILE_VIEWS.findIndex(view => view.key === key);
              const offset = event.key === 'ArrowRight' ? 1 : -1;
              const nextIndex = (index + offset + MOBILE_VIEWS.length) % MOBILE_VIEWS.length;
              activateView(MOBILE_VIEWS[nextIndex].key);
            }}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
              selected
                ? 'bg-red-500/10 text-red-500'
                : 'text-foreground/50 hover:bg-accent/40 hover:text-foreground/80'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
