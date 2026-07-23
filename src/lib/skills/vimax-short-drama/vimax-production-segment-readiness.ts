import { retryProductionAssemblySegment } from '@/lib/production-segment-retry';
import {
  getTaskForOwner,
  type BackgroundTask,
  type TaskOwner,
} from '@/lib/task-manager';

export function prepareVimaxProductionSegmentForStart(input: {
  owner: TaskOwner;
  parentTaskId: string;
  childTaskId: string;
  segmentIndex: number;
}): BackgroundTask {
  const child = getTaskForOwner(input.childTaskId, input.owner);
  if (!child) throw new Error('视频子任务不存在或无权访问。');

  if (child.status === 'failed' || child.status === 'cancelled') {
    retryProductionAssemblySegment({
      childTaskId: input.childTaskId,
      parentTaskId: input.parentTaskId,
      segmentIndex: input.segmentIndex,
    }, input.owner);
    const recovered = getTaskForOwner(input.childTaskId, input.owner);
    if (!recovered || recovered.status !== 'pending') {
      throw new Error('视频子任务恢复失败，已停止真实模型提交。');
    }
    return recovered;
  }

  return child;
}
