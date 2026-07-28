import type { ProductionSegmentPlan } from '../src/lib/production-assembly-plan';
import { buildProductionSegmentStartPayload } from '../src/lib/production-segment-start-payload';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const segment = {
  id: 'bridge-shot-5',
  index: 4,
  shotId: 'shot-5',
  duration: 5,
  prompt: '林浅推开铁门，从雨夜天台进入黑暗放映室。',
  status: 'queued',
  generationRoute: {
    mode: 'first-frame',
    requestedBy: 'planner',
    reason: '所有正式视频片段统一从已验收首帧进入。',
    model: 'happyhorse-1.1-i2v',
    requiresPreviousLastFrame: true,
    canonicalFirstFrameRequired: false,
    boundaryIntent: 'bridge',
    referenceRoles: [],
    requiresConfirmation: false,
  },
  dependencies: {
    characterAssetIds: ['character-1'],
    sceneAssetIds: ['scene-2'],
    propAssetIds: ['prop-2', 'prop-3'],
  },
  expectedInputs: {
    firstFrameUrl: 'data:image/jpeg;base64,ZmFrZQ==',
    previousLastFrameUrl: 'data:image/jpeg;base64,ZmFrZQ==',
    sourceSegmentId: 'shot-4',
    sourceAssetId: 'video-shot-4',
    continuityPrompt: '承接上一镜真实尾帧。',
    previousAudioCue: '雨声逐渐减弱。',
    audioContinuityPrompt: '门关闭后雨声变闷。',
    previousStoryStateCue: '林浅站在天台铁门前，右手已经握住门把手。',
    storyContinuityPrompt: '从握住门把手继续。',
  },
  expectedOutputs: {
    videoUrl: null,
    lastFrameUrl: null,
    taskId: null,
  },
  shotFrameContract: {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId: 'shot-5',
    shotIndex: 4,
    variationType: 'large',
    variationReason: '模型规划的跨场过门镜头。',
    firstFrame: {
      description: '过肩镜头，铁门被推开，门外是明亮的雨夜霓虹，门内是深邃的黑暗。',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-2', 'prop-2', 'prop-3'],
      continuityAnchors: ['林浅', '深蓝风衣', '铁门'],
    },
    lastFrame: {
      description: '林浅背影进入室内，门在身后半掩，前方出现放映机轮廓。',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-2', 'prop-3'],
      continuityAnchors: ['林浅', '深蓝风衣', '放映机'],
    },
    motionDescription: '镜头跟随林浅穿过门口，曝光由雨夜高光调整为室内低光。',
    audioDescription: '铁门轴摩擦声，门半掩后雨声骤然变闷。',
    visualStoryEvidence: {
      threatTarget: '',
      conflictEvidence: '明亮雨夜与黑暗放映室在门口形成空间转换。',
      operationResultEvidence: '林浅完成推门并进入放映室。',
      endingHookEvidence: '放映机轮廓出现。',
      viewerReadabilityTest: '观众能看懂人物从天台进入放映室。',
    },
    handoff: {
      requiresPreviousLastFrame: true,
      previousShotId: 'shot-4',
      nextShotId: 'shot-6',
      entryContinuity: '林浅站在天台铁门前，右手已经握住门把手。',
      exitContinuity: '林浅已经进入放映室，门在身后半掩，放映机在前方。',
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  },
  storySegmentContract: {
    version: 'yh-story-segment-contract-v1',
    reference: {
      primary: 'Toonflow-app',
      secondary: ['ViMAX', 'ArcReel'],
      sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate',
    },
    segmentId: 'bridge-shot-5',
    index: 4,
    shotId: 'shot-5',
    videoDesc: {
      visibleAction: '林浅推开铁门并进入放映室。',
      visualCausality: '推门动作让人物从雨夜天台进入黑暗放映室。',
      entryState: '林浅站在天台铁门前，右手已经握住门把手。',
      exitState: '林浅完全进入放映室，门在身后半掩，前方出现放映机。',
      continuityAnchors: ['林浅', '深蓝风衣', '铁门', '放映机'],
      requiredAssetIds: ['character-1', 'scene-2', 'prop-2', 'prop-3'],
    },
    storyState: {
      protagonist: '林浅',
      currentGoal: '进入铁门后的房间继续追查发光胶片',
      conflict: '明亮雨夜与未知黑暗空间之间的迟疑',
      obstacle: '室内完全黑暗',
      scene: '放映室入口',
      keyProp: '铁门与放映机',
      emotionalState: '警觉而克制',
      visibleStateChange: '林浅从天台进入放映室。',
    },
    audioContract: {
      dialogue: null,
      narration: null,
      soundDesign: '铁门轴摩擦声，门半掩后雨声变闷。',
      voiceStyle: '无对白。',
      audioCue: '旁白=无；对白=无；铁门轴摩擦声。',
      previousAudioCue: '雨声。',
      requiresAudioContinuity: true,
      audioEventContract: {
        dialogueType: 'none',
        lipSyncPolicy: 'ambient-only',
        mustGenerateAudioTrack: true,
        expectedAudioEvidence: ['铁门轴摩擦声', '雨声变闷'],
        providerInstruction: '不生成对白或旁白，只保留铁门轴摩擦声和变闷的雨声。',
      },
    },
    dependencyContract: {
      previousSegmentId: 'shot-4',
      nextSegmentId: 'shot-6',
      requiresPreviousLastFrame: true,
      expectedFirstFrameUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      expectedPreviousLastFrameUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      previousStoryStateCue: '林浅站在天台铁门前。',
      sourceSegmentId: 'shot-4',
      sourceAssetId: 'video-shot-4',
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  },
  retryPolicy: {
    maxRetries: 1,
    retryable: true,
    fallback: '仅重做当前镜头。',
  },
} satisfies ProductionSegmentPlan;

const payload = buildProductionSegmentStartPayload(segment);
const forbidden = [
  '五代十国',
  '地图',
  '旗帜',
  '门楼',
  '战地医棚',
  '威胁对象',
  '倒计时',
  '进一步了解',
  '初见之时',
];

for (const token of forbidden) {
  assert(!payload.providerPrompt.includes(token), `provider prompt leaked template token: ${token}`);
}
for (const expected of [
  '林浅',
  '铁门',
  '雨夜天台',
  '黑暗放映室',
  '放映机',
  '无',
]) {
  assert(payload.providerPrompt.includes(expected), `provider prompt lost model-authored fact: ${expected}`);
}
assert(payload.providerPromptLength <= 900, 'provider prompt exceeded provider limit');

console.log(JSON.stringify({
  pass: true,
  providerPromptLength: payload.providerPromptLength,
  providerPrompt: payload.providerPrompt,
}, null, 2));
