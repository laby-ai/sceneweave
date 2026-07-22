'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { clientApiFetch, clientApiRequest } from '@/lib/client-api';
import { buildVimaxProductionGovernanceView } from '@/lib/skills/vimax-short-drama/vimax-production-governance';
import { parseVimaxProductionPlan, skipsVimaxReferenceAssets } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import { normalizeRecoveredVimaxCompletedPlan } from '@/lib/skills/vimax-short-drama/vimax-task-project-recovery';

const stageLabels: Record<VimaxProductionPlan['providerRoutes'][number]['stage'], string> = {
  plan: '策划',
  reference_assets: '参考素材',
  video: '视频成片',
};

interface ExportResponse {
  exportPackage: unknown;
}

export function VimaxProductionPlanCard({ plan, taskId, requestHeaders, onPlanChange, finalVideoReady = false }: {
  plan: VimaxProductionPlan;
  taskId?: string;
  requestHeaders?: Record<string, string>;
  onPlanChange?: (plan: VimaxProductionPlan) => void;
  finalVideoReady?: boolean;
}) {
  const displayPlan = useMemo(
    () => finalVideoReady ? normalizeRecoveredVimaxCompletedPlan(plan) : plan,
    [finalVideoReady, plan],
  );
  const [currentPlan, setCurrentPlan] = useState(displayPlan);
  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState('');
  const onPlanChangeRef = useRef(onPlanChange);

  useEffect(() => {
    onPlanChangeRef.current = onPlanChange;
  }, [onPlanChange]);

  useEffect(() => {
    setCurrentPlan(displayPlan);
  }, [displayPlan]);

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    void clientApiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
      headers: requestHeaders,
      redirectOnUnauthorized: false,
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const parsed = parseVimaxProductionPlan(data?.task?.result?.productionPlan);
        const recovered = parsed && finalVideoReady ? normalizeRecoveredVimaxCompletedPlan(parsed) : parsed;
        if (active && recovered) {
          setCurrentPlan(recovered);
          onPlanChangeRef.current?.(recovered);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [finalVideoReady, requestHeaders, taskId]);

  const governance = buildVimaxProductionGovernanceView(currentPlan);
  const videoReady = currentPlan.providerRoutes.find(route => route.stage === 'video')?.ready === true;
  const completed = currentPlan.checkpoints.filter(checkpoint => checkpoint.status === 'completed').length;
  const referenceSkipped = skipsVimaxReferenceAssets(currentPlan);

  async function updatePlan(action: string, fallbackError: string) {
    if (!taskId || pendingAction) return;
    setPendingAction(action);
    setActionError('');
    try {
      const response = await clientApiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders },
        body: JSON.stringify({ action }),
        redirectOnUnauthorized: false,
      });
      const data = await response.json().catch(() => ({}));
      const updated = parseVimaxProductionPlan(data.productionPlan);
      if (!response.ok || !updated) throw new Error(data.error || fallbackError);
      setCurrentPlan(updated);
      onPlanChangeRef.current?.(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : fallbackError);
    } finally {
      setPendingAction('');
    }
  }

  async function downloadDraft() {
    if (!taskId || pendingAction) return;
    setPendingAction('download-production-draft');
    setActionError('');
    try {
      const exportPath = `/api/production/export?taskId=${encodeURIComponent(taskId)}&format=cut-draft-json`;
      const response = await clientApiFetch<ExportResponse>(exportPath, {
        headers: requestHeaders,
        redirectOnUnauthorized: false,
      });
      const blob = new Blob([JSON.stringify(response.exportPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `creation-cut-draft-${taskId.slice(0, 8)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '制作草稿下载失败');
    } finally {
      setPendingAction('');
    }
  }

  const awaitingCost = governance.state === 'awaiting-cost-decision' || governance.state === 'plan-approved';
  const ready = governance.state === 'ready';
  const paused = governance.state === 'paused';
  const deliveryReady = governance.state === 'delivery-ready';
  const statusLabel = governance.state === 'awaiting-plan-approval'
    ? '计划待确认'
    : awaitingCost
      ? '费用待决定'
      : paused
        ? '流程已暂停'
        : deliveryReady
          ? '草稿可交付'
          : '流程已就绪';

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
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {currentPlan.providerRoutes.map(route => (
          <div key={route.stage} className="rounded-lg border border-[#e2e7ee] bg-white px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-[#4d5663]">{stageLabels[route.stage]}</span>
              <span className={route.ready ? 'text-emerald-600' : 'text-amber-700'}>
                {route.stage === 'reference_assets' && referenceSkipped
                  ? '当前模型无需'
                  : route.ready ? '已就绪' : route.stage === 'video' ? '视频服务待就绪' : '服务待就绪'}
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

      <div className="mt-3 rounded-lg border border-[#e2e7ee] bg-white px-3 py-2.5">
        <p className="text-[11px] font-semibold text-[#4d5663]">费用与执行方式</p>
        <p className="mt-0.5 text-[10px] text-[#858e9a]">
          {currentPlan.estimatedCost.status === 'draft-only-confirmed'
            ? '已选择无成本草稿：不会调用图像或视频模型。'
            : currentPlan.estimatedCost.status === 'confirmed'
              && currentPlan.estimatedCost.billingSource === 'external-byok'
              ? '已确认使用当前账号的百炼配置；真实费用由供应商账单结算。'
            : '真实媒体费用待供应商确认；在获得明确报价前不会调用付费模型。'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e2e7ee] bg-white px-3 py-2.5">
        <div>
          <p className="text-[11px] font-medium text-[#4d5663]">{governance.label}</p>
          <p className="mt-0.5 text-[10px] text-[#858e9a]">{governance.description}</p>
          {actionError ? <p className="mt-1 text-[10px] text-red-600">{actionError}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {governance.canApprove ? (
          <button
            type="button"
            disabled={!taskId || Boolean(pendingAction)}
            onClick={() => void updatePlan('approve-production-plan', '制作计划确认失败')}
            className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#245de3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction === 'approve-production-plan' ? '正在保存…' : '确认制作计划'}
          </button>
        ) : null}
        {awaitingCost ? (
          <>
            {videoReady ? (
              <button
                type="button"
                disabled={!taskId || Boolean(pendingAction)}
                onClick={() => void updatePlan('confirm-production-external', '真实生成确认失败')}
                className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#245de3] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingAction === 'confirm-production-external' ? '正在保存…' : '确认按供应商账单生成'}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!taskId || Boolean(pendingAction)}
              onClick={() => void updatePlan('confirm-production-draft', '执行方式保存失败')}
              className="rounded-lg border border-[#dfe5ed] bg-white px-3 py-1.5 text-[11px] font-medium text-[#4d5663] transition hover:bg-[#f5f7fa] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === 'confirm-production-draft' ? '正在保存…' : '继续无成本草稿'}
            </button>
          </>
        ) : null}
        {ready ? (
          <>
            <button
              type="button"
              disabled={!taskId || Boolean(pendingAction)}
              onClick={() => void updatePlan('pause-production', '暂停流程失败')}
              className="rounded-lg border border-[#dfe5ed] bg-white px-3 py-1.5 text-[11px] font-medium text-[#4d5663] transition hover:bg-[#f5f7fa] disabled:opacity-50"
            >暂停流程</button>
            {governance.mode === 'draft' ? (
              <button
                type="button"
                disabled={!taskId || Boolean(pendingAction)}
                onClick={() => void updatePlan('prepare-production-draft', '准备交付草稿失败')}
                className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#245de3] disabled:opacity-50"
              >准备交付草稿</button>
            ) : null}
          </>
        ) : null}
        {paused ? (
          <button
            type="button"
            disabled={!taskId || Boolean(pendingAction)}
            onClick={() => void updatePlan('resume-production', '继续流程失败')}
            className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#245de3] disabled:opacity-50"
          >继续流程</button>
        ) : null}
        {deliveryReady && taskId ? (
          <button
            type="button"
            disabled={Boolean(pendingAction)}
            onClick={() => void downloadDraft()}
            className="rounded-lg bg-[#2f6bff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#245de3]"
          >{pendingAction === 'download-production-draft' ? '正在下载…' : '下载制作草稿'}</button>
        ) : null}
        </div>
      </div>
    </section>
  );
}
