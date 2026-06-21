import type { BackgroundTask, TaskResult } from '@/lib/task-manager';

type SegmentResult = NonNullable<TaskResult['segments']>[number];

function asPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0;
}

export function summarizeLegacySegmentTask(
  task: BackgroundTask | null | undefined,
  segments: SegmentResult[],
) {
  const completed = segments.filter(segment => Boolean(segment.videoUrl));
  const failed = segments.filter(segment => segment.status === 'failed');
  const expectedSegmentCount = Math.max(
    segments.length,
    asPositiveInteger(task?.config?.segmentCount),
    asPositiveInteger(task?.result?.segmentCount),
  );

  return {
    segmentCount: expectedSegmentCount,
    snapshotSegmentCount: segments.length,
    successSegmentCount: completed.length,
    failedSegments: failed.map(segment => segment.index),
    missingSnapshotCount: Math.max(0, expectedSegmentCount - segments.length),
  };
}
