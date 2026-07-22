import { buildProductionAssemblyPlan, type ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import { evaluateAssemblyShotFrameReadiness } from '@/lib/production-shot-frame-contract';
import { buildAssemblySegmentDependencyConfig } from '@/lib/production-segment-transition';
import { assertVimaxProductionOperation } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import {
  createTask,
  getAllTasksForOwner,
  getTaskForOwner,
  getTaskFresh,
  retryTask,
  updateTask,
  type TaskOwner,
} from '@/lib/task-manager';

export class ProductionAssemblyQueueError extends Error {
  constructor(message: string, public status = 409, public details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProductionAssemblyQueueError';
  }
}

export function queueProductionAssemblySegments(input: {
  owner: TaskOwner;
  taskId: string;
  reset?: boolean;
}) {
  const task = getTaskForOwner(input.taskId, input.owner);
  if (!task?.result?.productionProject || !task.result.assemblyPlan) {
    throw new ProductionAssemblyQueueError(
      `任务 ${input.taskId} 缺少 productionProject 或 assemblyPlan，无法创建片段子任务队列`,
      404,
    );
  }

  if (task.result.productionPlan) {
    try {
      assertVimaxProductionOperation(task.result.productionPlan, 'segments.queue', ['ready', 'delivery-ready']);
    } catch (error) {
      throw new ProductionAssemblyQueueError(
        error instanceof Error ? error.message : '当前制作流程尚不能创建片段任务。',
        409,
      );
    }
  }

  const productionProject = task.result.productionProject as ProductionProject;
  let assemblyPlan = task.result.assemblyPlan as ProductionAssemblyPlan;
  let readiness = assemblyPlan.readiness || evaluateAssemblyShotFrameReadiness(assemblyPlan.segments);
  const onlyProjectWritebackStale = !readiness.pass
    && readiness.issues.length > 0
    && readiness.issues.every(issue => issue.code === 'artifact-stale-after-project-writeback');
  if (onlyProjectWritebackStale) {
    assemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: task.id });
    readiness = assemblyPlan.readiness || evaluateAssemblyShotFrameReadiness(assemblyPlan.segments);
  }
  if (!readiness.pass) {
    throw new ProductionAssemblyQueueError(
      'assemblyPlan 未通过镜头首尾帧合约，已阻止创建片段子任务队列。',
      409,
      {
        taskId: task.id,
        productionProjectId: assemblyPlan.productionProjectId,
        readiness,
        nextAction: readiness.nextAction,
      },
    );
  }

  const existingTaskIds = new Set(getAllTasksForOwner(input.owner).map(item => item.id));
  let previousChildTaskId: string | null = null;
  const queuedSegments = assemblyPlan.segments.map(segment => {
    const existingTaskId = input.reset ? null : segment.expectedOutputs?.taskId;
    const canReuse = existingTaskId && existingTaskIds.has(existingTaskId);
    const childTaskId = canReuse
      ? existingTaskId
      : createTask('video', {
        prompt: segment.prompt,
        duration: String(segment.duration),
        ratio: productionProject.ratio || '16:9',
        style: productionProject.style,
        workflow: 'production-assembly-segment',
        parentTaskId: task.id,
        productionProjectId: assemblyPlan.productionProjectId,
        assemblySourceTaskId: assemblyPlan.sourceTaskId,
        assemblySegmentId: segment.id,
        assemblySegmentIndex: segment.index,
        shotId: segment.shotId,
        noAutoStart: true,
        costGuard: 'queued-only-no-provider-call',
      }, input.owner);
    const dependencyConfig = buildAssemblySegmentDependencyConfig({
      assemblyPlan,
      segment,
      childTaskId,
      previousChildTaskId,
    });
    previousChildTaskId = childTaskId;
    const existingChildTask = getTaskFresh(childTaskId);
    const childTask = canReuse
      && (existingChildTask?.status === 'failed' || existingChildTask?.status === 'cancelled')
      ? retryTask(childTaskId)
      : existingChildTask;
    if (childTask) {
      updateTask(childTaskId, { config: { ...childTask.config, ...dependencyConfig } });
    }
    const reusableCompletion = canReuse
      && childTask?.status === 'completed'
      && Boolean(segment.expectedOutputs?.videoUrl);
    return {
      ...segment,
      status: reusableCompletion ? 'completed' as const : 'queued' as const,
      expectedOutputs: {
        ...segment.expectedOutputs,
        taskId: childTaskId,
        videoUrl: segment.expectedOutputs?.videoUrl || null,
        lastFrameUrl: segment.expectedOutputs?.lastFrameUrl || null,
      },
      expectedInputs: {
        ...segment.expectedInputs,
        firstFrameUrl: dependencyConfig.firstFrameUrl,
        previousLastFrameUrl: dependencyConfig.previousLastFrameUrl,
        continuityPrompt: String(dependencyConfig.assemblyDependency.continuityPrompt),
      },
    };
  });
  const childTaskIds = queuedSegments
    .map(segment => segment.expectedOutputs.taskId)
    .filter((taskId): taskId is string => Boolean(taskId));
  const queuedSegmentCount = queuedSegments.filter(segment => segment.status !== 'completed').length;
  const completedSegmentCount = queuedSegments.length - queuedSegmentCount;
  const updatedAssemblyPlan: ProductionAssemblyPlan = {
    ...assemblyPlan,
    status: queuedSegmentCount === 0
      ? 'completed'
      : completedSegmentCount > 0
        ? 'partial'
        : 'planned',
    segments: queuedSegments,
    nextAction: '片段子任务已排队。下一步逐段生成；相邻段之间必须先完成边界桥接并写回下一段入口。',
  };
  const assemblyQueue = {
    version: 'yh-assembly-queue-v1' as const,
    sourceTaskId: task.id,
    status: 'queued' as const,
    queuedSegmentCount,
    childTaskIds,
    updatedAt: new Date().toISOString(),
  };
  updateTask(task.id, {
    result: { ...task.result, assemblyPlan: updatedAssemblyPlan, assemblyQueue },
    message: completedSegmentCount > 0
      ? `已保留 ${completedSegmentCount} 个完成片段，其余 ${queuedSegmentCount} 个片段已重新排队。`
      : `已为 ${queuedSegmentCount} 个分镜片段创建可追踪视频子任务，尚未调用真实供应商。`,
  });
  return {
    success: true as const,
    usedRealKey: false,
    incurredCost: false,
    taskId: task.id,
    productionProjectId: assemblyPlan.productionProjectId,
    queuedSegmentCount,
    childTaskIds,
    assemblyQueue,
    segments: queuedSegments.map(segment => ({
      id: segment.id,
      index: segment.index,
      shotId: segment.shotId,
      status: segment.status,
      taskId: segment.expectedOutputs.taskId,
      duration: segment.duration,
      dependencyTaskId: segment.index > 0
        ? queuedSegments[segment.index - 1]?.expectedOutputs.taskId || null
        : null,
    })),
    nextAction: updatedAssemblyPlan.nextAction,
  };
}
