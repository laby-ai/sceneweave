import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';

interface CreationAgentTaskStageProps {
  state: CreationAgentState;
  notice: string;
  onCancel: () => void;
  onRetry: () => void;
}

const QUICK_STARTS = [
  ['核心概念', '把复杂知识拆成清晰的教学主线'],
  ['课程分镜', '按镜头组织讲解、示意与字幕'],
  ['课堂演示', '设计适合课堂播放的视觉节奏'],
];

const STATUS_LABELS: Record<CreationAgentState['status'], string> = {
  idle: '待开始',
  submitting: '正在提交',
  running: '生成中',
  reconnecting: '正在恢复',
  completed: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
};

export function CreationAgentTaskStage({
  state,
  notice,
  onCancel,
  onRetry,
}: CreationAgentTaskStageProps) {
  if (state.status === 'idle') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Creation agent</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">把教学灵感变成可执行分镜</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">从主题、脚本或参考资料出发，先生成不消耗模型额度的制作方案，再进入可控的成片流程。</p>
        <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
          {QUICK_STARTS.map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.055] motion-reduce:transform-none">
              <p className="text-sm font-medium text-slate-100">{title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const active = state.status === 'submitting' || state.status === 'running' || state.status === 'reconnecting';
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/70">{state.stage || '创作任务'}</p>
            <h2 className="mt-3 text-xl font-semibold text-white">{state.prompt}</h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{STATUS_LABELS[state.status]}</span>
        </div>
        {active ? (
          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${state.progress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{state.message || '正在准备制作结构'}</span>
              <span>{state.progress}%</span>
            </div>
            <button type="button" onClick={onCancel} className="mt-5 text-sm text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white">取消任务</button>
          </div>
        ) : null}
        {state.status === 'completed' ? (
          <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
            <p className="font-medium text-emerald-100">制作方案已生成</p>
            <p className="mt-2 text-sm text-emerald-100/70">{state.result?.title || '未命名项目'} · {state.result?.shotCount || 0} 个镜头</p>
          </div>
        ) : null}
        {state.status === 'failed' || state.status === 'cancelled' ? (
          <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm leading-6 text-amber-100">{notice || state.error || state.message}</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-200/10">重试当前创作</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
