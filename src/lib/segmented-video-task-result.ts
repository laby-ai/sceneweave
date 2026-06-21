import type { TaskResult } from '@/lib/task-manager';

export interface SegmentSnapshot {
  segmentIndex: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  prompt?: string;
  duration?: number;
  ratio?: string;
  videoModel?: string;
  providerTaskId?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
}

export function buildPartialSegmentResult(segments: SegmentSnapshot[]): TaskResult {
  const completedSegments = segments.filter(segment => segment.status === 'completed' || Boolean(segment.videoUrl));
  return {
    isPartial: true,
    segmentCount: segments.length,
    successSegmentCount: completedSegments.length,
    segments: segments.map(segment => ({
      index: segment.segmentIndex,
      taskId: `segment-${segment.segmentIndex}`,
      status: segment.status || (segment.videoUrl ? 'completed' : 'pending'),
      prompt: segment.prompt,
      duration: segment.duration,
      ratio: segment.ratio,
      videoModel: segment.videoModel,
      providerTaskId: segment.providerTaskId,
      videoUrl: segment.videoUrl,
      lastFrameUrl: segment.lastFrameUrl,
      error: segment.error,
    })),
    failedSegments: segments
      .filter(segment => segment.status === 'failed')
      .map(segment => segment.segmentIndex),
  };
}
