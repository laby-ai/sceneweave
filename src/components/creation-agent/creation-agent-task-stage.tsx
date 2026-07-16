import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';
import { BookOpenText, Clapperboard, Presentation, Sparkles } from 'lucide-react';

interface CreationAgentTaskStageProps {
  state: CreationAgentState;
  notice: string;
  onCancel: () => void;
  onRetry: () => void;
}

const QUICK_STARTS = [
  { title: '核心概念', description: '把复杂知识拆成清晰的教学主线', icon: BookOpenText },
  { title: '课程分镜', description: '按镜头组织讲解、示意与字幕', icon: Clapperboard },
  { title: '课堂演示', description: '设计适合课堂播放的视觉节奏', icon: Presentation },
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
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />科教创作 Agent</div>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">把教学灵感变成可执行分镜</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">从主题、脚本或参考资料出发，先生成不消耗模型额度的制作方案，再进入可控的成片流程。</p>
        <div className="mt-7 grid w-full gap-3 sm:grid-cols-3">
          {QUICK_STARTS.map(({ title, description, icon: Icon }) => (
            <div key={title} className="group rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_10px_32px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_16px_38px_rgba(37,99,235,0.10)] motion-reduce:transform-none">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white"><Icon className="h-4 w-4" aria-hidden="true" /></span>
              <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const active = state.status === 'submitting' || state.status === 'running' || state.status === 'reconnecting';
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{state.stage || '创作任务'}</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">{state.prompt}</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">{STATUS_LABELS[state.status]}</span>
        </div>
        {active ? (
          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${state.progress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{state.message || '正在准备制作结构'}</span>
              <span>{state.progress}%</span>
            </div>
            <button type="button" onClick={onCancel} className="mt-5 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">取消任务</button>
          </div>
        ) : null}
        {state.status === 'completed' ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-800">制作方案已生成</p>
            <p className="mt-2 text-sm text-emerald-700">{state.result?.title || '未命名项目'} · {state.result?.shotCount || 0} 个镜头</p>
          </div>
        ) : null}
        {state.status === 'failed' || state.status === 'cancelled' ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm leading-6 text-amber-800">{notice || state.error || state.message}</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100">重试当前创作</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
