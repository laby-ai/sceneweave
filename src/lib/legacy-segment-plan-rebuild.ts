import { decomposeBySceneType, type SceneType } from '@/lib/prompt-decompose-service';
import { buildSegmentContinuityMemoryBlock } from '@/lib/segment-continuity-memory';
import { summarizeLegacySegmentTask } from '@/lib/legacy-segment-task-summary';
import type { TaskResult } from '@/lib/task-manager';

type SegmentResult = NonNullable<TaskResult['segments']>[number];
type LegacySegmentTaskLike = Parameters<typeof summarizeLegacySegmentTask>[0];

function asSceneType(value: unknown): SceneType {
  const text = String(value || '').trim();
  return ['portrait', 'product', 'landscape', 'food', 'drama', 'abstract', 'interior'].includes(text)
    ? text as SceneType
    : 'drama';
}

function buildPrompt(params: {
  originalPrompt: string;
  index: number;
  total: number;
  duration: number;
  sceneType: SceneType;
  previousPrompt?: string;
  nextPrompt?: string;
}) {
  const decomposed = decomposeBySceneType(
    params.originalPrompt,
    params.duration * params.total,
    params.total,
    params.sceneType
  );
  const segment = decomposed.segments[params.index];
  const basePrompt = segment
    ? [
      `【原始主题】\n${params.originalPrompt}`,
      `★ 【第${params.index + 1}/${params.total}段 - ${segment.phaseLabel}】`,
      segment.prompt,
    ].join('\n\n---\n\n')
    : `【原始主题】\n${params.originalPrompt}\n\n---\n\n★ 【第${params.index + 1}/${params.total}段】继续推进短剧视觉叙事，承接上一段并为下一段留下明确动作钩子。`;

  return [
    basePrompt,
    buildSegmentContinuityMemoryBlock({
      segmentIndex: params.index,
      totalSegments: params.total,
      currentPrompt: basePrompt,
      previousPrompt: params.previousPrompt,
      previousLastFrameAvailable: params.index > 0,
      nextPrompt: params.nextPrompt,
      visualAnchors: segment?.continuityAnchors || decomposed.visualAnchors || [],
    }),
  ].join('\n\n');
}

export function appendMissingLegacySegmentSnapshots(
  task: LegacySegmentTaskLike,
  segments: SegmentResult[]
) {
  if (!task) {
    return { changed: false, segments };
  }

  const summary = summarizeLegacySegmentTask(task, segments);
  if (segments.length >= summary.segmentCount) {
    return { changed: false, segments };
  }

  const prompt = typeof task.config?.prompt === 'string' ? task.config.prompt : '';
  if (!prompt.trim()) {
    return { changed: false, segments };
  }

  const segmentDuration = Number(task.config?.segmentDuration) || Number(segments[0]?.duration) || 10;
  const ratio = typeof task.config?.ratio === 'string' ? task.config.ratio : segments[0]?.ratio;
  const videoModel = typeof task.config?.videoModel === 'string' ? task.config.videoModel : segments[0]?.videoModel;
  const sceneType = asSceneType(task.config?.sceneType);
  const rebuiltSegments = [...segments];

  for (let index = segments.length; index < summary.segmentCount; index += 1) {
    rebuiltSegments.push({
      index,
      taskId: `segment-${index}`,
      status: 'pending',
      prompt: buildPrompt({
        originalPrompt: prompt,
        index,
        total: summary.segmentCount,
        duration: segmentDuration,
        sceneType,
        previousPrompt: rebuiltSegments[index - 1]?.prompt,
      }),
      duration: segmentDuration,
      ratio,
      videoModel,
    });
  }

  return { changed: true, segments: rebuiltSegments };
}
