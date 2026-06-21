import { NextRequest, NextResponse } from 'next/server';

import { archiveCompletedVideoTaskById } from '@/lib/production-video-task-archive-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ArchiveVideoTaskBody {
  taskId?: string;
}

export async function POST(request: NextRequest) {
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

    const archived = archiveCompletedVideoTaskById(taskId);

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
      task: archived.task,
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
