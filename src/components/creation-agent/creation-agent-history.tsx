import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';
import { FileClock, Plus } from 'lucide-react';

interface CreationAgentHistoryProps {
  state: CreationAgentState;
  onNew: () => void;
}

export function CreationAgentHistory({ state, onNew }: CreationAgentHistoryProps) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-slate-200/80 bg-white/76 p-4 backdrop-blur-xl lg:border-b-0 lg:border-r">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">科教创作</p>
        <h1 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900">创作工作台</h1>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 motion-reduce:transform-none"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        新建创作
      </button>
      <div className="mt-6 min-h-0 flex-1">
        <div className="flex items-center gap-2 text-slate-400"><FileClock className="h-3.5 w-3.5" aria-hidden="true" /><p className="text-xs font-semibold">最近创作</p></div>
        {state.prompt ? (
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 shadow-sm">
            <p className="line-clamp-2 text-sm font-medium text-slate-700">{state.prompt}</p>
            <p className="mt-2 text-xs text-slate-500">{state.stage || '草稿'}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3"><p className="text-xs leading-5 text-slate-500">本次浏览器会话还没有创作记录。</p></div>
        )}
      </div>
      <p className="mt-6 rounded-lg bg-slate-100/80 px-3 py-2 text-[11px] leading-5 text-slate-500">任务与结果按当前账户或访客会话隔离。</p>
    </aside>
  );
}
