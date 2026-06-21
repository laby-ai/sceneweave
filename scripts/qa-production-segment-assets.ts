import { applySegmentAssetWriteback } from '../src/lib/production-segment-assets';
import {
  evaluateLegacySegmentTransition,
  evaluateProductionSegmentTransition,
} from '../src/lib/production-segment-transition';
import { buildProductionCanvas } from '../src/lib/production-canvas';
import { buildProductionCutDraftJson } from '../src/lib/production-export-package';
import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import type { ProductionProject } from '../src/lib/production-project';
import type { ShotFrameContract } from '../src/lib/production-shot-frame-contract';
import {
  describeStorySegmentCue,
  type StorySegmentContract,
} from '../src/lib/production-story-segment-contract';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeShotFrameContract(index: number, shotId: string): ShotFrameContract {
  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId,
    shotIndex: index,
    variationType: index === 0 ? 'large' : 'medium',
    variationReason: 'QA fixture keeps first/last frame continuity explicit.',
    firstFrame: {
      description: '首帧看见剪辑师、档案馆和关键胶片。',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-1', 'prop-1'],
      continuityAnchors: ['剪辑师', '档案馆', '关键胶片'],
    },
    lastFrame: {
      description: '尾帧保留关键胶片状态，供下一段接续。',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-1', 'prop-1'],
      continuityAnchors: ['剪辑师', '档案馆', '关键胶片'],
    },
    motionDescription: '剪辑师拿起关键胶片并改变屏幕状态。',
    audioDescription: '低频倒计时声和胶片转动声。',
    visualStoryEvidence: {
      threatTarget: '档案馆里的公开证据和剪辑师必须同框出现。',
      conflictEvidence: '倒计时、损坏胶片或失败提示必须作为外部冲突证据。',
      operationResultEvidence: '剪辑师操作后关键胶片或屏幕内容必须改变。',
      endingHookEvidence: '尾帧留下下一段可接的胶片新状态。',
      viewerReadabilityTest: '观众不看字幕也能说清谁受威胁、危险来自哪里、操作结果是什么。',
    },
    handoff: {
      requiresPreviousLastFrame: index > 0,
      previousShotId: index > 0 ? `shot-${index}` : null,
      nextShotId: index === 0 ? 'shot-2' : null,
      entryContinuity: index > 0 ? '承接上一段尾帧。' : '建立人物、场景和道具关系。',
      exitContinuity: '结尾保留可接续的道具状态。',
    },
    readiness: {
      pass: true,
      blockers: [],
      warnings: [],
    },
  };
}

function makeAudioState(index: number) {
  const emotion = index === 0 ? '困惑到警觉' : '紧张';
  const dialogue = index === 0 ? '这卷胶片还在倒计时。' : null;
  const soundDesign = index === 0
    ? '低频倒计时声、胶片转动声、角色短促吸气。'
    : '倒计时声延续，随后被警报声打断。';
  return {
    dialogue,
    narration: null,
    soundDesign,
    voiceStyle: dialogue ? `剪辑师保持${emotion}的对白口型和同一声线。` : `剪辑师保持${emotion}的呼吸和停顿。`,
    emotion,
    audioCue: `情绪=${emotion}；对白=${dialogue || '无'}；旁白=无；声音=${soundDesign}`,
  };
}

function makeAudioEventContract(audioState: ReturnType<typeof makeAudioState>) {
  return {
    dialogueType: audioState.dialogue ? 'dialogue' as const : 'none' as const,
    lipSyncPolicy: audioState.dialogue ? 'lip-sync-active' as const : 'ambient-only' as const,
    mustGenerateAudioTrack: true,
    expectedAudioEvidence: [
      audioState.dialogue ? `对白原文=${audioState.dialogue}` : '',
      `环境音/音效=${audioState.soundDesign}`,
      `音色/语气=${audioState.voiceStyle}`,
    ].filter(Boolean),
    providerInstruction: audioState.dialogue
      ? `保留对白原文“${audioState.dialogue}”，角色口型必须和对白同步。环境声和音效必须可听见：${audioState.soundDesign}`
      : `本段无对白/旁白，角色嘴唇保持自然静默，只保留环境声和动作声。环境声和音效必须可听见：${audioState.soundDesign}`,
  };
}

function makeStorySegmentContract(index: number, shotId: string): StorySegmentContract {
  const shotFrameContract = makeShotFrameContract(index, shotId);
  const audioState = makeAudioState(index);
  return {
    version: 'yh-story-segment-contract-v1',
    reference: {
      primary: 'Toonflow-app',
      secondary: ['ViMAX', 'ArcReel'],
      sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate',
    },
    segmentId: `segment-${index + 1}`,
    index,
    shotId,
    videoDesc: {
      visibleAction: shotFrameContract.motionDescription,
      visualCausality: shotFrameContract.visualStoryEvidence.operationResultEvidence,
      entryState: shotFrameContract.handoff.entryContinuity,
      exitState: shotFrameContract.handoff.exitContinuity,
      continuityAnchors: shotFrameContract.firstFrame.continuityAnchors,
      requiredAssetIds: shotFrameContract.firstFrame.requiredAssetIds,
    },
    storyState: {
      protagonist: '剪辑师',
      currentGoal: index === 0 ? '找回被删除的第一段影像' : '承接上一段线索继续阻止倒计时',
      conflict: '记忆被分段隐藏',
      obstacle: '时间即将归零',
      scene: '档案馆',
      keyProp: '关键胶片',
      emotionalState: makeAudioState(index).emotion,
      visibleStateChange: shotFrameContract.visualStoryEvidence.operationResultEvidence,
    },
    audioContract: {
      dialogue: audioState.dialogue,
      narration: audioState.narration,
      soundDesign: audioState.soundDesign,
      voiceStyle: audioState.voiceStyle,
      audioCue: audioState.audioCue,
      previousAudioCue: null,
      requiresAudioContinuity: index > 0,
      audioEventContract: makeAudioEventContract(audioState),
    },
    dependencyContract: {
      previousSegmentId: index > 0 ? `segment-${index}` : null,
      nextSegmentId: index === 0 ? 'segment-2' : null,
      requiresPreviousLastFrame: index > 0,
      expectedFirstFrameUrl: null,
      expectedPreviousLastFrameUrl: null,
      previousStoryStateCue: null,
      sourceSegmentId: index > 0 ? `segment-${index}` : null,
      sourceAssetId: null,
    },
    readiness: {
      pass: true,
      blockers: [],
      warnings: [],
    },
  };
}

const project: ProductionProject = {
  id: 'production-qa-segment-assets',
  title: '片段资产回写 QA',
  prompt: '剪辑师找回一分钟记忆',
  style: '黑色短剧',
  ratio: '16:9',
  sceneType: 'drama',
  duration: 20,
  segmentDuration: 10,
  narrativeSummary: '两个片段组成的短剧片段回写验证',
  storyBible: {
    premise: '剪辑师在档案馆找回记忆',
    protagonist: '剪辑师',
    desire: '找回被删除的影像',
    obstacle: '时间即将归零',
    relationship: '剪辑师与档案馆',
    conflict: '记忆被分段隐藏',
    turningPoint: '第一段影像揭示线索',
    endingHook: '第二段仍待生成',
    emotionalArc: { start: '困惑', shift: '紧张', end: '坚定' },
    continuityRules: ['主角服装保持一致'],
    beats: [],
  },
  semanticPlan: {
    version: 'yh-production-semantic-plan-v1',
    source: 'video-production-v3-merged',
    reference: {
      primary: 'ViMax',
      secondary: ['Toonflow-app', 'ArcReel'],
      adaptedIdeas: ['segment asset writeback qa'],
    },
    writerOutput: {} as ProductionProject['semanticPlan']['writerOutput'],
    directorOutput: {} as ProductionProject['semanticPlan']['directorOutput'],
    characterBibles: [],
    sceneBibles: [],
    shotList: { id: 'shot-list', projectId: 'production-qa-segment-assets', scenes: [] },
    dag: {
      nodes: [
        { nodeId: 'n_storyboard', name: '分镜表', agent: 'director_agent', dependencies: [], status: 'completed' },
        { nodeId: 'n_video_shot-1', name: '视频片段-1', agent: 'video_agent', dependencies: ['n_storyboard'], status: 'pending' },
        { nodeId: 'n_video_shot-2', name: '视频片段-2', agent: 'video_agent', dependencies: ['n_storyboard'], status: 'pending' },
        { nodeId: 'n_assembly', name: '片段合成/导出', agent: 'assembly_agent', dependencies: ['n_video_shot-1', 'n_video_shot-2'], status: 'pending' },
      ],
    },
    assetLinks: {
      characterAssetIds: [],
      sceneAssetIds: [],
      storyboardAssetId: 'storyboard-1',
      deliverableAssetId: 'deliverable-1',
    },
  },
  assets: [
    { id: 'script-1', kind: 'script', name: '剧本', status: 'ready', summary: '剧本', source: 'prompt' },
    { id: 'storyboard-1', kind: 'storyboard', name: '分镜', status: 'ready', summary: '分镜', source: 'storyboard' },
    { id: 'task-1', kind: 'task', name: '任务', status: 'completed', summary: '任务', source: 'task' },
    { id: 'deliverable-1', kind: 'deliverable', name: '成片', status: 'pending', summary: '等待合成', source: 'system' },
  ],
  stages: [
    { id: 'script', name: '创意/剧本', status: 'ready', summary: 'ready', assetIds: ['script-1'] },
    { id: 'assets', name: '角色/场景/道具', status: 'planned', summary: 'planned', assetIds: [] },
    { id: 'storyboard', name: '分镜/镜头', status: 'ready', summary: 'ready', assetIds: ['storyboard-1'] },
    { id: 'task', name: '任务中心', status: 'completed', summary: 'completed', assetIds: ['task-1'] },
    { id: 'assembly', name: '片段合成', status: 'pending', summary: 'pending', assetIds: ['deliverable-1'] },
    { id: 'delivery', name: '成片/导出', status: 'pending', summary: 'pending', assetIds: ['deliverable-1'] },
  ],
  graph: {
    nodes: [
      { id: 'script-1', kind: 'script', name: '剧本', status: 'ready' },
      { id: 'storyboard-1', kind: 'storyboard', name: '分镜', status: 'ready' },
      { id: 'task-1', kind: 'task', name: '任务', status: 'completed' },
      { id: 'deliverable-1', kind: 'deliverable', name: '成片', status: 'pending' },
    ],
    edges: [
      { from: 'storyboard-1', to: 'task-1', relation: 'feeds' },
      { from: 'task-1', to: 'deliverable-1', relation: 'tracks' },
    ],
  },
  storyboard: {
    shotCount: 2,
    totalDuration: 20,
    shots: [
      {
        id: 'shot-1',
        index: 1,
        duration: 10,
        storyBeat: 'setup',
        dramaticPurpose: '建立线索',
        emotionShift: '困惑到警觉',
        prompt: '镜头 1',
        status: 'planned',
      },
      {
        id: 'shot-2',
        index: 2,
        duration: 10,
        storyBeat: 'conflict',
        dramaticPurpose: '冲突升级',
        emotionShift: '紧张',
        prompt: '镜头 2',
        status: 'planned',
      },
    ],
  },
  output: {
    status: 'pending',
    taskId: 'parent-task',
    canProceedToVideo: false,
    nextStep: '等待片段',
  },
  suggestions: {
    subtitle: {} as ProductionProject['suggestions']['subtitle'],
    narration: {} as ProductionProject['suggestions']['narration'],
  },
};

const assemblyPlan: ProductionAssemblyPlan = {
  version: 'yh-assembly-plan-v1',
  reference: { primary: 'ArcReel', adaptedIdeas: ['segment queue writeback'] },
  productionProjectId: project.id,
  sourceTaskId: 'parent-task',
  totalDuration: 20,
  segmentCount: 2,
  segmentDurationHint: 10,
  status: 'planned',
  boundaryBridgePlan: {
    version: 'yh-boundary-bridge-plan-v1',
    reference: {
      primary: 'ViMAX',
      secondary: ['ArcReel', 'Toonflow-app'],
      adaptedIdeas: ['boundary artifact QA fixture'],
    },
    productionProjectId: project.id,
    boundaries: [
      {
        id: 'project-1-boundary-1-2',
        index: 0,
        previousSegmentId: 'segment-1',
        nextSegmentId: 'segment-2',
        previousShotId: 'shot-1',
        nextShotId: 'shot-2',
        sourceLastFrameUrl: null,
        targetFirstFrameUrl: null,
        bridgeVideoUrl: null,
        bridgeLastFrameUrl: null,
        newCameraImageUrl: null,
        sourceLastFrameHash: null,
        status: 'blocked',
        bridgeDurationSeconds: 2,
        bridgePrompt: '边界桥接 1->2：保持主角、场景、道具，使用动作匹配而不是硬切。',
        targetOpeningContract: '第二段开头承接第一段尾帧。',
        editStrategy: 'transition-bridge',
        audioBridgeCue: '保留上一段环境声尾音再进入第二段。',
        readiness: {
          pass: false,
          blockers: ['waiting-for-previous-last-frame'],
          warnings: ['bridge-video-not-generated-yet'],
        },
      },
    ],
  },
  readiness: {
    version: 'yh-assembly-readiness-v1',
    pass: true,
    checkedAt: '2026-06-17T00:00:00.000Z',
    source: 'shot-frame-contract',
    blockerCount: 0,
    warningCount: 0,
    issues: [],
    nextAction: 'queue segments',
  },
  segments: [
    {
      id: 'segment-1',
      index: 0,
      shotId: 'shot-1',
      duration: 10,
      prompt: '生成第一段',
      status: 'queued',
      dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
      expectedInputs: {
        firstFrameUrl: null,
        previousLastFrameUrl: null,
        sourceSegmentId: null,
        sourceAssetId: null,
        continuityPrompt: '第一段建立人物和线索',
        previousAudioCue: null,
        audioContinuityPrompt: '第一段建立声音基调',
        previousStoryStateCue: null,
        storyContinuityPrompt: '第一段建立故事状态',
      },
      expectedOutputs: {
        taskId: 'child-1',
        videoUrl: null,
        lastFrameUrl: null,
        audioCue: makeAudioState(0).audioCue,
        storyStateCue: describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1')),
      },
      audioState: makeAudioState(0),
      shotFrameContract: makeShotFrameContract(0, 'shot-1'),
      storySegmentContract: makeStorySegmentContract(0, 'shot-1'),
      retryPolicy: { maxRetries: 2, retryable: true, fallback: 'retry segment' },
    },
    {
      id: 'segment-2',
      index: 1,
      shotId: 'shot-2',
      duration: 10,
      prompt: '生成第二段',
      status: 'queued',
      dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
      expectedInputs: {
        firstFrameUrl: null,
        previousLastFrameUrl: null,
        sourceSegmentId: 'segment-1',
        sourceAssetId: null,
        continuityPrompt: '等待第一段尾帧参考',
        previousAudioCue: null,
        audioContinuityPrompt: '等待第一段声音状态',
        previousStoryStateCue: null,
        storyContinuityPrompt: '等待第一段故事状态',
        boundaryBridgeId: 'project-1-boundary-1-2',
        boundaryBridgePrompt: '边界桥接 1->2：保持主角、场景、道具，使用动作匹配而不是硬切。',
        bridgeFirstFrameUrl: null,
        bridgeStrategy: 'transition-bridge',
      },
      expectedOutputs: {
        taskId: 'child-2',
        videoUrl: null,
        lastFrameUrl: null,
        audioCue: makeAudioState(1).audioCue,
        storyStateCue: describeStorySegmentCue(makeStorySegmentContract(1, 'shot-2')),
      },
      audioState: makeAudioState(1),
      shotFrameContract: makeShotFrameContract(1, 'shot-2'),
      storySegmentContract: makeStorySegmentContract(1, 'shot-2'),
      retryPolicy: { maxRetries: 2, retryable: true, fallback: 'retry segment' },
    },
  ],
  assembly: {
    strategy: 'ordered-concat',
    requiresAllSegments: true,
    outputUrl: null,
    exportFormats: ['mp4', 'cut-draft-json'],
  },
  recovery: {
    persistEachSegment: true,
    resumeFromSegmentIndex: 0,
    canRetryFailedSegments: true,
    failurePolicy: 'retry failed only',
  },
  nextAction: 'queue segments',
};

const success = applySegmentAssetWriteback({
  productionProject: project,
  assemblyPlan,
  segmentIndex: 0,
  patch: {
    status: 'completed',
    completedAt: '2026-06-17T00:00:00.000Z',
    expectedOutputs: {
      taskId: 'child-1',
      providerTaskId: 'provider-task-1',
      videoUrl: 'https://example.invalid/segment-1.mp4',
      lastFrameUrl: 'https://example.invalid/segment-1-last.jpg',
      audioCue: makeAudioState(0).audioCue,
      hasAudio: true,
    },
  },
});

assert(success.assemblyPlan.status === 'partial', 'one completed segment should make assembly partial');
const secondSegmentAfterSuccess = success.assemblyPlan.segments.find(segment => segment.index === 1);
assert(secondSegmentAfterSuccess?.expectedInputs.firstFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'next segment firstFrameUrl handoff missing');
assert(secondSegmentAfterSuccess.expectedInputs.previousLastFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'next segment previousLastFrameUrl handoff missing');
assert(secondSegmentAfterSuccess.expectedInputs.sourceSegmentId === 'segment-1', 'next segment sourceSegmentId mismatch');
assert(secondSegmentAfterSuccess.expectedInputs.sourceAssetId === 'video-segment-1', 'next segment sourceAssetId mismatch');
assert(String(secondSegmentAfterSuccess.expectedInputs.continuityPrompt || '').includes('开头1-2秒'), 'next segment continuity prompt missing');
assert(secondSegmentAfterSuccess.expectedInputs.previousAudioCue === makeAudioState(0).audioCue, 'next segment previousAudioCue handoff missing');
assert(String(secondSegmentAfterSuccess.expectedInputs.audioContinuityPrompt || '').includes('声音状态'), 'next segment audio continuity prompt missing');
assert(secondSegmentAfterSuccess.expectedInputs.previousStoryStateCue === describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1')), 'next segment previousStoryStateCue handoff missing');
assert(String(secondSegmentAfterSuccess.expectedInputs.storyContinuityPrompt || '').includes('故事状态'), 'next segment story continuity prompt missing');
assert(secondSegmentAfterSuccess.expectedInputs.bridgeFirstFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'next segment bridgeFirstFrameUrl handoff missing');
assert(secondSegmentAfterSuccess.expectedInputs.bridgeStrategy === 'transition-bridge', 'next segment bridge strategy missing');
assert(String(secondSegmentAfterSuccess.expectedInputs.boundaryBridgePrompt || '').includes('已取得片段 1 的尾帧'), 'next segment boundary bridge prompt was not updated after tail frame writeback');
const boundaryAfterSuccess = success.assemblyPlan.boundaryBridgePlan?.boundaries[0];
assert(boundaryAfterSuccess?.status === 'ready', 'boundary bridge should become ready after previous segment completion');
assert(boundaryAfterSuccess.sourceLastFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'boundary bridge source last frame missing');
assert(boundaryAfterSuccess.targetFirstFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'boundary bridge target first frame missing');
assert(boundaryAfterSuccess.readiness.pass === true, 'boundary bridge readiness should pass after source tail frame writeback');
assert(secondSegmentAfterSuccess.storySegmentContract.dependencyContract.expectedFirstFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'next segment story contract first frame writeback missing');
assert(secondSegmentAfterSuccess.storySegmentContract.audioContract.previousAudioCue === makeAudioState(0).audioCue, 'next segment story contract audio writeback missing');
assert(secondSegmentAfterSuccess.storySegmentContract.dependencyContract.previousStoryStateCue === describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1')), 'next segment story contract story state cue writeback missing');
assert(
  secondSegmentAfterSuccess.storySegmentContract.audioContract.audioEventContract.providerInstruction.includes('环境声'),
  'story segment audio event contract should survive handoff writeback'
);
assert(success.productionProject, 'productionProject missing after success writeback');
const videoAsset = success.productionProject.assets.find(asset => asset.kind === 'videoSegment');
assert(videoAsset, 'videoSegment asset missing');
assert(videoAsset.metadata?.videoUrl === 'https://example.invalid/segment-1.mp4', 'videoSegment videoUrl mismatch');
assert(videoAsset.metadata?.audioCue === makeAudioState(0).audioCue, 'videoSegment audioCue metadata mismatch');
assert(videoAsset.metadata?.storyStateCue === describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1')), 'videoSegment storyStateCue metadata mismatch');
assert(videoAsset.metadata?.hasAudio === true, 'videoSegment hasAudio metadata mismatch');
assert(
  (videoAsset.metadata?.audioEventContract as any)?.providerInstruction?.includes('环境声'),
  'videoSegment audioEventContract metadata missing'
);
assert(success.productionProject.graph.nodes.some(node => node.id === videoAsset.id && node.kind === 'videoSegment'), 'graph node missing videoSegment');
assert(success.productionProject.graph.edges.some(edge => edge.from === 'storyboard-1' && edge.to === videoAsset.id), 'storyboard to videoSegment edge missing');
const completedDag = success.productionProject.semanticPlan.dag.nodes.find(node => node.nodeId === 'n_video_shot-1');
assert(completedDag?.status === 'completed', 'DAG video node should be completed');
assert(completedDag.result?.videoUrl === 'https://example.invalid/segment-1.mp4', 'DAG videoUrl mismatch');
assert(
  (completedDag.result?.audioEventContract as any)?.providerInstruction?.includes('环境声'),
  'DAG video node audioEventContract missing'
);
assert(!success.productionProject.assets.find(asset => asset.kind === 'deliverable')?.metadata?.videoUrl, 'deliverable must not get fake videoUrl');

const cutDraft = buildProductionCutDraftJson({
  id: 'parent-task',
  type: 'video',
  status: 'running',
  createdAt: '2026-06-17T00:00:00.000Z',
  updatedAt: '2026-06-17T00:00:01.000Z',
  progress: 50,
  message: 'qa cut draft',
  config: {
    prompt: 'qa segmented story',
    duration: 10,
    ratio: '16:9',
    resolution: '720p',
  },
  result: {
    productionProject: success.productionProject,
    assemblyPlan: success.assemblyPlan,
  },
} as any);
const cutDraftFirstSegment = cutDraft.assets.videoSegments.find(segment => segment.id === 'video-segment-1');
const cutDraftSecondAssemblySegment = cutDraft.assemblyPlan?.segments.find(segment => segment.index === 1);
assert(cutDraftFirstSegment?.audioCue === makeAudioState(0).audioCue, 'cut draft videoSegment audioCue missing');
assert(
  cutDraftFirstSegment?.storyStateCue === describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1')),
  'cut draft videoSegment storyStateCue missing'
);
assert(cutDraftFirstSegment?.audioEventContract, 'cut draft videoSegment audioEventContract missing');
assert(cutDraftSecondAssemblySegment?.expectedInputs.firstFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'cut draft second segment firstFrameUrl handoff missing');
assert(cutDraftSecondAssemblySegment?.audioContinuityPrompt, 'cut draft second segment audio continuity prompt missing');
assert(cutDraftSecondAssemblySegment?.storyContinuityPrompt, 'cut draft second segment story continuity prompt missing');

const failed = applySegmentAssetWriteback({
  productionProject: success.productionProject,
  assemblyPlan: success.assemblyPlan,
  segmentIndex: 1,
  patch: {
    status: 'failed',
    error: '供应商返回失败',
    completedAt: '2026-06-17T00:00:10.000Z',
    expectedOutputs: { taskId: 'child-2' },
  },
});

assert(failed.assemblyPlan.status === 'failed', 'failed segment should fail assembly plan');
assert(failed.assemblyPlan.recovery.resumeFromSegmentIndex === 1, 'resume index should point to failed segment');
assert(failed.productionProject, 'productionProject missing after failure writeback');
assert(failed.productionProject.assets.filter(asset => asset.kind === 'videoSegment').length === 1, 'failed segment must not create fake videoSegment asset');
const failedDag = failed.productionProject.semanticPlan.dag.nodes.find(node => node.nodeId === 'n_video_shot-2');
assert(failedDag?.status === 'failed', 'failed DAG node should be failed');
assert(failedDag.error === '供应商返回失败', 'failed DAG error mismatch');

const canvas = buildProductionCanvas({
  productionProject: failed.productionProject,
  assemblyPlan: failed.assemblyPlan,
  taskId: 'parent-task',
});
const videoSegmentNode = canvas.nodes.find(node =>
  node.type === 'video' &&
  node.data.productionAssetKind === 'videoSegment' &&
  node.data.videoUrl === 'https://example.invalid/segment-1.mp4'
);
assert(videoSegmentNode, 'canvas videoSegment node missing');
assert(
  (videoSegmentNode?.data.audioEventContract as any)?.providerInstruction?.includes('环境声'),
  'canvas videoSegment node missing audioEventContract'
);

const blockedTransition = evaluateLegacySegmentTransition([
  { index: 0, taskId: 'child-1', status: 'completed', videoUrl: 'https://example.invalid/segment-1.mp4' },
  { index: 1, taskId: 'child-2', status: 'failed', prompt: '第二段', duration: 10 },
], 1);
assert(blockedTransition.ok === false, 'segment transition should block when previous lastFrameUrl is missing');
assert(String(blockedTransition.reason || '').includes('lastFrameUrl'), 'blocked transition should explain missing lastFrameUrl');

const readyTransition = evaluateLegacySegmentTransition([
  {
    index: 0,
    taskId: 'child-1',
    status: 'completed',
    videoUrl: 'https://example.invalid/segment-1.mp4',
    lastFrameUrl: 'https://example.invalid/segment-1-last.jpg',
  },
  { index: 1, taskId: 'child-2', status: 'failed', prompt: '第二段', duration: 10 },
], 1);
assert(readyTransition.ok === true, 'segment transition should be ready when previous lastFrameUrl exists');
assert(readyTransition.firstFrameUrl === 'https://example.invalid/segment-1-last.jpg', 'ready transition should pass previous lastFrameUrl as firstFrameUrl');

const firstSegmentPartialFailure = applySegmentAssetWriteback({
  productionProject: project,
  assemblyPlan,
  segmentIndex: 0,
  patch: {
    status: 'failed',
    error: 'segment-tail-frame-missing after provider returned partial video',
    completedAt: '2026-06-17T00:00:05.000Z',
    expectedOutputs: {
      taskId: 'child-1',
      providerTaskId: 'provider-partial-1',
      videoUrl: 'https://example.invalid/partial-segment-1.mp4',
      lastFrameUrl: null,
    },
  },
});
const secondAfterPartialFailure = firstSegmentPartialFailure.assemblyPlan.segments.find(segment => segment.index === 1);
assert(firstSegmentPartialFailure.assemblyPlan.status === 'failed', 'partial first-segment failure should fail assembly plan');
assert(
  firstSegmentPartialFailure.assemblyPlan.recovery.resumeFromSegmentIndex === 0,
  'resume index should point to earliest failed segment'
);
assert(
  secondAfterPartialFailure?.expectedInputs.firstFrameUrl === null,
  'failed partial segment must not write fake firstFrameUrl into next segment'
);
assert(
  secondAfterPartialFailure?.status === 'skipped',
  'failed partial segment should cascade-skip dependent next segment'
);
assert(
  String(secondAfterPartialFailure?.error || '').includes('停止级联启动'),
  'cascade-skipped segment should explain dependency failure'
);
assert(
  secondAfterPartialFailure?.expectedInputs.previousLastFrameUrl === null,
  'failed partial segment must not write fake previousLastFrameUrl into next segment'
);
const boundaryAfterPartialFailure = firstSegmentPartialFailure.assemblyPlan.boundaryBridgePlan?.boundaries[0];
assert(boundaryAfterPartialFailure?.status === 'stale', 'failed partial segment should invalidate downstream boundary bridge');
assert(
  boundaryAfterPartialFailure?.readiness.blockers.includes('segment-1-failed'),
  'failed partial segment boundary blocker missing'
);
assert(
  !firstSegmentPartialFailure.productionProject?.assets.some(asset => asset.kind === 'videoSegment'),
  'failed partial segment must not create reusable videoSegment asset'
);
const blockedAfterPartialFailure = evaluateProductionSegmentTransition(
  firstSegmentPartialFailure.assemblyPlan,
  1
);
assert(blockedAfterPartialFailure.ok === false, 'next segment should be blocked after partial previous failure');
assert(
  String(blockedAfterPartialFailure.reason || '').includes('上一段'),
  'blocked transition should explain previous segment dependency after partial failure'
);

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'completed segment creates videoSegment asset',
    'completed segment writes last frame into next segment firstFrameUrl',
    'completed segment writes audio cue into next segment previousAudioCue',
    'completed segment marks boundary bridge ready',
    'completed segment archives audio cue and hasAudio metadata',
    'cut draft preserves segment story/audio handoff metadata',
    'completed segment updates DAG node',
    'failed segment records error without fake asset',
    'deliverable remains without fake final videoUrl',
    'videoSegment asset maps to canvas video node',
    'resume transition blocks missing lastFrameUrl',
    'resume transition passes previous lastFrameUrl as firstFrameUrl',
    'failed partial segment does not propagate fake first frame',
    'failed partial segment does not create reusable video asset',
    'failed partial segment cascade-skips dependent segment',
    'failed partial segment invalidates downstream boundary bridge',
    'next segment remains blocked after partial previous failure',
  ],
  videoSegmentAssetId: videoAsset.id,
  canvasVideoSegmentNodeId: videoSegmentNode.id,
  assemblyStatusAfterFailure: failed.assemblyPlan.status,
  resumeFromSegmentIndex: failed.assemblyPlan.recovery.resumeFromSegmentIndex,
  cascadeFailureGuard: {
    generatedSegmentRate: 'not-real-sample',
    tailFrameAcquisitionRate: 'not-real-sample',
    tailFrameWritebackRate: 0,
    nextSegmentFirstFrameUsageRate: 0,
    nextSegmentBlocked: true,
    nextSegmentStatus: secondAfterPartialFailure?.status,
    partialProviderTaskIdPreserved: firstSegmentPartialFailure.assemblyPlan.segments[0].expectedOutputs.providerTaskId === 'provider-partial-1',
  },
}, null, 2));
