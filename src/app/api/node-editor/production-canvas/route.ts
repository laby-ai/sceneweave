import { NextRequest, NextResponse } from 'next/server';

import { buildProductionCanvas } from '@/lib/production-canvas';
import { evaluateStoryReadability, type StoryReadabilityScore } from '@/lib/production-story-readability';
import { getAllTasksForOwner, getTaskForOwner, type TaskOwner } from '@/lib/task-manager';
import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { DirectorChainResult } from '@/lib/smart-director-chain';
import type { ProductionProject } from '@/lib/production-project';
import { resolveTaskOwnerFromRequest } from '@/lib/task-access';

function getProductionProjectFromTask(owner: TaskOwner, taskId?: string) {
  if (taskId) {
    const task = getTaskForOwner(taskId, owner);
    if (!task?.result?.productionProject) return null;
    return task;
  }

  return getAllTasksForOwner(owner)
    .filter(task => Boolean(task.result?.productionProject))
    .sort((a, b) => (b.lastUpdatedAt || b.completedAt || b.createdAt) - (a.lastUpdatedAt || a.completedAt || a.createdAt))[0] || null;
}

export async function GET(request: NextRequest) {
  const owner = await resolveTaskOwnerFromRequest(request);
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const taskId = request.nextUrl.searchParams.get('taskId') || undefined;
    const task = getProductionProjectFromTask(owner, taskId);

    if (!task?.result?.productionProject) {
      return NextResponse.json({
        success: false,
        error: taskId
          ? `任务 ${taskId} 没有可导入画布的制作项目`
          : '暂无可导入画布的绘影项目，请先在绘影精灵生成导演链路或运行制作 dry-run。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 404 });
    }

    const productionProject = task.result.productionProject as ProductionProject;
    const directorChain = task.result.directorChain as DirectorChainResult | undefined;
    const assemblyPlan = task.result.assemblyPlan as ProductionAssemblyPlan | undefined;
    const storyReadability = (task.result.storyReadability as StoryReadabilityScore | undefined)
      || evaluateStoryReadability({
        productionProject,
        assemblyPlan,
        threshold: 80,
      });
    const canvas = buildProductionCanvas({
      productionProject,
      directorChain,
      assemblyPlan,
      storyReadability,
      taskId: task.id,
    });

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId: task.id,
      storyReadability,
      canvas,
    });
  } catch (error) {
    console.error('[ProductionCanvas] build failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '生成绘影项目画布失败',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
