import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import {
  completeTask,
  getTask,
  startTask,
} from '@/lib/task-manager';
import type { VimaxAgentPlan } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

interface PersistVimaxPlanTaskInput {
  taskId: string;
  prompt: string;
  plan: VimaxAgentPlan;
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
  productionPlan: VimaxProductionPlan | unknown;
}

export function persistVimaxPlanTask(input: PersistVimaxPlanTaskInput) {
  const task = getTask(input.taskId);
  if (!task || (task.status === 'pending' && !startTask(input.taskId))) {
    throw new Error('创作任务无法进入运行状态。');
  }
  if (task.status !== 'pending' && task.status !== 'running') {
    throw new Error('创作任务已结束，不能覆盖当前状态。');
  }

  const completed = completeTask(input.taskId, {
    content: JSON.stringify({
      title: input.plan.title,
      summary: input.plan.summary,
      nextAction: input.plan.nextAction,
    }),
    shots: input.plan.shots.map(shot => ({
      prompt: shot.prompt,
      duration: shot.duration,
      status: 'planned',
    })),
    productionProject: input.productionProject,
    assemblyPlan: input.assemblyPlan,
    productionPlan: input.productionPlan,
    vimaxPlan: input.plan,
    creationPrompt: input.prompt,
  });

  if (!completed) throw new Error('创作任务结果保存失败。');
  return input.taskId;
}
