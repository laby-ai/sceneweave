import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';
import { FileClock, Plus, Sparkles } from 'lucide-react';

interface CreationAgentHistoryProps {
  state: CreationAgentState;
  onNew: () => void;
}

export function CreationAgentHistory({ state, onNew }: CreationAgentHistoryProps) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-white/90 bg-white/68 p-4 shadow-[12px_0_40px_rgba(37,99,235,0.04)] backdrop-blur-2xl lg:border-b-0 lg:border-r">
      <div className="mb-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />科教创作</p>
        <h1 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900">创作工作台</h1>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.20)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(79,70,229,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 motion-reduce:transform-none motion-reduce:transition-none"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        新建创作
      </button>
      <div className="mt-6 min-h-0 flex-1">
        <div className="flex items-center gap-2 text-slate-400"><FileClock className="h-3.5 w-3.5" aria-hidden="true" /><p className="text-xs font-semibold">最近创作</p></div>
        {state.prompt ? (
          <div className="relative mt-3 overflow-hidden rounded-[16px] border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-white to-violet-50/70 p-3 shadow-[0_10px_28px_rgba(37,99,235,0.08)]">
            <span aria-hidden="true" className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-violet-500" />
            <p className="line-clamp-2 text-sm font-medium text-slate-700">{state.prompt}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{state.stage || '草稿'}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-dashed border-blue-200/70 bg-gradient-to-br from-blue-50/60 to-violet-50/40 p-3"><p className="text-xs leading-5 text-slate-500">本次浏览器会话还没有创作记录。</p></div>
        )}
      </div>
      <p className="mt-6 rounded-xl border border-white/80 bg-white/72 px-3 py-2 text-[11px] leading-5 text-slate-500 shadow-sm">任务与结果按当前账户或访客会话隔离。</p>
    </aside>
  );
}
