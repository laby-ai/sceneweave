import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

const stageLabels: Record<VimaxProductionPlan['providerRoutes'][number]['stage'], string> = {
  plan: '策划',
  reference_assets: '参考素材',
  video: '视频成片',
};

export function VimaxProductionPlanCard({ plan }: { plan: VimaxProductionPlan }) {
  const videoReady = plan.providerRoutes.find(route => route.stage === 'video')?.ready === true;
  const completed = plan.checkpoints.filter(checkpoint => checkpoint.status === 'completed').length;

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-[#f8fafc] p-3" data-testid="creation-production-plan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#313844]">制作计划</p>
          <p className="mt-0.5 text-[11px] text-[#7c8592]">
            {plan.preferences.ratio} · {plan.preferences.resolution} · 素材 {plan.materials.length} 项
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
          费用待确认
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {plan.providerRoutes.map(route => (
          <div key={route.stage} className="rounded-lg border border-[#e2e7ee] bg-white px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-[#4d5663]">{stageLabels[route.stage]}</span>
              <span className={route.ready ? 'text-emerald-600' : 'text-amber-700'}>
                {route.ready ? '已就绪' : route.stage === 'video' ? '视频服务待就绪' : '服务待就绪'}
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] text-[#9199a4]" title={route.model}>{route.model}</p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#7c8592]">
        <span>{completed}/{plan.checkpoints.length} 阶段完成</span>
        <span>·</span>
        <span>{videoReady ? '渲染路线已锁定' : '渲染将在服务就绪后开放'}</span>
        <span>·</span>
        <span>不允许静默更换模型</span>
      </div>
    </section>
  );
}
