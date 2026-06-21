import type { ProductionAssemblyPlan, ProductionSegmentPlan } from './production-assembly-plan';
import { evaluateStorySegmentStartReadiness } from './production-story-segment-contract';
import type { TaskResult } from './task-manager';

type LegacySegment = NonNullable<TaskResult['segments']>[number];

export interface SegmentTransitionReadiness {
  ok: boolean;
  segmentIndex: number;
  dependencySegmentIndex: number | null;
  dependencySegmentId: string | null;
  dependencyTaskId: string | null;
  firstFrameUrl: string | null;
  previousLastFrameUrl: string | null;
  continuityPrompt: string;
  storyContractReady?: boolean;
  storyContractBlockers?: string[];
  storyContractWarnings?: string[];
  reason?: string;
}

function segmentPromptPrefix(index: number) {
  return index === 0
    ? '第一段建立主角、场景和关键道具，不需要上一段尾帧。'
    : '本段开头1-2秒必须复现上一段尾帧中的角色站位、视线方向、手部动作和关键道具状态，再推进新信息。';
}

function normalizeContinuityPrompt(index: number, prompt?: string | null) {
  const base = String(prompt || '').trim();
  const required = segmentPromptPrefix(index);
  if (!base) return required;
  if (index === 0) return base;
  return base.includes('开头1-2秒') ? base : `${base}${base.endsWith('。') ? '' : '。'}${required}`;
}

export function buildAssemblySegmentDependencyConfig(params: {
  assemblyPlan: ProductionAssemblyPlan;
  segment: ProductionSegmentPlan;
  childTaskId: string;
  previousChildTaskId: string | null;
}) {
  const { assemblyPlan, segment, childTaskId, previousChildTaskId } = params;
  const previousSegment = assemblyPlan.segments.find(item => item.index === segment.index - 1) || null;
  const dependencyGroup = `${assemblyPlan.productionProjectId}:assembly-segments`;

  return {
    assemblyDependency: {
      version: 'yh-segment-dependency-v1',
      resourceId: segment.id,
      taskId: childTaskId,
      dependencyResourceId: previousSegment?.id || null,
      dependencyTaskId: previousChildTaskId,
      dependencyGroup,
      dependencyIndex: segment.index,
      requiresPreviousLastFrame: segment.index > 0,
      firstFrameUrl: segment.expectedInputs.firstFrameUrl || null,
      previousLastFrameUrl: segment.expectedInputs.previousLastFrameUrl || null,
      continuityPrompt: normalizeContinuityPrompt(segment.index, segment.expectedInputs.continuityPrompt),
    },
    dependencyTaskId: previousChildTaskId,
    dependencyResourceId: previousSegment?.id || null,
    dependencyGroup,
    dependencyIndex: segment.index,
    requiresPreviousLastFrame: segment.index > 0,
    firstFrameUrl: segment.expectedInputs.firstFrameUrl || null,
    previousLastFrameUrl: segment.expectedInputs.previousLastFrameUrl || null,
  };
}

export function evaluateProductionSegmentTransition(
  assemblyPlan: ProductionAssemblyPlan,
  segmentIndex: number,
): SegmentTransitionReadiness {
  const segment = assemblyPlan.segments.find(item => item.index === segmentIndex);
  if (!segment) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: null,
      dependencySegmentId: null,
      dependencyTaskId: null,
      firstFrameUrl: null,
      previousLastFrameUrl: null,
      continuityPrompt: '',
      reason: '未找到目标片段。',
    };
  }

  if (segmentIndex <= 0) {
    const storyReadiness = evaluateStorySegmentStartReadiness({ segment, previousSegment: null });
    if (!storyReadiness.pass) {
      return {
        ok: false,
        segmentIndex,
        dependencySegmentIndex: null,
        dependencySegmentId: null,
        dependencyTaskId: null,
        firstFrameUrl: segment.expectedInputs.firstFrameUrl || null,
        previousLastFrameUrl: null,
        continuityPrompt: normalizeContinuityPrompt(0, segment.expectedInputs.continuityPrompt),
        storyContractReady: false,
        storyContractBlockers: storyReadiness.blockers,
        storyContractWarnings: storyReadiness.warnings,
        reason: `第 ${segmentIndex + 1} 段 StorySegmentContract 未通过，不能启动真实生成。`,
      };
    }
    return {
      ok: true,
      segmentIndex,
      dependencySegmentIndex: null,
      dependencySegmentId: null,
      dependencyTaskId: null,
      firstFrameUrl: segment.expectedInputs.firstFrameUrl || null,
      previousLastFrameUrl: null,
      continuityPrompt: normalizeContinuityPrompt(0, segment.expectedInputs.continuityPrompt),
      storyContractReady: true,
      storyContractBlockers: [],
      storyContractWarnings: storyReadiness.warnings,
    };
  }

  const previous = assemblyPlan.segments.find(item => item.index === segmentIndex - 1);
  if (!previous) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: null,
      dependencyTaskId: null,
      firstFrameUrl: null,
      previousLastFrameUrl: null,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex, segment.expectedInputs.continuityPrompt),
      reason: `第 ${segmentIndex + 1} 段依赖第 ${segmentIndex} 段，但上一段计划不存在。`,
    };
  }

  const previousTaskId = previous.expectedOutputs.taskId || null;
  const previousVideoUrl = previous.expectedOutputs.videoUrl || null;
  const previousLastFrameUrl = previous.expectedOutputs.lastFrameUrl || null;
  const firstFrameUrl = segment.expectedInputs.firstFrameUrl || null;
  const previousInputUrl = segment.expectedInputs.previousLastFrameUrl || null;
  const storyReadiness = evaluateStorySegmentStartReadiness({ segment, previousSegment: previous });
  const boundaryBridge = assemblyPlan.boundaryBridgePlan?.boundaries.find(boundary =>
    boundary.nextSegmentId === segment.id || boundary.index === segment.index - 1
  ) || null;

  if (previous.status !== 'completed' || !previousVideoUrl) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: previous.id,
      dependencyTaskId: previousTaskId,
      firstFrameUrl,
      previousLastFrameUrl: previousInputUrl,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex, segment.expectedInputs.continuityPrompt),
      storyContractReady: storyReadiness.pass,
      storyContractBlockers: storyReadiness.blockers,
      storyContractWarnings: storyReadiness.warnings,
      reason: `第 ${segmentIndex + 1} 段依赖第 ${segmentIndex} 段完成结果，但上一段尚未 completed 且写回 videoUrl。`,
    };
  }

  if (!previousLastFrameUrl) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: previous.id,
      dependencyTaskId: previousTaskId,
      firstFrameUrl,
      previousLastFrameUrl: previousInputUrl,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex, segment.expectedInputs.continuityPrompt),
      storyContractReady: storyReadiness.pass,
      storyContractBlockers: storyReadiness.blockers,
      storyContractWarnings: storyReadiness.warnings,
      reason: `第 ${segmentIndex + 1} 段依赖第 ${segmentIndex} 段尾帧，但上一段缺少 lastFrameUrl，不能启动真实生成。`,
    };
  }

  const usesDirectPreviousTail = firstFrameUrl === previousLastFrameUrl
    && previousInputUrl === previousLastFrameUrl;
  const usesGeneratedBoundaryBridge = segment.expectedInputs.bridgeStrategy === 'transition-bridge'
    && firstFrameUrl === segment.expectedInputs.bridgeFirstFrameUrl
    && previousInputUrl === previousLastFrameUrl
    && boundaryBridge?.status === 'generated'
    && boundaryBridge.sourceLastFrameUrl === previousLastFrameUrl
    && boundaryBridge.newCameraImageUrl === firstFrameUrl
    && Boolean(boundaryBridge.bridgeVideoUrl);

  if (!usesDirectPreviousTail && !usesGeneratedBoundaryBridge) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: previous.id,
      dependencyTaskId: previousTaskId,
      firstFrameUrl,
      previousLastFrameUrl: previousInputUrl,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex, segment.expectedInputs.continuityPrompt),
      storyContractReady: storyReadiness.pass,
      storyContractBlockers: storyReadiness.blockers,
      storyContractWarnings: storyReadiness.warnings,
      reason: `第 ${segmentIndex + 1} 段既没有直接使用第 ${segmentIndex} 段 lastFrameUrl，也没有使用已生成 boundary bridge 的 new-camera image，拒绝仅靠 prompt 衔接。`,
    };
  }

  if (!storyReadiness.pass) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: previous.id,
      dependencyTaskId: previousTaskId,
      firstFrameUrl,
      previousLastFrameUrl: previousInputUrl,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex, segment.expectedInputs.continuityPrompt),
      storyContractReady: false,
      storyContractBlockers: storyReadiness.blockers,
      storyContractWarnings: storyReadiness.warnings,
      reason: `第 ${segmentIndex + 1} 段 StorySegmentContract 未通过，拒绝只靠尾帧 URL 启动。`,
    };
  }

  return {
    ok: true,
    segmentIndex,
    dependencySegmentIndex: segmentIndex - 1,
    dependencySegmentId: previous.id,
    dependencyTaskId: previousTaskId,
    firstFrameUrl,
    previousLastFrameUrl,
    continuityPrompt: normalizeContinuityPrompt(segmentIndex, segment.expectedInputs.continuityPrompt),
    storyContractReady: true,
    storyContractBlockers: [],
    storyContractWarnings: storyReadiness.warnings,
  };
}

export function evaluateLegacySegmentTransition(
  segments: LegacySegment[],
  segmentIndex: number,
): SegmentTransitionReadiness {
  const segment = segments.find(item => item.index === segmentIndex);
  if (!segment) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: null,
      dependencySegmentId: null,
      dependencyTaskId: null,
      firstFrameUrl: null,
      previousLastFrameUrl: null,
      continuityPrompt: '',
      reason: '未找到目标片段。',
    };
  }

  if (segmentIndex <= 0) {
    return {
      ok: true,
      segmentIndex,
      dependencySegmentIndex: null,
      dependencySegmentId: null,
      dependencyTaskId: null,
      firstFrameUrl: null,
      previousLastFrameUrl: null,
      continuityPrompt: normalizeContinuityPrompt(0),
    };
  }

  const previous = segments.find(item => item.index === segmentIndex - 1);
  const previousLastFrameUrl = previous?.lastFrameUrl || null;
  const previousVideoUrl = previous?.videoUrl || null;

  if (!previous || !previousVideoUrl) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: previous ? `segment-${previous.index + 1}` : null,
      dependencyTaskId: previous?.taskId || null,
      firstFrameUrl: null,
      previousLastFrameUrl: null,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex),
      reason: `第 ${segmentIndex + 1} 段依赖第 ${segmentIndex} 段，但上一段尚未完成 videoUrl。`,
    };
  }

  if (!previousLastFrameUrl) {
    return {
      ok: false,
      segmentIndex,
      dependencySegmentIndex: segmentIndex - 1,
      dependencySegmentId: `segment-${previous.index + 1}`,
      dependencyTaskId: previous.taskId || null,
      firstFrameUrl: null,
      previousLastFrameUrl: null,
      continuityPrompt: normalizeContinuityPrompt(segmentIndex),
      reason: `第 ${segmentIndex + 1} 段依赖第 ${segmentIndex} 段尾帧，但上一段缺少 lastFrameUrl，不能直接生成后段。`,
    };
  }

  return {
    ok: true,
    segmentIndex,
    dependencySegmentIndex: segmentIndex - 1,
    dependencySegmentId: `segment-${previous.index + 1}`,
    dependencyTaskId: previous.taskId || null,
    firstFrameUrl: previousLastFrameUrl,
    previousLastFrameUrl,
    continuityPrompt: normalizeContinuityPrompt(segmentIndex),
  };
}
