import type { BYOKConnection } from '@/lib/byok-provider';
import { queueProductionAssemblySegments } from '@/lib/production-assembly-queue';
import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import { startProductionBoundaryBridge } from '@/lib/production-boundary-bridge-start';
import { startProductionAssemblySegment } from '@/lib/production-segment-start';
import { getTaskForOwner, type TaskOwner } from '@/lib/task-manager';

import {
  finalizeHappyHorseSegments,
  type HappyHorseVimaxSegment,
} from './happyhorse-vimax-video';

const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export function isReusableVimaxBoundaryBridge(
  assemblyPlan: ProductionAssemblyPlan | undefined,
  boundaryIndex: number,
) {
  const boundary = assemblyPlan?.boundaryBridgePlan?.boundaries.find(item => item.index === boundaryIndex);
  return Boolean(boundary
    && boundary.status !== 'stale'
    && boundary.bridgeVideoUrl
    && boundary.newCameraImageUrl);
}

async function waitForOwnedTask(owner: TaskOwner, taskId: string) {
  for (let attempt = 0; attempt < 1_800; attempt += 1) {
    const task = getTaskForOwner(taskId, owner);
    if (!task) throw new Error('视频子任务不存在或无权访问。');
    if (TERMINAL_TASK_STATUSES.has(task.status)) {
      if (task.status !== 'completed') {
        throw new Error(task.error || task.message || '视频子任务未成功完成。');
      }
      return task;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('视频子任务等待超时；任务号已保存，可稍后从项目中继续恢复。');
}

export async function runVimaxProductionVideoOrchestrator(input: {
  owner: TaskOwner;
  parentTaskId: string;
  connection: BYOKConnection;
  model: string;
  generateAudio?: boolean;
  shots?: Array<{ index: number; title?: string }>;
  onSegmentState?: (segment: HappyHorseVimaxSegment) => void | Promise<void>;
}) {
  const queue = queueProductionAssemblySegments({
    owner: input.owner,
    taskId: input.parentTaskId,
  });
  for (let index = 0; index < queue.childTaskIds.length; index += 1) {
    const childTaskId = queue.childTaskIds[index];
    const child = getTaskForOwner(childTaskId, input.owner);
    if (child?.status !== 'completed') {
      startProductionAssemblySegment({
        childTaskId,
        dryRun: false,
        allowRealCost: true,
        generateAudio: input.generateAudio,
      }, input.connection);
      await waitForOwnedTask(input.owner, childTaskId);
    }
    const latestParent = getTaskForOwner(input.parentTaskId, input.owner);
    const latestPlan = latestParent?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
    const completedSegment = latestPlan?.segments.find(segment => segment.index === index);
    const completedChild = getTaskForOwner(childTaskId, input.owner);
    if (completedSegment?.expectedOutputs.videoUrl) {
      await input.onSegmentState?.({
        shotIndex: index + 1,
        shotTitle: input.shots?.find(shot => shot.index === index + 1)?.title || `镜头 ${index + 1}`,
        duration: completedSegment.duration,
        taskId: completedSegment.expectedOutputs.providerTaskId || childTaskId,
        status: 'succeeded',
        videoUrl: completedSegment.expectedOutputs.videoUrl,
        lastFrameUrl: completedSegment.expectedOutputs.lastFrameUrl || undefined,
        ...(completedChild?.result?.referenceManifest
          ? { referenceManifest: completedChild.result.referenceManifest as HappyHorseVimaxSegment['referenceManifest'] }
          : {}),
      });
    }
    if (index >= queue.childTaskIds.length - 1) continue;
    const parentAfterSegment = getTaskForOwner(input.parentTaskId, input.owner);
    const planAfterSegment = parentAfterSegment?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
    if (isReusableVimaxBoundaryBridge(planAfterSegment, index)) continue;
    const bridge = startProductionBoundaryBridge({
      parentTaskId: input.parentTaskId,
      boundaryIndex: index,
      dryRun: false,
      allowRealCost: true,
      generateAudio: input.generateAudio,
    }, input.connection);
    if (!bridge.childTaskId) throw new Error('边界桥接任务未建立，已停止下一镜提交。');
    await waitForOwnedTask(input.owner, bridge.childTaskId);
  }

  const parent = getTaskForOwner(input.parentTaskId, input.owner);
  const assemblyPlan = parent?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  if (!parent?.result || !assemblyPlan || assemblyPlan.status !== 'completed') {
    throw new Error('逐镜制作尚未完整结束，拒绝提前进入成片合成。');
  }
  const segments: HappyHorseVimaxSegment[] = assemblyPlan.segments.map(segment => {
    const child = segment.expectedOutputs.taskId
      ? getTaskForOwner(segment.expectedOutputs.taskId, input.owner)
      : undefined;
    if (!segment.expectedOutputs.videoUrl || !segment.expectedOutputs.taskId) {
      throw new Error(`镜头 ${segment.index + 1} 缺少已持久化的视频结果。`);
    }
    return {
      shotIndex: segment.index + 1,
      shotTitle: input.shots?.find(shot => shot.index === segment.index + 1)?.title || `镜头 ${segment.index + 1}`,
      duration: segment.duration,
      taskId: segment.expectedOutputs.providerTaskId || segment.expectedOutputs.taskId,
      status: 'succeeded' as const,
      videoUrl: segment.expectedOutputs.videoUrl,
      lastFrameUrl: segment.expectedOutputs.lastFrameUrl || undefined,
      ...(child?.result?.referenceManifest
        ? { referenceManifest: child.result.referenceManifest as HappyHorseVimaxSegment['referenceManifest'] }
        : {}),
    };
  });
  const { videoUrl, merge } = await finalizeHappyHorseSegments(segments, input.owner);
  return {
    model: input.model,
    videoUrl,
    duration: segments.reduce((sum, segment) => sum + segment.duration, 0),
    segments,
    segmentCount: segments.length,
    merge,
    shotTitle: segments.length > 1 ? '完整成片' : segments[0]?.shotTitle,
  };
}
