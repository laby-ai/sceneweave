import { NextRequest, NextResponse } from 'next/server';

import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import { evaluateAssemblyShotFrameReadiness } from '@/lib/production-shot-frame-contract';
import { buildAssemblySegmentDependencyConfig } from '@/lib/production-segment-transition';
import { createTask, getAllTasksForOwner, getTaskForOwner, getTaskFresh, updateTask, type TaskOwner } from '@/lib/task-manager';
import { resolveTaskOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QueueRequestBody {
  taskId?: string;
  reset?: boolean;
}

function pickTask(owner: TaskOwner, taskId?: string) {
  if (taskId) return getTaskForOwner(taskId, owner) || null;
  return getAllTasksForOwner(owner)
    .filter(task => Boolean(task.result?.productionProject && task.result?.assemblyPlan))
    .sort((a, b) => (b.lastUpdatedAt || b.completedAt || b.createdAt) - (a.lastUpdatedAt || a.completedAt || a.createdAt))[0] || null;
}

export async function POST(request: NextRequest) {
  const owner = await resolveTaskOwnerFromRequest(request);
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as QueueRequestBody;
    const task = pickTask(owner, body.taskId);

    if (!task?.result?.productionProject || !task.result.assemblyPlan) {
      return NextResponse.json({
        success: false,
        error: body.taskId
          ? `任务 ${body.taskId} 缺少 productionProject 或 assemblyPlan，无法创建片段子任务队列`
          : '暂无可排队的绘影片段计划，请先运行绘影精灵导演链路和 assembly-plan。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 404 });
    }

    const productionProject = task.result.productionProject as ProductionProject;
    const assemblyPlan = task.result.assemblyPlan as ProductionAssemblyPlan;
    const readiness = assemblyPlan.readiness || evaluateAssemblyShotFrameReadiness(assemblyPlan.segments);
    if (!readiness.pass) {
      return NextResponse.json({
        success: false,
        error: 'assemblyPlan 未通过镜头首尾帧合约，已阻止创建片段子任务队列。',
        usedRealKey: false,
        incurredCost: false,
        taskId: task.id,
        productionProjectId: assemblyPlan.productionProjectId,
        readiness,
        nextAction: readiness.nextAction,
      }, { status: 409 });
    }

    const existingTasks = getAllTasksForOwner(owner);
    const existingTaskIds = new Set(existingTasks.map(item => item.id));

    let previousChildTaskId: string | null = null;
    const queuedSegments = assemblyPlan.segments.map(segment => {
      const existingTaskId = body.reset ? null : segment.expectedOutputs?.taskId;
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
        });
      const dependencyConfig = buildAssemblySegmentDependencyConfig({
        assemblyPlan,
        segment,
        childTaskId,
        previousChildTaskId,
      });
      previousChildTaskId = childTaskId;
      const childTask = getTaskFresh(childTaskId);
      if (childTask) {
        updateTask(childTaskId, {
          config: {
            ...childTask.config,
            ...dependencyConfig,
          },
        });
      }

      return {
        ...segment,
        status: 'queued' as const,
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

    const updatedAssemblyPlan: ProductionAssemblyPlan = {
      ...assemblyPlan,
      status: 'planned',
      segments: queuedSegments,
      nextAction: '片段子任务已排队。下一步按低成本阶梯逐段启动视频生成，成功后立即写回 videoUrl/lastFrameUrl；失败只重试失败片段。',
    };

    const assemblyQueue = {
      version: 'yh-assembly-queue-v1',
      sourceTaskId: task.id,
      status: 'queued',
      queuedSegmentCount: queuedSegments.length,
      childTaskIds,
      updatedAt: new Date().toISOString(),
    };

    updateTask(task.id, {
      result: {
        ...task.result,
        assemblyPlan: updatedAssemblyPlan,
        assemblyQueue,
      },
      message: `已为 ${queuedSegments.length} 个分镜片段创建可追踪视频子任务，尚未调用真实供应商。`,
    });

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId: task.id,
      productionProjectId: assemblyPlan.productionProjectId,
      queuedSegmentCount: queuedSegments.length,
      childTaskIds,
      assemblyQueue,
      segments: queuedSegments.map(segment => ({
        id: segment.id,
        index: segment.index,
        shotId: segment.shotId,
        status: segment.status,
        taskId: segment.expectedOutputs.taskId,
        duration: segment.duration,
        dependencyTaskId: segment.index > 0 ? queuedSegments[segment.index - 1]?.expectedOutputs.taskId || null : null,
      })),
      nextAction: updatedAssemblyPlan.nextAction,
    });
  } catch (error) {
    console.error('[ProductionAssemblyQueue] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建片段子任务队列失败',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
