import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

export interface VimaxProductionGovernanceView {
  state: VimaxProductionPlan['governance']['status'];
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
      label: '制作计划已确认',
      canApprove: false,
      description: '确认记录已保存，刷新后仍可从当前检查点继续。',
    };
  }
  return {
    state: 'blocked',
    label: '制作计划暂不可确认',
    canApprove: false,
    description: '所需服务尚未就绪，请先处理计划中列出的阻塞项。',
  };
}
