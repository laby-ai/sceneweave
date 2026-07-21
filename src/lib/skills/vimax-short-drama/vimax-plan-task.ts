import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import {
  completeTask,
  createTask,
  failTask,
  startTask,
  type TaskOwner,
} from '@/lib/task-manager';
import type { VimaxAgentPlan, VimaxAgentStepBody } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

interface PersistVimaxPlanTaskInput {
  taskId: string;
  prompt: string;
  plan: VimaxAgentPlan;
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
  productionPlan: VimaxProductionPlan | unknown;
}

export function createVimaxPlanTask(owner: TaskOwner, prompt: string, body: VimaxAgentStepBody) {
  return createTask('storyboard', {
    prompt,
    duration: `${body.duration || 30}s`,
    ratio: body.ratio || '16:9',
    resolution: body.resolution || '720p',
    style: body.style || '电影感短剧',
    sceneType: body.sceneType || 'drama',
    workflow: 'vimax-agent',
    skillId: body.skillId,
  }, owner);
}

export function failVimaxPlanTask(taskId: string) {
  return failTask(taskId, 'planning_provider_failed');
}

export function persistVimaxPlanTask(input: PersistVimaxPlanTaskInput) {
  if (!startTask(input.taskId)) {
    throw new Error('创作任务无法进入运行状态。');
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
