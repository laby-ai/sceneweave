import { NextRequest, NextResponse } from 'next/server';

import {
  ProductionAssemblyQueueError,
  queueProductionAssemblySegments,
} from '@/lib/production-assembly-queue';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { taskId?: string; reset?: boolean };
    if (!body.taskId) {
      return NextResponse.json({ success: false, error: '请提供需要排队的项目 taskId。' }, { status: 400 });
    }
    return NextResponse.json(queueProductionAssemblySegments({
      owner: access.owner,
      taskId: body.taskId,
      reset: body.reset,
    }));
  } catch (error) {
    if (error instanceof ProductionAssemblyQueueError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        usedRealKey: false,
        incurredCost: false,
        ...error.details,
      }, { status: error.status });
    }
    console.error('[ProductionAssemblyQueue] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建片段子任务队列失败',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
