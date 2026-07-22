import type { ProductionSegmentPlan } from '@/lib/production-assembly-plan';
import type { VimaxAgentReferenceAsset } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';

export interface VimaxCanonicalFirstFrameState {
  version: 'sceneweave-canonical-first-frame-v1';
  status: 'ready' | 'failed';
  artifactVersion: string;
  imageUrl: string | null;
  sourcePreviousLastFrameUrl: string | null;
  sourceReferenceUrls: string[];
  imageModel?: string;
  compiledAt?: string;
  error?: string;
}

export interface VimaxCanonicalFirstFrameSpec {
  version: 'sceneweave-canonical-first-frame-v1';
  ready: boolean;
  blockers: string[];
  artifactVersion: string;
  sourcePreviousLastFrameUrl: string | null;
  referenceImages: string[];
  firstFrameImage: string | null;
  strategy: 'direct-previous-tail' | 'approved-shot-reference';
  prompt: string;
}

function uniqueUrls(values: Array<string | null | undefined>) {
  return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export function buildVimaxCanonicalFirstFrameSpec(input: {
  segment: ProductionSegmentPlan;
  artifactVersion: string;
  referenceAssets: VimaxAgentReferenceAsset[];
  continuityPrompt?: string;
}): VimaxCanonicalFirstFrameSpec {
  const shotAsset = input.referenceAssets.find(asset => asset.kind === 'shot'
    && asset.shotIndex === input.segment.index + 1
    && asset.url);
  const previousTail = input.segment.expectedInputs.previousLastFrameUrl || null;
  const subjectViews = shotAsset?.selectedSubjectViews?.map(view => view.url) || [];
  const referenceImages = uniqueUrls([previousTail, shotAsset?.url, ...subjectViews]);
  const requiresPreviousTail = input.segment.generationRoute?.requiresPreviousLastFrame
    ?? input.segment.index > 0;
  const firstFrameImage = requiresPreviousTail ? previousTail : shotAsset?.url || null;
  const blockers = [
    requiresPreviousTail && !previousTail ? 'previous-tail-missing' : null,
    !requiresPreviousTail && !shotAsset?.url ? 'approved-shot-reference-missing' : null,
    !firstFrameImage ? 'canonical-frame-reference-missing' : null,
  ].filter((value): value is string => Boolean(value));
  const contract = input.segment.shotFrameContract;

  return {
    version: 'sceneweave-canonical-first-frame-v1',
    ready: blockers.length === 0,
    blockers,
    artifactVersion: input.artifactVersion,
    sourcePreviousLastFrameUrl: previousTail,
    referenceImages,
    firstFrameImage,
    strategy: requiresPreviousTail ? 'direct-previous-tail' : 'approved-shot-reference',
    prompt: [
      `为短剧镜头 ${input.segment.index + 1} 编译唯一权威首帧。`,
      previousTail
        ? '第一张参考是上一镜真实尾帧：继承人物身份、服饰、道具状态、空间方向和光色，但不要照抄上一镜构图。'
        : '本镜没有上一镜尾帧，以批准的角色、场景和道具版本建立开场。',
      '其余参考图均为当前项目已批准版本；不得换人、换服饰、换关键道具或改变画风。',
      `目标首帧：${contract.firstFrame.description}`,
      `动作承接：${contract.handoff.entryContinuity}`,
      `本镜动作：${contract.motionDescription}`,
      `冲突证据：${contract.visualStoryEvidence.conflictEvidence}`,
      input.continuityPrompt ? `当前批准版本连续性：${input.continuityPrompt}` : '',
      '输出单张16:9电影分镜首帧，不要字幕、拼图、边框、水印或角色设定板。',
    ].filter(Boolean).join('\n'),
  };
}

export function evaluateVimaxCanonicalFirstFrameReadiness(input: {
  state?: VimaxCanonicalFirstFrameState;
  artifactVersion: string;
  requiresPreviousLastFrame: boolean;
  previousLastFrameUrl: string | null;
}): { ok: true; imageUrl: string } | { ok: false; code: string } {
  if (!input.state || input.state.status !== 'ready' || !input.state.imageUrl) {
    return { ok: false, code: 'canonical-first-frame-not-ready' };
  }
  if (input.state.artifactVersion !== input.artifactVersion) {
    return { ok: false, code: 'canonical-first-frame-stale' };
  }
  if (input.requiresPreviousLastFrame
    && input.state.sourcePreviousLastFrameUrl !== input.previousLastFrameUrl) {
    return { ok: false, code: 'canonical-first-frame-source-changed' };
  }
  if (input.requiresPreviousLastFrame && input.state.imageUrl !== input.previousLastFrameUrl) {
    return { ok: false, code: 'canonical-first-frame-not-direct-tail' };
  }
  return { ok: true, imageUrl: input.state.imageUrl };
}

export async function compileVimaxCanonicalFirstFrame(input: {
  segment: ProductionSegmentPlan;
  artifactVersion: string;
  referenceAssets: VimaxAgentReferenceAsset[];
  continuityPrompt?: string;
}): Promise<VimaxCanonicalFirstFrameState> {
  const spec = buildVimaxCanonicalFirstFrameSpec(input);
  if (!spec.ready || !spec.firstFrameImage) {
    throw new Error(`权威首帧素材未就绪：${spec.blockers.join(', ')}。未提交视频任务。`);
  }
  return {
    version: spec.version,
    status: 'ready',
    artifactVersion: spec.artifactVersion,
    imageUrl: spec.firstFrameImage,
    sourcePreviousLastFrameUrl: spec.sourcePreviousLastFrameUrl,
    sourceReferenceUrls: [spec.firstFrameImage],
    compiledAt: new Date().toISOString(),
  };
}
