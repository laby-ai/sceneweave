import { NextRequest, NextResponse } from 'next/server';

import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';
import { archiveCompletedVideoTaskById } from '@/lib/production-video-task-archive-service';
import { getTaskFresh, updateTask } from '@/lib/task-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redactError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

function getSegmentUrls(task: ReturnType<typeof getTaskFresh>) {
  const segments = Array.isArray(task?.result?.segments) ? task.result.segments : [];
  return segments
    .map(segment => typeof segment?.videoUrl === 'string' ? segment.videoUrl : '')
    .filter(Boolean);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const task = getTaskFresh(taskId);

  if (!task) {
    return NextResponse.json({
      success: false,
      error: '任务不存在',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 404 });
  }

  const segmentUrls = getSegmentUrls(task);
  if (segmentUrls.length < 2) {
    return NextResponse.json({
      success: false,
      error: '该任务没有足够的已生成片段，无法重试合成。',
      usedRealKey: false,
      incurredCost: false,
      segmentCount: segmentUrls.length,
    }, { status: 400 });
  }

  updateTask(taskId, {
    status: 'running',
    stage: '正在重试本地合成...',
    progress: Math.max(task.progress || 0, 92),
    message: `正在使用 ${segmentUrls.length} 个已生成片段重试本地合成，不会重新调用视频生成供应商。`,
    error: undefined,
  });

  try {
    const mergeResult = await mergeVideosWithLocalFfmpeg(segmentUrls);
    const latestTask = getTaskFresh(taskId) || task;
    const updatedTask = updateTask(taskId, {
      status: 'completed',
      stage: '已完成',
      progress: 100,
      result: {
        ...latestTask.result,
        videoUrl: mergeResult.videoUrl,
        isPartial: false,
        segmentCount: mergeResult.segmentCount,
        successSegmentCount: mergeResult.segmentCount,
        mergeRecovery: {
          method: 'local-ffmpeg',
          outputPath: mergeResult.outputPath,
          bytes: mergeResult.bytes,
          recoveredAt: new Date().toISOString(),
        },
      },
      completedAt: Date.now(),
      message: '已使用本地 FFmpeg 将保留片段合成为成片。',
      error: undefined,
    });

    let archivedProduction: {
      productionProjectId: string;
      segmentAssetCount: number;
      finalVideoAssetCount: number;
      assemblyStatus: string;
    } | null = null;
    try {
      const archived = archiveCompletedVideoTaskById(taskId);
      archivedProduction = {
        productionProjectId: archived.productionProjectId,
        segmentAssetCount: archived.segmentAssetCount,
        finalVideoAssetCount: archived.finalVideoAssetCount,
        assemblyStatus: archived.assemblyStatus,
      };
      updateTask(taskId, {
        message: `已使用本地 FFmpeg 合成为成片，并自动归档 ${archived.segmentAssetCount} 个 videoSegment 和 ${archived.finalVideoAssetCount} 个 finalVideo 资产。`,
      });
    } catch (archiveError) {
      const sanitizedArchiveError = redactError(archiveError);
      updateTask(taskId, {
        message: `已使用本地 FFmpeg 合成为成片，但制作项目归档失败：${sanitizedArchiveError}。可稍后重试归档。`,
      });
      console.warn(`[Task ${taskId}] merge archive failed:`, sanitizedArchiveError);
    }

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId,
      segmentCount: mergeResult.segmentCount,
      videoUrl: mergeResult.videoUrl,
      bytes: mergeResult.bytes,
      taskStatus: updatedTask?.status,
      archivedProduction,
    });
  } catch (error) {
    const sanitizedError = redactError(error);
    updateTask(taskId, {
      status: 'failed',
      stage: '本地合成失败',
      progress: Math.max(task.progress || 0, 92),
      error: `本地合成失败：${sanitizedError}`,
      message: '已生成片段仍然保留，可稍后再次重试合成。',
      completedAt: Date.now(),
    });

    return NextResponse.json({
      success: false,
      usedRealKey: false,
      incurredCost: false,
      taskId,
      segmentCount: segmentUrls.length,
      error: sanitizedError,
    }, { status: 500 });
  }
}
