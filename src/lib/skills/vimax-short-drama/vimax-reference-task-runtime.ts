import {
  completeTask,
  createTask,
  failTask,
  getAllTasksForOwner,
  getTaskForOwner,
  startTask,
  updateTask,
  type TaskOwner,
} from '@/lib/task-manager';
import type { VimaxAgentReferenceAsset } from './vimax-agent-contract';
import type { VimaxSubjectReferenceRegistry } from './vimax-reference-assets';

export interface VimaxReferenceTaskResult {
  model: string;
  assets: VimaxAgentReferenceAsset[];
  subjectRegistry: VimaxSubjectReferenceRegistry;
  complete: boolean;
  failedShotIndices: number[];
}

interface CreateVimaxReferenceTaskRuntimeInput {
  owner: TaskOwner;
  parentTaskId: string;
  prompt: string;
  modelId: string;
  execute: (signal: AbortSignal) => Promise<VimaxReferenceTaskResult>;
}

export function createVimaxReferenceTaskRuntime(input: CreateVimaxReferenceTaskRuntimeInput) {
  const startBackground = () => {
    const active = getAllTasksForOwner(input.owner).find(task => (
      task.config.parentTaskId === input.parentTaskId
      && task.config.workflow === 'vimax-agent-reference-assets'
      && (task.status === 'pending' || task.status === 'running')
    ));
    if (active) return active.id;

    const controller = new AbortController();
    const taskId = createTask('image', {
      parentTaskId: input.parentTaskId,
      workflow: 'vimax-agent-reference-assets',
      prompt: input.prompt,
      modelId: input.modelId,
    }, input.owner);
    if (!startTask(taskId, controller)) throw new Error('参考图任务无法进入运行状态。');
    updateTask(taskId, {
      progress: 5,
      stage: '参考图任务已受理',
      message: '页面可以安全刷新，已完成的参考图会保留。',
      result: { parentTaskId: input.parentTaskId },
    });

    const parent = getTaskForOwner(input.parentTaskId, input.owner);
    if (!parent || !updateTask(input.parentTaskId, {
      result: {
        ...(parent.result || {}),
        vimaxReferenceTaskId: taskId,
      },
    })) throw new Error('参考图任务号保存失败。');

    const cancellationWatch = setInterval(() => {
      if (getTaskForOwner(taskId, input.owner)?.status === 'cancelled') {
        controller.abort('reference_task_cancelled');
      }
    }, 100);
    cancellationWatch.unref?.();

    void input.execute(controller.signal).then(result => {
      const latest = getTaskForOwner(taskId, input.owner);
      if (!latest || latest.status === 'cancelled') return;
      completeTask(taskId, {
        ...(latest.result || {}),
        parentTaskId: input.parentTaskId,
        vimaxReferenceResult: result,
      });
    }).catch(error => {
      if (getTaskForOwner(taskId, input.owner)?.status === 'cancelled') return;
      failTask(taskId, error instanceof Error ? error.message : '参考图生成失败');
    }).finally(() => {
      clearInterval(cancellationWatch);
    });

    return taskId;
  };

  return { startBackground };
}
