'use client';

import { useEffect, useRef, useState } from 'react';

import { buildVimaxProductionGovernanceView } from '@/lib/skills/vimax-short-drama/vimax-production-governance';
import { parseVimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

const stageLabels: Record<VimaxProductionPlan['providerRoutes'][number]['stage'], string> = {
  plan: '策划',
  reference_assets: '参考素材',
  video: '视频成片',
};

export function VimaxProductionPlanCard({ plan, taskId, requestHeaders, onPlanChange }: {
  plan: VimaxProductionPlan;
  taskId?: string;
  requestHeaders?: Record<string, string>;
  onPlanChange?: (plan: VimaxProductionPlan) => void;
}) {
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const onPlanChangeRef = useRef(onPlanChange);

  useEffect(() => {
    onPlanChangeRef.current = onPlanChange;
  }, [onPlanChange]);

  useEffect(() => {
    setCurrentPlan(plan);
  }, [plan]);

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    void fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { headers: requestHeaders })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const recovered = parseVimaxProductionPlan(data?.task?.result?.productionPlan);
        if (active && recovered) {
          setCurrentPlan(recovered);
          onPlanChangeRef.current?.(recovered);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [requestHeaders, taskId]);

  const governance = buildVimaxProductionGovernanceView(currentPlan);
  const videoReady = currentPlan.providerRoutes.find(route => route.stage === 'video')?.ready === true;
  const completed = currentPlan.checkpoints.filter(checkpoint => checkpoint.status === 'completed').length;

  async function approvePlan() {
    if (!taskId || !governance.canApprove || approving) return;
    setApproving(true);
    setApprovalError('');
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders },
        body: JSON.stringify({ action: 'approve-production-plan' }),
      });
      const data = await response.json().catch(() => ({}));
      const approved = parseVimaxProductionPlan(data.productionPlan);
      if (!response.ok || !approved) throw new Error(data.error || '制作计划确认失败');
      setCurrentPlan(approved);
      onPlanChangeRef.current?.(approved);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : '制作计划确认失败');
    } finally {
      setApproving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-[#f8fafc] p-3" data-testid="creation-production-plan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#313844]">制作计划</p>
          <p className="mt-0.5 text-[11px] text-[#7c8592]">
            {currentPlan.preferences.ratio} · {currentPlan.preferences.resolution} · 素材 {currentPlan.materials.length} 项
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
          {governance.state === 'plan-approved' ? '计划已确认' : '计划待确认'}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {currentPlan.providerRoutes.map(route => (
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

      <div className="mt-3 border-t border-[#e2e7ee] pt-2.5">
        <p className="text-[11px] font-semibold text-[#4d5663]">本次创作流程</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {currentPlan.workflow.executionStages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true" className="text-[10px] text-[#b6bdc7]">→</span> : null}
              <span className="rounded-full border border-[#dfe5ed] bg-white px-2.5 py-1 text-[10px] font-medium text-[#596270]">
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#7c8592]">
        <span>{completed}/{currentPlan.checkpoints.length} 阶段完成</span>
        <span>·</span>
        <span>{videoReady ? '渲染路线已锁定' : '渲染将在服务就绪后开放'}</span>
        <span>·</span>
        <span>不允许静默更换模型</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e2e7ee] bg-white px-3 py-2.5">
        <div>
          <p className="text-[11px] font-medium text-[#4d5663]">{governance.label}</p>
          <p className="mt-0.5 text-[10px] text-[#858e9a]">{governance.description}</p>
          {approvalError ? <p className="mt-1 text-[10px] text-red-600">{approvalError}</p> : null}
        </div>
        {governance.canApprove ? (
          <button
            type="button"
            disabled={!taskId || approving}
            onClick={() => void approvePlan()}
            className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#245de3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approving ? '正在保存…' : '确认制作计划'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
