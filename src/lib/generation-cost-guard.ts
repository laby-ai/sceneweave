export interface ImageGenerationPlan {
  imageCount: number;
  actionLabel: string;
  scopeLabel?: string;
  usesBYOK?: boolean;
}

export function formatImageGenerationPlan(plan: ImageGenerationPlan): string {
  const countText = `${plan.imageCount} 张图片`;
  const scopeText = plan.scopeLabel ? `\n范围：${plan.scopeLabel}` : '';
  const byokText = plan.usesBYOK
    ? '\n当前检测到用户供应商配置，将消耗你自己的供应商额度。'
    : '\n如已在设置中启用用户供应商配置，将消耗你自己的供应商额度。';

  return `即将执行：${plan.actionLabel}\n预计生成：${countText}${scopeText}${byokText}\n\n是否继续？`;
}

export function confirmImageGenerationPlan(plan: ImageGenerationPlan): boolean {
  if (plan.imageCount <= 1) return true;
  if (typeof window === 'undefined') return true;

  return window.confirm(formatImageGenerationPlan(plan));
}
