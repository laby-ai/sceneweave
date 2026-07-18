import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import { computeProductionArtifactRevision } from '@/lib/production-artifact-stale';
import type { ProductionProject } from '@/lib/production-project';
import { getTaskForOwner, type TaskOwner } from '@/lib/task-manager';
import type { VimaxAgentPlan } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import { buildVimaxAgentPlanFromProductionArtifacts } from '@/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { parseVimaxProductionPlan, type VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

function isProductionProject(value: unknown): value is ProductionProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<ProductionProject>;
  return typeof project.id === 'string'
    && Array.isArray(project.assets)
    && Array.isArray(project.storyboard?.shots);
}

function isAssemblyPlan(value: unknown): value is ProductionAssemblyPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<ProductionAssemblyPlan>;
  return plan.version === 'yh-assembly-plan-v1' && Array.isArray(plan.segments);
}

function readPlanSummary(content: unknown): Partial<VimaxAgentPlan> {
  if (typeof content !== 'string') return {};
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      nextAction: typeof parsed.nextAction === 'string' ? parsed.nextAction : undefined,
    };
  } catch {
    return {};
  }
}

function assertCurrentArtifacts(project: ProductionProject, assemblyPlan: ProductionAssemblyPlan) {
  const currentRevision = computeProductionArtifactRevision(project);
  const stale = assemblyPlan.segments.some(segment => (
    segment.artifactReadiness?.stale
    || Boolean(segment.artifactReadiness?.sourceRevision
      && segment.artifactReadiness.sourceRevision !== currentRevision)
  ));
  if (stale) {
    throw new Error('分镜或资产已更新，请先重新生成制作合约，再继续参考素材或视频生成。');
  }
}

export interface CanonicalVimaxStageInput {
  taskId: string;
  plan: VimaxAgentPlan;
  productionPlan: VimaxProductionPlan;
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
}

export function resolveCanonicalVimaxStageInput(input: {
  taskId: string;
  owner: TaskOwner;
}): CanonicalVimaxStageInput {
  const taskId = input.taskId.trim();
  const task = taskId ? getTaskForOwner(taskId, input.owner) : undefined;
  if (!task) throw new Error('创作项目不存在或无权访问，请重新打开当前项目。');

  const productionProject = task.result?.productionProject;
  const assemblyPlan = task.result?.assemblyPlan;
  const productionPlan = parseVimaxProductionPlan(task.result?.productionPlan);
  if (!isProductionProject(productionProject) || !isAssemblyPlan(assemblyPlan) || !productionPlan) {
    throw new Error('当前项目缺少完整制作合约，请重新生成制作计划。');
  }
  assertCurrentArtifacts(productionProject, assemblyPlan);

  return {
    taskId,
    productionProject,
    assemblyPlan,
    productionPlan,
    plan: buildVimaxAgentPlanFromProductionArtifacts({
      productionProject,
      assemblyPlan,
      basePlan: readPlanSummary(task.result?.content),
    }),
  };
}
