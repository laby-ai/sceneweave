import { archiveCompletedVideoTaskAsProductionProject } from './production-case-archive';
import { getTaskFresh, updateTask, type BackgroundTask } from './task-manager';

export interface ArchiveCompletedVideoTaskByIdResult {
  taskId: string;
  productionProjectId: string;
  segmentAssetCount: number;
  finalVideoAssetCount: number;
  assemblyStatus: string;
  task?: BackgroundTask;
}

export function archiveCompletedVideoTaskById(taskId: string): ArchiveCompletedVideoTaskByIdResult {
  const task = getTaskFresh(taskId);
  if (!task) {
    throw new Error(`任务 ${taskId} 不存在。`);
  }

  const archived = archiveCompletedVideoTaskAsProductionProject({ task });
  const updatedTask = updateTask(taskId, {
    result: archived.result,
    message: `真实视频任务已归档为制作项目，写回 ${archived.segmentAssetCount} 个 videoSegment 和 ${archived.finalVideoAssetCount} 个 finalVideo 资产。`,
  });

  return {
    taskId,
    productionProjectId: archived.productionProjectId,
    segmentAssetCount: archived.segmentAssetCount,
    finalVideoAssetCount: archived.finalVideoAssetCount,
    assemblyStatus: archived.assemblyStatus,
    task: updatedTask || getTaskFresh(taskId),
  };
}
