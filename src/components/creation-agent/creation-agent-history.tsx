import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';

interface CreationAgentHistoryProps {
  state: CreationAgentState;
  onNew: () => void;
}

export function CreationAgentHistory({ state, onNew }: CreationAgentHistoryProps) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-white/10 bg-black/20 p-4 lg:border-b-0 lg:border-r">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/80">科教创作</p>
        <h1 className="mt-2 text-lg font-semibold text-white">创作工作台</h1>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-left text-sm font-medium text-cyan-50 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
      >
        ＋ 新建创作
      </button>
      <div className="mt-6 min-h-0 flex-1">
        <p className="text-xs font-medium text-slate-400">最近创作</p>
        {state.prompt ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="line-clamp-2 text-sm text-slate-200">{state.prompt}</p>
            <p className="mt-2 text-xs text-slate-500">{state.stage || '草稿'}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">本次浏览器会话还没有创作记录。</p>
        )}
      </div>
      <p className="mt-6 text-xs leading-5 text-slate-500">任务与结果按当前账户或访客会话隔离。</p>
    </aside>
  );
}
