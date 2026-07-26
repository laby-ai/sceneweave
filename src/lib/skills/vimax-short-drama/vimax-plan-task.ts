import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import {
  cancelTask,
  completeTask,
  createTask,
  failTask,
  getTask,
  getTaskForOwner,
  startTask,
  type TaskOwner,
} from '@/lib/task-manager';
import type { VimaxAgentPlan, VimaxAgentStepBody } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import { normalizeVimaxInitialReferenceIds } from '@/lib/skills/vimax-short-drama/vimax-initial-references';
import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

interface PersistVimaxPlanTaskInput {
  taskId: string;
  prompt: string;
  plan: VimaxAgentPlan;
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
  productionPlan: VimaxProductionPlan | unknown;
}

export function createVimaxPlanningTask(owner: TaskOwner, prompt: string, body: VimaxAgentStepBody) {
  return createTask('storyboard', {
    prompt,
    duration: `${body.duration || 30}s`,
    ratio: body.ratio || '16:9',
    resolution: body.resolution || '720p',
    style: body.style || '电影感短剧',
    sceneType: body.sceneType || 'drama',
    workflow: 'vimax-agent',
    phase: 'plan',
    skillId: body.skillId,
    referenceIds: normalizeVimaxInitialReferenceIds(body.referenceIds),
    idempotencyKey: body.requestId,
  }, owner);
}

export function startVimaxPlanningTask(taskId: string) {
  if (!startTask(taskId)) throw new Error('创作任务无法进入规划状态。');
}

export function isVimaxPlanningTaskCancelled(taskId: string, owner: TaskOwner) {
  return getTaskForOwner(taskId, owner)?.status === 'cancelled';
}

export function settleVimaxPlanningTaskError(input: {
  taskId: string;
  owner: TaskOwner;
  requestAborted: boolean;
  error: unknown;
}) {
  if (input.requestAborted || (input.error instanceof Error && input.error.name === 'AbortError')) {
    cancelTask(input.taskId);
    return 'cancelled' as const;
  }
  if (isVimaxPlanningTaskCancelled(input.taskId, input.owner)) return 'cancelled' as const;
  failTask(input.taskId, 'planning_provider_failed');
  return 'failed' as const;
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
