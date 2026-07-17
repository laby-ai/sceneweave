import { NextRequest, NextResponse } from 'next/server';

import { buildProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import { evaluateStoryReadability } from '@/lib/production-story-readability';
import { getAllTasksForOwner, getTaskForOwner, updateTask, type TaskOwner } from '@/lib/task-manager';
import type { ProductionProject } from '@/lib/production-project';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickTask(owner: TaskOwner, taskId?: string) {
  if (taskId) return getTaskForOwner(taskId, owner) || null;
  return getAllTasksForOwner(owner)
    .filter(task => Boolean(task.result?.productionProject))
    .sort((a, b) => (b.lastUpdatedAt || b.completedAt || b.createdAt) - (a.lastUpdatedAt || a.completedAt || a.createdAt))[0] || null;
}

export async function POST(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { owner } = access;
  try {
    const body = await request.json().catch(() => ({})) as { taskId?: string; persist?: boolean };
    const task = pickTask(owner, body.taskId);

    if (!task?.result?.productionProject) {
      return NextResponse.json({
        success: false,
        error: body.taskId
          ? `任务 ${body.taskId} 没有可生成片段计划的 productionProject`
          : '暂无可生成片段计划的绘影项目，请先运行制作 dry-run 或绘影精灵导演链路。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 404 });
    }

    const productionProject = task.result.productionProject as ProductionProject;
    const assemblyPlan = buildProductionAssemblyPlan({
      productionProject,
      sourceTaskId: task.id,
    });
    const storyReadability = evaluateStoryReadability({
      productionProject,
      assemblyPlan,
      threshold: 80,
    });

    const shouldPersist = body.persist !== false;
    if (shouldPersist) {
      updateTask(task.id, {
        result: {
          ...task.result,
          assemblyPlan,
          storyReadability,
        },
        message: storyReadability.pass
          ? '已生成剧本到成片的片段任务计划，故事可读性门禁已通过，可进入视频生成前检查'
          : '已生成片段任务计划，但故事可读性门禁未通过，建议先修正主角、动作、冲突或段落衔接',
      });
    }

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      persisted: shouldPersist,
      taskId: task.id,
      assemblyPlan,
      storyReadability,
    });
  } catch (error) {
    console.error('[ProductionAssemblyPlan] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '生成片段任务计划失败',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
