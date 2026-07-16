import Image from 'next/image';

import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';
import { BookOpenText, Clapperboard, Presentation, Sparkles } from 'lucide-react';

interface CreationAgentTaskStageProps {
  state: CreationAgentState;
  notice: string;
  onCancel: () => void;
  onRetry: () => void;
}

const QUICK_STARTS = [
  { title: '核心概念', description: '把复杂知识拆成清晰的教学主线', icon: BookOpenText, tone: 'from-blue-500 to-cyan-400', iconTone: 'bg-blue-50 text-blue-600' },
  { title: '课程分镜', description: '按镜头组织讲解、示意与字幕', icon: Clapperboard, tone: 'from-violet-500 to-blue-500', iconTone: 'bg-violet-50 text-violet-600' },
  { title: '课堂演示', description: '设计适合课堂播放的视觉节奏', icon: Presentation, tone: 'from-cyan-400 to-emerald-400', iconTone: 'bg-cyan-50 text-cyan-700' },
];

const PRODUCTION_PATH = ['灵感输入', '制作规划', '分镜交付'];

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
      <div className="relative isolate mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center overflow-hidden px-5 py-8 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-2 h-[320px] overflow-hidden rounded-[48px] opacity-[0.11] [mask-image:linear-gradient(to_bottom,black_10%,transparent_92%)]">
          <Image src="/home/huiying-workflow-canvas.png" alt="" fill sizes="(min-width: 1024px) 760px, 90vw" className="object-cover object-center saturate-150 mix-blend-multiply" />
        </div>
        <div className="relative z-10 w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/82 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-[0_8px_28px_rgba(37,99,235,0.10)] backdrop-blur-xl"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />科教创作 Agent</div>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[2.55rem] sm:leading-[1.12]">把教学灵感变成可执行分镜</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">从主题、脚本或参考资料出发，先生成不消耗模型额度的制作方案，再进入可控的成片流程。</p>
          <div aria-label="制作路径" className="mx-auto mt-5 flex max-w-xl items-center justify-center">
            {PRODUCTION_PATH.map((label, index) => (
              <div key={label} className="flex min-w-0 flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2 rounded-full border border-white/90 bg-white/78 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-violet-500 text-[10px] text-white shadow-[0_4px_12px_rgba(79,70,229,0.24)]">{index + 1}</span>
                  <span>{label}</span>
                </div>
                {index < PRODUCTION_PATH.length - 1 ? <span aria-hidden="true" className="mx-2 h-px flex-1 bg-gradient-to-r from-blue-300 via-violet-300 to-cyan-300" /> : null}
              </div>
            ))}
          </div>
          <div className="mt-5 grid w-full gap-3 sm:grid-cols-3">
            {QUICK_STARTS.map(({ title, description, icon: Icon, tone, iconTone }) => (
              <div key={title} className="group relative overflow-hidden rounded-[22px] border border-white/90 bg-white/82 p-4 text-left shadow-[0_14px_42px_rgba(37,99,235,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_22px_50px_rgba(79,70,229,0.14)] motion-reduce:transform-none motion-reduce:transition-none">
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${tone}`} />
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconTone} transition duration-300 group-hover:scale-105 motion-reduce:transform-none`}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                <p className="mt-3.5 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
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
