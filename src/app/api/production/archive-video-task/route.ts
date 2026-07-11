import { NextRequest, NextResponse } from 'next/server';

import { archiveCompletedVideoTaskById } from '@/lib/production-video-task-archive-service';
import { getTaskForOwner } from '@/lib/task-manager';
import { resolveTaskOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ArchiveVideoTaskBody {
  taskId?: string;
}

export async function POST(request: NextRequest) {
  const owner = await resolveTaskOwnerFromRequest(request);
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as ArchiveVideoTaskBody;
    const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : '';
    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '请提供要归档的真实视频任务 taskId。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 400 });
    }
    if (!getTaskForOwner(taskId, owner)) {
      return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 });
    }

    const archived = archiveCompletedVideoTaskById(taskId);
    let publicTask: Record<string, unknown> | undefined;
    if (archived.task) {
      const { owner: _owner, abortController: _abortController, ...taskInfo } = archived.task;
      void _owner;
      void _abortController;
      publicTask = taskInfo;
    }

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId,
      productionProjectId: archived.productionProjectId,
      segmentAssetCount: archived.segmentAssetCount,
      finalVideoAssetCount: archived.finalVideoAssetCount,
      assemblyStatus: archived.assemblyStatus,
      nextAction: '可在任务中心、画布、首页案例和后续素材库中复用这些 videoSegment/finalVideo 资产。',
      task: publicTask,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '归档真实视频任务失败',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
