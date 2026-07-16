import type { CreationAgentState } from '@/lib/creation-agent/creation-agent-model';
import { Clapperboard, Image, Plus, ShoppingBag, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

interface CreationAgentTaskStageProps {
  state: CreationAgentState;
  notice: string;
  onCancel: () => void;
  onRetry: () => void;
  onNew?: () => void;
  onQuickStart?: (skill: string, prompt: string) => void;
  composer?: ReactNode;
}

const QUICK_SKILLS = [
  { skill: 'product-visual', title: '商品视觉', prompt: '为一款新品设计主视觉与三组社交媒体素材。', icon: ShoppingBag },
  { skill: 'short-drama', title: '短剧分镜', prompt: '把这个故事改写为三幕短剧，并输出镜头分镜。', icon: Clapperboard },
  { skill: 'agent-creation', title: '广告创意', prompt: '为品牌活动生成一套广告创意、脚本与素材清单。', icon: Sparkles },
  { skill: 'agent-creation', title: '图像创作', prompt: '根据我的想法规划一组统一风格的图像作品。', icon: Image },
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

export function CreationAgentTaskStage({ state, notice, onCancel, onRetry, onNew, onQuickStart, composer }: CreationAgentTaskStageProps) {
  if (state.status === 'idle') {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-10 pt-20 sm:px-8">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[2.35rem]">你好，想创作什么？</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">输入灵感、剧本或参考素材，Agent 会先整理创意与制作计划，再推进后续任务。</p>
        </div>
        {composer ? <div className="mx-auto mt-10 w-full max-w-3xl">{composer}</div> : null}
        <div aria-label="快捷 Skill" className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {QUICK_SKILLS.map(({ skill, title, prompt, icon: Icon }) => (
            <button key={title} type="button" onClick={() => onQuickStart?.(skill, prompt)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transform-none">
              <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {title}
            </button>
          ))}
        </div>
        <section aria-labelledby="recent-projects-title" className="mt-auto pt-16">
          <div className="flex items-center justify-between">
            <h2 id="recent-projects-title" className="text-lg font-semibold text-slate-900">个人最近项目</h2>
            <span className="text-xs text-slate-400">当前浏览器会话</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={onNew} className="group min-h-36 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-left transition hover:border-slate-400 hover:bg-white hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-950 group-hover:text-white"><Plus className="h-4 w-4" aria-hidden="true" /></span>
              <p className="mt-6 text-sm font-semibold text-slate-900">开始创作</p>
              <p className="mt-1 text-xs text-slate-500">创建新的对话式 AIGC 项目</p>
            </button>
            <div className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">智能创作</span>
              <p className="mt-6 line-clamp-2 text-sm font-semibold text-slate-900">{state.prompt || '未命名项目'}</p>
              <p className="mt-1 text-xs text-slate-400">等待你的第一个创意</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const active = state.status === 'submitting' || state.status === 'running' || state.status === 'reconnecting';
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-10">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">{state.stage || '创作任务'}</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">{state.prompt}</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">{STATUS_LABELS[state.status]}</span>
        </div>
        {active ? (
          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${state.progress}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{state.message || '正在准备创作结构'}</span><span>{state.progress}%</span></div>
            <button type="button" onClick={onCancel} className="mt-5 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">取消任务</button>
          </div>
        ) : null}
        {state.status === 'completed' ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-800">制作方案已生成</p><p className="mt-2 text-sm text-emerald-700">{state.result?.title || '未命名项目'} · {state.result?.shotCount || 0} 个镜头</p></div>
            {state.result?.productionPlan ? (
              <div aria-label="无成本制作计划" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">制作计划</p><p className="mt-1 text-sm font-semibold text-slate-900">{state.result.productionPlan.pipeline.label}</p></div>
                  <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">预计成本 ¥{state.result.productionPlan.estimatedCost.amount}</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-700">素材清单</p><p className="mt-1 text-xs leading-5 text-slate-500">{state.result.productionPlan.materials.length} 项 · {state.result.productionPlan.materials.slice(0, 2).map(item => item.name).join('、')}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-700">阶段进度</p><p className="mt-1 text-xs leading-5 text-slate-500">{state.result.productionPlan.stages.filter(stage => stage.status === 'completed').length}/{state.result.productionPlan.stages.length} 已规划</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-700">渲染输出</p><p className="mt-1 text-xs leading-5 text-slate-500">未开始渲染 · 需显式启用付费供应商</p></div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {state.status === 'failed' || state.status === 'cancelled' ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6 text-amber-800">{notice || state.error || state.message}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100">重试当前创作</button></div>
        ) : null}
      </article>
    </div>
  );
}
