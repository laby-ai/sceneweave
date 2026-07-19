import {
  completeTask,
  createTask,
  failTask,
  getTaskForOwner,
  startTask,
  updateTask,
  type TaskOwner,
} from '@/lib/task-manager';

interface PersistedVideoSegment {
  shotIndex: number;
  status?: string;
}

interface CreateVimaxVideoTaskRuntimeInput<Result extends object, Segment extends PersistedVideoSegment> {
  owner: TaskOwner;
  parentTaskId: string;
  totalShots: number;
  prompt: string;
  ratio: string;
  resolution: string;
  modelId: string;
  execute: (persistSegment: (segment: Segment) => void) => Promise<Result>;
}

export function createVimaxVideoTaskRuntime<
  Result extends object,
  Segment extends PersistedVideoSegment,
>(input: CreateVimaxVideoTaskRuntimeInput<Result, Segment>) {
  const persistSegment = (segment: Segment, backgroundTaskId?: string) => {
    const latest = getTaskForOwner(input.parentTaskId, input.owner);
    const existing = Array.isArray(latest?.result?.vimaxHappyHorseSegments)
      ? latest.result.vimaxHappyHorseSegments as Segment[]
      : [];
    const next = [...existing.filter(item => item.shotIndex !== segment.shotIndex), segment]
      .sort((left, right) => left.shotIndex - right.shotIndex);
    if (!updateTask(input.parentTaskId, {
      result: { ...(latest?.result || {}), vimaxHappyHorseSegments: next },
    })) throw new Error('视频任务恢复信息保存失败，已停止继续提交后续镜头。');
    if (!backgroundTaskId) return;

    const backgroundTask = getTaskForOwner(backgroundTaskId, input.owner);
    if (!backgroundTask) throw new Error('后台视频任务不存在或无权访问。');
    const completedShots = next.filter(item => item.status === 'succeeded').length;
    const progress = Math.min(90, 10 + Math.round((completedShots / input.totalShots) * 75));
    if (!updateTask(backgroundTaskId, {
      progress,
      stage: segment.status === 'succeeded'
        ? `镜头 ${completedShots}/${input.totalShots} 已完成`
        : `镜头 ${segment.shotIndex}/${input.totalShots} 已提交`,
      message: segment.status === 'succeeded'
        ? '正在继续生成下一镜并保持连续性。'
        : '供应商任务号已保存，可安全刷新或稍后恢复。',
      result: { ...(backgroundTask.result || {}), parentTaskId: input.parentTaskId, vimaxHappyHorseSegments: next },
    })) throw new Error('后台视频进度保存失败，已停止继续提交后续镜头。');
    if (getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled') {
      throw new Error('video_background_cancelled');
    }
  };

  const execute = async (backgroundTaskId?: string) => {
    const result = await input.execute(segment => persistSegment(segment, backgroundTaskId));
    if (backgroundTaskId && getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled') {
      throw new Error('video_background_cancelled');
    }
    const parent = getTaskForOwner(input.parentTaskId, input.owner);
    if (!updateTask(input.parentTaskId, {
      result: { ...(parent?.result || {}), vimaxVideoResult: result },
    })) throw new Error('完整短剧结果保存失败。');
    return result;
  };

  const startBackground = () => {
    const backgroundTaskId = createTask('video', {
      parentTaskId: input.parentTaskId,
      workflow: 'vimax-agent-video',
      prompt: input.prompt,
      ratio: input.ratio,
      resolution: input.resolution,
      modelId: input.modelId,
    }, input.owner);
    if (!startTask(backgroundTaskId)) throw new Error('后台视频任务无法进入运行状态。');
    updateTask(backgroundTaskId, {
      progress: 5,
      stage: '视频任务已受理',
      message: '页面可以安全刷新，生成进度会从任务中心继续恢复。',
      result: { parentTaskId: input.parentTaskId },
    });
    void execute(backgroundTaskId).then(result => {
      const latest = getTaskForOwner(backgroundTaskId, input.owner);
      if (!latest || latest.status === 'cancelled') return;
      completeTask(backgroundTaskId, {
        ...(latest.result || {}),
        parentTaskId: input.parentTaskId,
        vimaxVideoResult: result,
      });
    }).catch(error => {
      if (getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled') return;
      failTask(backgroundTaskId, error instanceof Error ? error.message : '后台视频生成失败');
    });
    return backgroundTaskId;
  };

  return { execute, startBackground };
}
