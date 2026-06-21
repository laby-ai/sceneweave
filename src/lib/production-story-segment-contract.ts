import type { ProductionProject } from './production-project';
import type { ProductionSegmentAudioState } from './production-assembly-plan';
import type { ShotFrameContract } from './production-shot-frame-contract';
import type { ProductionArtifactReadiness } from './production-artifact-stale';

export interface StorySegmentContractReadiness {
  pass: boolean;
  blockers: string[];
  warnings: string[];
}

export interface StorySegmentContract {
  version: 'yh-story-segment-contract-v1';
  reference: {
    primary: 'Toonflow-app';
    secondary: ['ViMAX', 'ArcReel'];
    sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate';
  };
  segmentId: string;
  index: number;
  shotId: string;
  videoDesc: {
    visibleAction: string;
    visualCausality: string;
    entryState: string;
    exitState: string;
    continuityAnchors: string[];
    requiredAssetIds: string[];
  };
  storyState: {
    protagonist: string;
    currentGoal: string;
    conflict: string;
    obstacle: string;
    scene: string;
    keyProp: string;
    emotionalState: string;
    visibleStateChange: string;
  };
  audioContract: {
    dialogue: string | null;
    narration: string | null;
    soundDesign: string;
    voiceStyle: string;
    audioCue: string;
    previousAudioCue: string | null;
    requiresAudioContinuity: boolean;
    audioEventContract: {
      dialogueType: 'dialogue' | 'voiceover' | 'none';
      lipSyncPolicy: 'lip-sync-active' | 'silent-lips' | 'ambient-only';
      mustGenerateAudioTrack: boolean;
      expectedAudioEvidence: string[];
      providerInstruction: string;
    };
  };
  dependencyContract: {
    previousSegmentId: string | null;
    nextSegmentId: string | null;
    requiresPreviousLastFrame: boolean;
    expectedFirstFrameUrl: string | null;
    expectedPreviousLastFrameUrl: string | null;
    previousStoryStateCue: string | null;
    sourceSegmentId: string | null;
    sourceAssetId: string | null;
  };
  readiness: StorySegmentContractReadiness;
}

export interface BuildStorySegmentContractParams {
  productionProject: ProductionProject;
  segmentId: string;
  index: number;
  shot: ProductionProject['storyboard']['shots'][number];
  prompt: string;
  audioState: ProductionSegmentAudioState;
  shotFrameContract: ShotFrameContract;
  previousSegmentId: string | null;
  nextSegmentId: string | null;
}

export interface EvaluateStorySegmentStartReadinessParams {
  segment: {
    index: number;
    id: string;
    storySegmentContract?: StorySegmentContract;
    artifactReadiness?: ProductionArtifactReadiness;
    expectedInputs: {
      firstFrameUrl: string | null;
      previousLastFrameUrl: string | null;
      sourceSegmentId: string | null;
      sourceAssetId: string | null;
      previousAudioCue?: string | null;
      previousStoryStateCue?: string | null;
      bridgeFirstFrameUrl?: string | null;
      bridgeStrategy?: string | null;
    };
  };
  previousSegment?: {
    id: string;
    status: string;
    expectedOutputs: {
      videoUrl: string | null;
      lastFrameUrl: string | null;
      audioCue?: string | null;
      hasAudio?: boolean | null;
      storyStateCue?: string | null;
    };
  } | null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.map(value => String(value || '').trim()).find(Boolean) || '';
}

function assetName(project: ProductionProject, kind: string, fallback: string) {
  return project.assets.find(asset => asset.kind === kind)?.name || fallback;
}

function requiredAssetIds(contract: ShotFrameContract) {
  return Array.from(new Set([
    ...contract.firstFrame.requiredAssetIds,
    ...contract.lastFrame.requiredAssetIds,
  ])).filter(Boolean);
}

function buildReadiness(params: {
  prompt: string;
  shotFrameContract: ShotFrameContract;
  audioState: ProductionSegmentAudioState;
  storyState: StorySegmentContract['storyState'];
  audioEventContract: StorySegmentContract['audioContract']['audioEventContract'];
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!params.shotFrameContract.readiness.pass) {
    blockers.push('shot-frame-contract-not-ready');
  }
  if (params.shotFrameContract.firstFrame.continuityAnchors.length < 2) {
    blockers.push('entry-continuity-anchors-too-weak');
  }
  if (params.shotFrameContract.lastFrame.continuityAnchors.length < 2) {
    blockers.push('exit-continuity-anchors-too-weak');
  }
  if (!params.storyState.currentGoal || params.storyState.currentGoal.length < 8) {
    blockers.push('story-current-goal-too-weak');
  }
  if (!params.storyState.visibleStateChange || params.storyState.visibleStateChange.length < 10) {
    blockers.push('visible-state-change-too-weak');
  }
  if (!params.audioState.audioCue || params.audioState.audioCue.length < 10) {
    blockers.push('audio-cue-missing');
  }
  if (params.audioEventContract.mustGenerateAudioTrack && params.audioEventContract.expectedAudioEvidence.length === 0) {
    blockers.push('audio-event-evidence-missing');
  }
  if (!params.audioState.dialogue && !params.audioState.narration) {
    warnings.push('segment-has-no-dialogue-or-narration');
  }
  if (!params.prompt.includes('【动作因果】') || !params.prompt.includes('【操作结果】')) {
    blockers.push('prompt-missing-visual-causality');
  }

  return {
    pass: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function buildAudioEventContract(
  audioState: ProductionSegmentAudioState
): StorySegmentContract['audioContract']['audioEventContract'] {
  const dialogue = firstNonEmpty(audioState.dialogue);
  const narration = firstNonEmpty(audioState.narration);
  const soundDesign = firstNonEmpty(audioState.soundDesign, audioState.audioCue);
  const hasDialogue = Boolean(dialogue);
  const hasNarration = Boolean(narration);
  const dialogueType = hasDialogue ? 'dialogue' : hasNarration ? 'voiceover' : 'none';
  const lipSyncPolicy = hasDialogue ? 'lip-sync-active' : hasNarration ? 'silent-lips' : 'ambient-only';
  const expectedAudioEvidence = [
    hasDialogue ? `对白原文=${dialogue}` : '',
    hasNarration ? `旁白原文=${narration}` : '',
    soundDesign ? `环境音/音效=${soundDesign}` : '',
    audioState.voiceStyle ? `音色/语气=${audioState.voiceStyle}` : '',
  ].filter(Boolean);
  const providerInstruction = [
    dialogueType === 'dialogue'
      ? `保留对白原文“${dialogue}”，角色口型必须和对白同步。`
      : dialogueType === 'voiceover'
        ? `保留旁白原文“${narration}”，角色嘴唇保持自然静默，不生成错误口型。`
        : '本段无对白/旁白，角色嘴唇保持自然静默，只保留环境声和动作声。',
    soundDesign ? `环境声和音效必须可听见：${soundDesign}` : '',
    audioState.voiceStyle ? `角色声线/情绪：${audioState.voiceStyle}` : '',
  ].filter(Boolean).join(' ');

  return {
    dialogueType,
    lipSyncPolicy,
    mustGenerateAudioTrack: expectedAudioEvidence.length > 0,
    expectedAudioEvidence,
    providerInstruction,
  };
}

export function buildStorySegmentContract(params: BuildStorySegmentContractParams): StorySegmentContract {
  const {
    productionProject,
    segmentId,
    index,
    shot,
    prompt,
    audioState,
    shotFrameContract,
    previousSegmentId,
    nextSegmentId,
  } = params;
  const protagonist = productionProject.storyBible.protagonist;
  const scene = assetName(productionProject, 'scene', '主要场景');
  const keyProp = assetName(productionProject, 'prop', '关键道具');
  const storyState = {
    protagonist,
    currentGoal: firstNonEmpty(shot.dramaticPurpose, productionProject.storyBible.desire),
    conflict: productionProject.storyBible.conflict,
    obstacle: productionProject.storyBible.obstacle,
    scene,
    keyProp,
    emotionalState: audioState.emotion || shot.emotionShift || productionProject.storyBible.emotionalArc.shift,
    visibleStateChange: shotFrameContract.visualStoryEvidence.operationResultEvidence,
  };
  const audioEventContract = buildAudioEventContract(audioState);
  const readiness = buildReadiness({ prompt, shotFrameContract, audioState, storyState, audioEventContract });

  return {
    version: 'yh-story-segment-contract-v1',
    reference: {
      primary: 'Toonflow-app',
      secondary: ['ViMAX', 'ArcReel'],
      sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate',
    },
    segmentId,
    index,
    shotId: shot.id,
    videoDesc: {
      visibleAction: shotFrameContract.motionDescription,
      visualCausality: [
        shotFrameContract.visualStoryEvidence.conflictEvidence,
        shotFrameContract.visualStoryEvidence.operationResultEvidence,
        shotFrameContract.visualStoryEvidence.endingHookEvidence,
      ].join(' '),
      entryState: shotFrameContract.handoff.entryContinuity,
      exitState: shotFrameContract.handoff.exitContinuity,
      continuityAnchors: Array.from(new Set([
        ...shotFrameContract.firstFrame.continuityAnchors,
        ...shotFrameContract.lastFrame.continuityAnchors,
      ])).filter(Boolean),
      requiredAssetIds: requiredAssetIds(shotFrameContract),
    },
    storyState,
    audioContract: {
      dialogue: audioState.dialogue,
      narration: audioState.narration,
      soundDesign: audioState.soundDesign,
      voiceStyle: audioState.voiceStyle,
      audioCue: audioState.audioCue,
      previousAudioCue: null,
      requiresAudioContinuity: index > 0,
      audioEventContract,
    },
    dependencyContract: {
      previousSegmentId,
      nextSegmentId,
      requiresPreviousLastFrame: index > 0,
      expectedFirstFrameUrl: null,
      expectedPreviousLastFrameUrl: null,
      previousStoryStateCue: null,
      sourceSegmentId: previousSegmentId,
      sourceAssetId: null,
    },
    readiness,
  };
}

export function evaluateStorySegmentStartReadiness(
  params: EvaluateStorySegmentStartReadinessParams
): StorySegmentContractReadiness {
  const { segment, previousSegment } = params;
  const contract = segment.storySegmentContract;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (segment.artifactReadiness?.stale) {
    blockers.push(...(segment.artifactReadiness.blockers.length > 0
      ? segment.artifactReadiness.blockers
      : ['artifact-stale-after-project-writeback']));
  }

  if (!contract) {
    return {
      pass: false,
      blockers: ['missing-story-segment-contract'],
      warnings,
    };
  }

  blockers.push(...contract.readiness.blockers);
  warnings.push(...contract.readiness.warnings);

  if (segment.index > 0) {
    const previousLastFrameUrl = previousSegment?.expectedOutputs.lastFrameUrl || null;
    const previousAudioCue = previousSegment?.expectedOutputs.audioCue || null;
    const previousStoryStateCue = previousSegment?.expectedOutputs.storyStateCue || null;
    if (!previousSegment || previousSegment.status !== 'completed') {
      blockers.push('previous-segment-not-completed');
    }
    if (!previousSegment?.expectedOutputs.videoUrl) {
      blockers.push('previous-video-url-missing');
    }
    if (!previousLastFrameUrl) {
      blockers.push('previous-last-frame-missing');
    }
    const usesDirectPreviousTail = segment.expectedInputs.firstFrameUrl === previousLastFrameUrl;
    const usesBoundaryBridge = segment.expectedInputs.bridgeStrategy === 'transition-bridge'
      && segment.expectedInputs.firstFrameUrl === segment.expectedInputs.bridgeFirstFrameUrl
      && segment.expectedInputs.previousLastFrameUrl === previousLastFrameUrl;
    if (!usesDirectPreviousTail && !usesBoundaryBridge) {
      blockers.push('first-frame-does-not-match-previous-last-frame');
    }
    if (segment.expectedInputs.previousLastFrameUrl !== previousLastFrameUrl) {
      blockers.push('previous-last-frame-input-mismatch');
    }
    if (!segment.expectedInputs.sourceSegmentId || segment.expectedInputs.sourceSegmentId !== previousSegment?.id) {
      blockers.push('source-segment-writeback-missing');
    }
    if (!segment.expectedInputs.sourceAssetId) {
      blockers.push('source-asset-writeback-missing');
    }
    if (!previousStoryStateCue) {
      blockers.push('previous-story-state-cue-missing');
    }
    if (segment.expectedInputs.previousStoryStateCue !== previousStoryStateCue) {
      blockers.push('previous-story-state-cue-input-mismatch');
    }
    if (contract.audioContract.requiresAudioContinuity) {
      if (!previousAudioCue) blockers.push('previous-audio-cue-missing');
      if (segment.expectedInputs.previousAudioCue !== previousAudioCue) {
        blockers.push('previous-audio-cue-input-mismatch');
      }
    }
  }

  return {
    pass: blockers.length === 0,
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
  };
}

export function patchStorySegmentContractInputs(params: {
  contract: StorySegmentContract;
  firstFrameUrl?: string | null;
  previousLastFrameUrl?: string | null;
  sourceSegmentId?: string | null;
  sourceAssetId?: string | null;
  previousAudioCue?: string | null;
  previousStoryStateCue?: string | null;
}): StorySegmentContract {
  return {
    ...params.contract,
    audioContract: {
      ...params.contract.audioContract,
      previousAudioCue: params.previousAudioCue ?? params.contract.audioContract.previousAudioCue,
    },
    dependencyContract: {
      ...params.contract.dependencyContract,
      expectedFirstFrameUrl: params.firstFrameUrl ?? params.contract.dependencyContract.expectedFirstFrameUrl,
      expectedPreviousLastFrameUrl: params.previousLastFrameUrl ?? params.contract.dependencyContract.expectedPreviousLastFrameUrl,
      previousStoryStateCue: params.previousStoryStateCue ?? params.contract.dependencyContract.previousStoryStateCue,
      sourceSegmentId: params.sourceSegmentId ?? params.contract.dependencyContract.sourceSegmentId,
      sourceAssetId: params.sourceAssetId ?? params.contract.dependencyContract.sourceAssetId,
    },
  };
}

export function describeStorySegmentCue(contract: StorySegmentContract) {
  return [
    `主角=${contract.storyState.protagonist}`,
    `目标=${contract.storyState.currentGoal}`,
    `冲突=${contract.storyState.conflict}`,
    `障碍=${contract.storyState.obstacle}`,
    `场景=${contract.storyState.scene}`,
    `道具=${contract.storyState.keyProp}`,
    `情绪=${contract.storyState.emotionalState}`,
    `状态变化=${contract.storyState.visibleStateChange}`,
    `出口画面=${contract.videoDesc.exitState}`,
    `声音=${contract.audioContract.audioCue}`,
    `声音事件=${contract.audioContract.audioEventContract.providerInstruction}`,
  ].join('；');
}
