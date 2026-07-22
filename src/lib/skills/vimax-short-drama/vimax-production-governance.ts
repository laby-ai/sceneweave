import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

export interface VimaxProductionGovernanceView {
  state: VimaxProductionPlan['governance']['status'];
  mode?: 'external' | 'draft';
  label: string;
  canApprove: boolean;
  description: string;
}

export function buildVimaxProductionGovernanceView(plan: VimaxProductionPlan): VimaxProductionGovernanceView {
  if (plan.governance.status === 'awaiting-plan-approval') {
    return {
      state: 'awaiting-plan-approval',
      label: '确认制作计划',
      canApprove: true,
      description: '确认素材清单、模型路线与费用边界后，才会开放后续制作。',
    };
  }
  if (plan.governance.status === 'plan-approved') {
    return {
      state: 'plan-approved',
      label: '费用与执行方式',
      canApprove: false,
      description: '计划已确认。真实媒体费用待供应商确认，也可以先准备不调用模型的制作草稿。',
    };
  }
  if (plan.governance.status === 'awaiting-cost-decision') {
    return {
      state: 'awaiting-cost-decision',
      label: '费用与执行方式',
      canApprove: false,
      description: '计划已确认。真实媒体费用待供应商确认，也可以先准备不调用模型的制作草稿。',
    };
  }
  if (plan.governance.status === 'ready') {
    if (plan.estimatedCost.status === 'confirmed' && plan.estimatedCost.billingSource === 'external-byok') {
      return {
        state: 'ready',
        mode: 'external',
        label: '百炼真实生成已确认',
        canApprove: false,
        description: '将使用当前账号的百炼配置调用真实图像和视频模型；费用以供应商账单为准。',
      };
    }
    return {
      state: 'ready',
      mode: 'draft',
      label: '无成本草稿流程已就绪',
      canApprove: false,
      description: '不会调用图像或视频模型；可暂停、刷新恢复或准备交付草稿。',
    };
  }
  if (plan.governance.status === 'paused') {
    return {
      state: 'paused',
      label: '流程已暂停',
      canApprove: false,
      description: '暂停记录已保存，刷新后仍可从当前检查点继续。',
    };
  }
  if (plan.governance.status === 'delivery-ready') {
    const finalVideoReady = plan.render.status === 'completed';
    return {
      state: 'delivery-ready',
      label: finalVideoReady ? '成片已交付' : '草稿已可交付',
      canApprove: false,
      description: finalVideoReady
        ? '最终成片已锁定到最后一次成功结果，可以安全播放和下载。'
        : '制作草稿已锁定到最后一次成功结果，可以安全下载。',
    };
  }
  return {
    state: 'blocked',
    label: '制作计划暂不可确认',
    canApprove: false,
    description: '所需服务尚未就绪，请先处理计划中列出的阻塞项。',
  };
}
