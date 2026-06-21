import {
  applyBoundaryBridgeArtifactWriteback,
  buildProductionBoundaryBridgeStartPayload,
  ProductionBoundaryBridgeStartError,
} from '../src/lib/production-boundary-bridge-start';
import { buildProductionSegmentStartPayload } from '../src/lib/production-segment-start-payload';
import { evaluateProductionSegmentTransition } from '../src/lib/production-segment-transition';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeAudioState(index: number) {
  const dialogue = index === 0 ? '风声压不住鼓点。' : null;
  const soundDesign = index === 0 ? '夜风、远鼓、旌旗猎猎声。' : '远鼓延续，城门铁链轻响。';
  return {
    dialogue,
    narration: null,
    soundDesign,
    voiceStyle: dialogue ? '低沉克制的青年男声，气息短促。' : '无对白，保留呼吸和环境声。',
    emotion: index === 0 ? '隐忍' : '紧绷',
    audioCue: `情绪=${index === 0 ? '隐忍' : '紧绷'}；对白=${dialogue || '无'}；旁白=无；声音=${soundDesign}`,
  };
}

function makeStorySegmentContract(index: number) {
  const audioState = makeAudioState(index);
  return {
    version: 'yh-story-segment-contract-v1',
    reference: {
      primary: 'Toonflow-app',
      secondary: ['ViMAX', 'ArcReel'],
      sourceMechanism: 'FlowData.videoDesc + storyboard/assets-video writeback + 承接上镜',
    },
    segmentId: `five-dynasties-segment-${index + 1}`,
    index,
    shotId: `shot-${index + 1}`,
    videoDesc: {
      visibleAction: index === 0 ? '将军把半卷山河图压在火盆旁。' : '镜头承接火光，推到城门外的换旗瞬间。',
      visualCausality: index === 0 ? '山河图红印改变，风声和鼓点把视线推向城门。' : '换旗动作让观众看见政权更替的压力。',
      entryState: index === 0 ? '火光、山河图和将军手部动作建立历史压力。' : '承接上一段尾帧的火光和山河图方向。',
      exitState: index === 0 ? '尾帧停在山河图红印和城门影子同框。' : '尾帧停在旗帜、城门和远处马蹄。',
      continuityAnchors: ['山河图', '城门影子', '夜风', '军旗'],
      requiredAssetIds: ['character-general', 'scene-gate', 'prop-map'],
    },
    storyState: {
      protagonist: '无名将军',
      currentGoal: index === 0 ? '守住最后一卷山河图' : '承接上一段判断城门是否已失',
      conflict: '五代更替迫近，旧旗即将落下',
      obstacle: '夜雨、急报和城门封锁',
      scene: '梁唐交替的城门与营帐',
      keyProp: '半卷山河图',
      emotionalState: audioState.emotion,
      visibleStateChange: index === 0 ? '山河图红印被火光照亮' : '旧旗落下，新旗升起',
    },
    audioContract: {
      dialogue: audioState.dialogue,
      narration: audioState.narration,
      soundDesign: audioState.soundDesign,
      voiceStyle: audioState.voiceStyle,
      audioCue: audioState.audioCue,
      previousAudioCue: null,
      requiresAudioContinuity: index > 0,
      audioEventContract: {
        dialogueType: audioState.dialogue ? 'dialogue' : 'none',
        lipSyncPolicy: audioState.dialogue ? 'lip-sync-active' : 'ambient-only',
        mustGenerateAudioTrack: true,
        expectedAudioEvidence: [`声音=${audioState.soundDesign}`, `音色=${audioState.voiceStyle}`],
        providerInstruction: audioState.dialogue
          ? `保留对白“${audioState.dialogue}”，环境声必须可听见：${audioState.soundDesign}`
          : `本段无对白/旁白，只保留环境声和动作声：${audioState.soundDesign}`,
      },
    },
    dependencyContract: {
      previousSegmentId: index > 0 ? 'five-dynasties-segment-1' : null,
      nextSegmentId: index === 0 ? 'five-dynasties-segment-2' : null,
      requiresPreviousLastFrame: index > 0,
      expectedFirstFrameUrl: null,
      expectedPreviousLastFrameUrl: null,
      previousStoryStateCue: null,
      sourceSegmentId: index > 0 ? 'five-dynasties-segment-1' : null,
      sourceAssetId: null,
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  };
}

function makeShotFrameContract(index: number) {
  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc + lf_desc + transition video new-camera image',
    },
    shotId: `shot-${index + 1}`,
    shotIndex: index,
    variationType: 'medium',
    variationReason: 'QA keeps first/last frame handoff explicit.',
    firstFrame: {
      description: index === 0 ? '首帧看见火盆、山河图和将军手部。' : '首帧承接上一段火光和山河图方向，切到城门换旗。',
      visibleCharacterIds: ['character-general'],
      requiredAssetIds: ['character-general', 'scene-gate', 'prop-map'],
      continuityAnchors: ['山河图', '火光', '军旗'],
    },
    lastFrame: {
      description: index === 0 ? '尾帧停在山河图红印和城门影子同框。' : '尾帧停在新旗、城门和远处马蹄。',
      visibleCharacterIds: ['character-general'],
      requiredAssetIds: ['character-general', 'scene-gate', 'prop-map'],
      continuityAnchors: ['山河图', '城门影子', '军旗'],
    },
    motionDescription: index === 0 ? '镜头从火盆推向山河图红印。' : '镜头沿火光方向推到城门换旗。',
    audioDescription: makeAudioState(index).soundDesign,
    visualStoryEvidence: {
      threatTarget: '城门和山河图必须可见。',
      conflictEvidence: '旧旗、急报和山河图红印形成冲突。',
      operationResultEvidence: index === 0 ? '山河图红印被火光照亮。' : '旧旗落下，新旗升起。',
      endingHookEvidence: index === 0 ? '尾帧留下城门影子给下一段承接。' : '尾帧留下远处马蹄。',
      viewerReadabilityTest: '观众不看字幕也能看懂更替压力来自哪里。',
    },
    handoff: {
      requiresPreviousLastFrame: index > 0,
      previousShotId: index > 0 ? 'shot-1' : null,
      nextShotId: index === 0 ? 'shot-2' : null,
      entryContinuity: index === 0 ? '建立火光、山河图和将军手部。' : '承接上一段尾帧的火光和城门影子。',
      exitContinuity: index === 0 ? '尾帧停在山河图红印和城门影子。' : '尾帧停在旗帜和远处马蹄。',
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  };
}

function makeSegment(index: number, status: 'queued' | 'completed', lastFrameUrl: string | null) {
  const audioState = makeAudioState(index);
  return {
    id: `five-dynasties-segment-${index + 1}`,
    index,
    shotId: `shot-${index + 1}`,
    duration: 10,
    prompt: index === 0 ? '火盆旁山河图红印亮起。' : '承接火光推到城门换旗。',
    status,
    dependencies: {
      characterAssetIds: ['character-general'],
      sceneAssetIds: ['scene-gate'],
      propAssetIds: ['prop-map'],
    },
    expectedInputs: {
      firstFrameUrl: null,
      previousLastFrameUrl: index > 0 ? lastFrameUrl : null,
      sourceSegmentId: index > 0 ? 'five-dynasties-segment-1' : null,
      sourceAssetId: index > 0 ? 'video-segment-1' : null,
      continuityPrompt: index > 0 ? '等待 bridge artifact 写回 new-camera image。' : '建立开场。',
      previousAudioCue: null,
      audioContinuityPrompt: index > 0 ? '等待声音桥接。' : '建立声音基调。',
      previousStoryStateCue: null,
      storyContinuityPrompt: index > 0 ? '等待故事状态桥接。' : '建立故事状态。',
      boundaryBridgeId: index > 0 ? 'five-dynasties-boundary-1-2' : null,
      boundaryBridgePrompt: index > 0 ? '边界桥接 1->2：保持山河图、火光、城门影子，用动作匹配过渡。' : null,
      bridgeFirstFrameUrl: null,
      bridgeStrategy: index > 0 ? 'transition-bridge' : null,
    },
    expectedOutputs: {
      videoUrl: status === 'completed' ? 'https://example.invalid/seg1.mp4' : null,
      lastFrameUrl,
      taskId: status === 'completed' ? 'task-seg1' : null,
      providerTaskId: status === 'completed' ? 'provider-seg1' : null,
      audioCue: audioState.audioCue,
      hasAudio: status === 'completed' ? true : null,
      storyStateCue: '主角=无名将军；目标=守住最后一卷山河图；冲突=五代更替迫近；出口画面=山河图红印和城门影子同框；声音=夜风、远鼓、旌旗猎猎声。',
    },
    audioState,
    shotFrameContract: makeShotFrameContract(index),
    storySegmentContract: makeStorySegmentContract(index),
    retryPolicy: {
      maxRetries: 2,
      retryable: true,
      fallback: '保留已完成片段，只重试失败边界。',
    },
  };
}

function makeAssemblyPlan(includeLastFrame = true): any {
  const lastFrameUrl = includeLastFrame ? 'https://example.invalid/seg1-last.jpg' : null;
  return {
    version: 'yh-assembly-plan-v1',
    reference: {
      primary: 'ArcReel',
      adaptedIdeas: ['dependency claim gate', 'boundary bridge artifact'],
    },
    productionProjectId: 'five-dynasties',
    sourceTaskId: 'parent-task',
    totalDuration: 20,
    segmentCount: 2,
    segmentDurationHint: 10,
    status: 'partial',
    readiness: { pass: true, blockers: [], warnings: [] },
    bridgePlan: undefined,
    boundaryBridgePlan: {
      version: 'yh-boundary-bridge-plan-v1',
      reference: {
        primary: 'ViMAX',
        secondary: ['ArcReel', 'Toonflow-app'],
        adaptedIdeas: ['transition video new-camera image'],
      },
      productionProjectId: 'five-dynasties',
      boundaries: [{
        id: 'five-dynasties-boundary-1-2',
        index: 0,
        previousSegmentId: 'five-dynasties-segment-1',
        nextSegmentId: 'five-dynasties-segment-2',
        previousShotId: 'shot-1',
        nextShotId: 'shot-2',
        sourceLastFrameUrl: lastFrameUrl,
        targetFirstFrameUrl: null,
        bridgeVideoUrl: null,
        bridgeLastFrameUrl: null,
        newCameraImageUrl: null,
        sourceLastFrameHash: null,
        status: lastFrameUrl ? 'ready' : 'blocked',
        bridgeDurationSeconds: 2,
        bridgePrompt: '边界桥接 1->2：从山河图红印与城门影子出发，用火光方向和军旗运动匹配下一段城门换旗。',
        targetOpeningContract: '下一段开头必须承接火光方向、城门影子和山河图红印，再进入换旗动作。',
        editStrategy: 'transition-bridge',
        audioBridgeCue: '保留夜风和远鼓尾音，不新增背景解说。',
        readiness: {
          pass: Boolean(lastFrameUrl),
          blockers: lastFrameUrl ? [] : ['previous-last-frame-missing'],
          warnings: ['bridge-video-not-generated-yet'],
        },
      }],
    },
    segments: [
      makeSegment(0, 'completed', lastFrameUrl),
      makeSegment(1, 'queued', null),
    ],
    assembly: {
      strategy: 'boundary-bridge-concat',
      requiresAllSegments: true,
      outputUrl: null,
      exportFormats: ['mp4', 'cut-draft-json'],
    },
    recovery: {
      persistEachSegment: true,
      resumeFromSegmentIndex: 1,
      canRetryFailedSegments: true,
      failurePolicy: '保留已完成片段，只重试失败边界。',
    },
    nextAction: '生成 boundary bridge artifact 后启动第二段。',
  };
}

const readyPlan = makeAssemblyPlan(true);
const payload = buildProductionBoundaryBridgeStartPayload(readyPlan, 0);

assert(payload.version === 'yh-boundary-bridge-start-payload-v1', 'payload version mismatch');
assert(payload.sourceLastFrameImage === 'https://example.invalid/seg1-last.jpg', 'source last frame not used');
assert(payload.providerPrompt.includes('承接上镜'), 'provider prompt missing Toonflow carry-over anchor');
assert(payload.providerPrompt.includes('new-camera image'), 'provider prompt missing ViMAX new-camera extraction goal');
assert(payload.providerPrompt.includes('不生成背景解说'), 'provider prompt missing no-explainer audio guard');
assert(payload.audioBridgeCue.includes('不新增背景解说'), 'audio bridge cue missing no-explainer guard');
assert(payload.writebackTarget.nextSegmentIndex === 1, 'writeback target should point to next segment');

const writeback = applyBoundaryBridgeArtifactWriteback({
  assemblyPlan: readyPlan,
  boundaryIndex: 0,
  patch: {
    bridgeVideoUrl: 'https://example.invalid/boundary-1-2.mp4',
    bridgeLastFrameUrl: 'https://example.invalid/boundary-1-2-last.jpg',
    newCameraImageUrl: 'https://example.invalid/boundary-1-2-new-camera.jpg',
    providerTaskId: 'provider-boundary-1-2',
  },
});
const updatedBoundary = writeback.assemblyPlan.boundaryBridgePlan!.boundaries[0];
const nextSegment = writeback.assemblyPlan.segments[1];

assert(updatedBoundary.status === 'generated', 'boundary should be generated after writeback');
assert(updatedBoundary.newCameraImageUrl === 'https://example.invalid/boundary-1-2-new-camera.jpg', 'new camera image not stored');
assert(nextSegment.expectedInputs.firstFrameUrl === 'https://example.invalid/boundary-1-2-new-camera.jpg', 'next firstFrameUrl should use new-camera image');
assert(nextSegment.expectedInputs.previousLastFrameUrl === 'https://example.invalid/seg1-last.jpg', 'next previousLastFrameUrl should keep source tail');
assert(nextSegment.expectedInputs.bridgeStrategy === 'transition-bridge', 'next segment should keep transition bridge strategy');
assert(nextSegment.storySegmentContract.dependencyContract.expectedFirstFrameUrl === 'https://example.invalid/boundary-1-2-new-camera.jpg', 'story contract first frame not patched');
assert(String(nextSegment.expectedInputs.boundaryBridgePrompt || '').includes('已生成 bridgeVideoUrl'), 'next boundary prompt missing generated state');

const transitionReadiness = evaluateProductionSegmentTransition(writeback.assemblyPlan, 1);
assert(transitionReadiness.ok === true, `generated boundary bridge should satisfy segment transition gate: ${transitionReadiness.reason || 'unknown'}`);
assert(transitionReadiness.firstFrameUrl === 'https://example.invalid/boundary-1-2-new-camera.jpg', 'transition gate should use bridge new-camera image as first frame');
assert(transitionReadiness.previousLastFrameUrl === 'https://example.invalid/seg1-last.jpg', 'transition gate should preserve previous source tail');

const nextStartPayload = buildProductionSegmentStartPayload(nextSegment as any);
assert(nextStartPayload.firstFrameImage === 'https://example.invalid/boundary-1-2-new-camera.jpg', 'segment start payload should submit bridge new-camera image');
assert(nextStartPayload.firstFrameSource === 'boundary-new-camera', 'segment start payload should mark boundary-new-camera source');
assert(nextStartPayload.previousLastFrameImage === 'https://example.invalid/seg1-last.jpg', 'segment start payload should preserve previous tail as continuity memory');
assert(nextStartPayload.providerPrompt.includes('首帧来源=边界 bridge 生成并抽取的 new-camera image'), 'provider prompt should explain bridge new-camera source');
assert(!nextStartPayload.providerPrompt.includes('已传入上一段尾帧作为首帧图像'), 'bridge provider prompt must not claim previous tail is the submitted first frame');
assert(!nextStartPayload.providerPrompt.includes('从上一段尾帧推进'), 'bridge provider prompt should progress from new-camera first frame, not from previous tail');

let blocked = false;
try {
  buildProductionBoundaryBridgeStartPayload(makeAssemblyPlan(false), 0);
} catch (error) {
  const readiness = error instanceof ProductionBoundaryBridgeStartError
    ? error.details.readiness as { blockers?: string[] } | undefined
    : undefined;
  blocked = error instanceof ProductionBoundaryBridgeStartError
    && Array.isArray(readiness?.blockers)
    && readiness.blockers.includes('previous-last-frame-missing');
}
assert(blocked, 'missing previous last frame should block boundary bridge start');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  sourceMechanisms: {
    vimax: 'transition video -> get_new_camera_image -> next first_frame',
    toonflow: '承接上镜 independent prompt line',
    arcreel: 'dependency gate blocks downstream until upstream artifact exists',
  },
  boundaryBridgeStart: {
    payloadReady: true,
    providerPromptLength: payload.providerPromptLength,
    sourceLastFrameImage: payload.sourceLastFrameImage,
    writebackFirstFrameUrl: nextSegment.expectedInputs.firstFrameUrl,
    segmentStartFirstFrameSource: nextStartPayload.firstFrameSource,
    segmentStartFirstFrameImage: nextStartPayload.firstFrameImage,
    segmentStartPreviousTailMemory: nextStartPayload.previousLastFrameImage,
    boundaryStatusAfterWriteback: updatedBoundary.status,
    transitionGateAcceptsNewCameraImage: transitionReadiness.ok,
  },
  punchThrough: {
    generatedSegmentRate: 'not-run',
    tailFrameAcquisitionRate: 1,
    tailFrameWritebackRate: 1,
    nextSegmentFirstFrameUsageRate: 1,
    bridgeArtifactWritebackRate: 1,
  },
}, null, 2));
