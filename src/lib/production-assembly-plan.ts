import type { ProductionProject } from './production-project';
import type { ProductionArtifactReadiness } from './production-artifact-stale';
import {
  buildShotFrameContract,
  evaluateAssemblyShotFrameReadiness,
  type ProductionAssemblyReadiness,
  type ShotFrameContract,
} from './production-shot-frame-contract';
import {
  buildStorySegmentContract,
  describeStorySegmentCue,
  type StorySegmentContract,
} from './production-story-segment-contract';
import { buildBoundaryBridgePlan, buildSegmentBridgePlan } from './trailer-beat-sheet';
import type { BoundaryBridgePlan, SegmentBridge, SegmentBridgePlan } from './trailer-beat-sheet';
import type { VimaxShotGenerationRoute } from './skills/vimax-short-drama/vimax-shot-generation-route';
import type { VimaxCanonicalFirstFrameState } from './skills/vimax-short-drama/vimax-canonical-first-frame';
import type { VimaxBridgeTailAcceptance } from './skills/vimax-short-drama/vimax-bridge-tail-acceptance';

export interface ProductionSegmentAudioState {
  dialogue: string | null;
  narration: string | null;
  soundDesign: string;
  voiceStyle: string;
  emotion: string;
  audioCue: string;
}

export interface ProductionSegmentPlan {
  id: string;
  index: number;
  shotId: string;
  duration: number;
  prompt: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  generationRoute?: VimaxShotGenerationRoute;
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
  dependencies: {
    scriptAssetId?: string;
    characterAssetIds: string[];
    sceneAssetIds: string[];
    propAssetIds: string[];
  };
  expectedInputs: {
    firstFrameUrl: string | null;
    previousLastFrameUrl: string | null;
    sourceSegmentId: string | null;
    sourceAssetId: string | null;
    continuityPrompt: string | null;
    previousAudioCue?: string | null;
    audioContinuityPrompt?: string | null;
    previousStoryStateCue?: string | null;
    storyContinuityPrompt?: string | null;
    boundaryBridgeId?: string | null;
    boundaryBridgePrompt?: string | null;
    bridgeFirstFrameUrl?: string | null;
    bridgeStrategy?: 'transition-bridge' | 'direct-tail-frame-fallback' | null;
    canonicalFirstFrame?: VimaxCanonicalFirstFrameState;
  };
  expectedOutputs: {
    videoUrl: string | null;
    lastFrameUrl: string | null;
    taskId: string | null;
    providerTaskId?: string | null;
    audioCue?: string | null;
    hasAudio?: boolean | null;
    storyStateCue?: string | null;
    bridgeTailAcceptance?: VimaxBridgeTailAcceptance;
  };
  audioState?: ProductionSegmentAudioState;
  shotFrameContract: ShotFrameContract;
  storySegmentContract: StorySegmentContract;
  artifactReadiness?: ProductionArtifactReadiness;
  retryPolicy: {
    maxRetries: number;
    retryable: boolean;
    fallback: string;
  };
}

export interface ProductionAssemblyPlan {
  version: 'yh-assembly-plan-v1';
  reference: {
    primary: 'ArcReel';
    adaptedIdeas: string[];
  };
  productionProjectId: string;
  sourceTaskId: string;
  totalDuration: number;
  segmentCount: number;
  segmentDurationHint: number;
  status: 'planned' | 'running' | 'partial' | 'completed' | 'failed';
  bridgePlan?: SegmentBridgePlan;
  boundaryBridgePlan?: BoundaryBridgePlan;
  readiness: ProductionAssemblyReadiness;
  segments: ProductionSegmentPlan[];
  assembly: {
    strategy: 'ordered-concat' | 'boundary-bridge-concat';
    requiresAllSegments: boolean;
    outputUrl: string | null;
    exportFormats: Array<'mp4' | 'cut-draft-json'>;
  };
  recovery: {
    persistEachSegment: true;
    resumeFromSegmentIndex: number;
    canRetryFailedSegments: boolean;
    failurePolicy: string;
  };
  nextAction: string;
}

interface BuildProductionAssemblyPlanParams {
  productionProject: ProductionProject;
  sourceTaskId: string;
}

function assetIdsByKind(project: ProductionProject, kind: string) {
  return project.assets.filter(asset => asset.kind === kind).map(asset => asset.id);
}

function primaryPropName(project: ProductionProject) {
  const prop = project.assets.find(asset => asset.kind === 'prop');
  return prop?.name || '关键线索';
}

function projectSceneName(
  project: ProductionProject,
  shot?: ProductionProject['storyboard']['shots'][number],
) {
  if (shot?.sceneLabel?.trim()) return shot.sceneLabel.trim();
  const sceneAsset = project.assets.find(asset => asset.kind === 'scene');
  const sceneBible = project.semanticPlan?.sceneBibles?.[0];
  return sceneAsset?.name || sceneBible?.name || project.storyBible.relationship.split('与')[1]?.split('、')[0] || '主要场景';
}

function isNonNarrativeProject(project: ProductionProject) {
  return !project.assets.some(asset => asset.kind === 'character');
}

function visualAnchorNames(project: ProductionProject) {
  const anchors = project.assets
    .filter(asset => asset.kind === 'prop')
    .map(asset => asset.name)
    .slice(0, 3);
  return anchors.length > 0 ? anchors.join('、') : project.storyBible.protagonist;
}

function buildVisualSegmentBridgePlan(project: ProductionProject): SegmentBridgePlan {
  const scene = projectSceneName(project);
  const anchors = visualAnchorNames(project);
  return {
    version: 'yh-segment-bridge-plan-v1',
    reference: {
      primary: 'ArcReel',
      adaptedIdeas: [
        '相邻镜头显式保存入点、出点和运动方向',
        '后一镜先承接前一镜尾帧，再推进新的视觉变化',
      ],
    },
    productionProjectId: project.id,
    bridges: project.storyboard.shots.map((shot, index) => {
      const previous = project.storyboard.shots[index - 1];
      const next = project.storyboard.shots[index + 1];
      return {
        segmentId: `${project.id}-segment-${index + 1}`,
        index,
        shotId: shot.id,
        fromBeat: previous?.storyBeat || shot.storyBeat,
        toBeat: next?.storyBeat || shot.storyBeat,
        entryState: previous
          ? `承接镜头${previous.index}的尾帧，保持${scene}、${anchors}和运动方向连续。`
          : `建立${scene}、${anchors}和整体光色。`,
        exitState: next
          ? `结尾保留能直接接入镜头${next.index}的构图、运动方向和对象状态。`
          : `结尾完整呈现${scene}中的最终视觉状态。`,
        bridgeAction: previous
          ? '先复现上一镜的尾帧状态，再让视觉对象沿同一方向继续演变。'
          : '从稳定构图开始，让核心视觉对象进入运动。',
        editBridge: previous
          ? '使用同方向运动、形态匹配或光色匹配衔接，避免无原因换景。'
          : '用清楚的空间建立镜头开始。',
        previousFrameMemory: previous
          ? `保留镜头${previous.index}尾帧的构图、光色、对象位置和运动方向。`
          : `首镜先交代${scene}和${anchors}。`,
        nextFrameTrigger: next
          ? `尾帧中的形态或运动必须自然指向镜头${next.index}。`
          : '尾帧停在完整、稳定、可交付的最终构图。',
        viewerCheckpoint: shot.prompt,
        continuityCheck: `场景=${scene}；视觉锚点=${anchors}；光色、尺度和运动方向保持连续。`,
      };
    }),
  };
}

function buildVisualBoundaryBridgePlan(
  project: ProductionProject,
  segmentBridgePlan: SegmentBridgePlan,
): BoundaryBridgePlan {
  return {
    version: 'yh-boundary-bridge-plan-v1',
    reference: {
      primary: 'ViMAX',
      secondary: ['ArcReel', 'Toonflow-app'],
      adaptedIdeas: [
        '相邻镜头边界保存上一段尾帧和下一段开场约束',
        '用形态、运动和光色匹配完成视觉衔接',
      ],
    },
    productionProjectId: project.id,
    boundaries: project.storyboard.shots.slice(0, -1).map((previous, index) => {
      const next = project.storyboard.shots[index + 1];
      const previousBridge = segmentBridgePlan.bridges[index];
      const nextBridge = segmentBridgePlan.bridges[index + 1];
      return {
        id: `${project.id}-boundary-${index + 1}-${index + 2}`,
        index,
        previousSegmentId: `${project.id}-segment-${index + 1}`,
        nextSegmentId: `${project.id}-segment-${index + 2}`,
        previousShotId: previous.id,
        nextShotId: next.id,
        sourceLastFrameUrl: null,
        targetFirstFrameUrl: null,
        bridgeVideoUrl: null,
        bridgeLastFrameUrl: null,
        newCameraImageUrl: null,
        sourceLastFrameHash: null,
        status: 'blocked',
        bridgeDurationSeconds: 2,
        bridgePrompt: [
          `从镜头${previous.index}的真实尾帧出发。`,
          previousBridge.exitState,
          nextBridge.entryState,
          '保持对象形态、光色和运动方向连续，不新增无关人物、场景或道具。',
        ].join('\n'),
        targetOpeningContract: nextBridge.entryState,
        editStrategy: 'transition-bridge',
        audioBridgeCue: '保留上一段环境声尾音，下一段沿同一节奏进入。',
        readiness: {
          pass: false,
          blockers: ['waiting-for-previous-last-frame'],
          warnings: ['bridge-video-not-generated-yet'],
        },
      };
    }),
  };
}

function buildVisualSegmentPrompt(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  bridgePlan: SegmentBridgePlan,
) {
  const bridge = bridgePlan.bridges.find(item => item.shotId === shot.id);
  const scene = projectSceneName(project);
  const anchors = visualAnchorNames(project);
  return [
    `【本镜画面】${shot.prompt}`,
    `【空间与光色】保持${scene}的空间结构、尺度和整体光色一致。`,
    `【视觉锚点】${anchors}的形态、位置关系和运动方向必须可辨认。`,
    `【入点状态】${bridge?.entryState || '从当前镜头设定开始。'}`,
    `【出点状态】${bridge?.exitState || '结尾保留可衔接的稳定状态。'}`,
    `【镜头衔接】${bridge?.editBridge || '保持同方向运动和光色连续。'}`,
    `【观众看到的变化】${shot.dramaticPurpose || shot.prompt}`,
    '【限制】不引入计划外人物、场景、道具、品牌标识、可读文字或水印。',
  ].join('\n');
}

function cleanSegmentExecutionPrompt(
  _project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number]
) {
  return shot.prompt.trim();
}

function visibleBeatForShot(
  _project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number]
) {
  return shot.prompt.trim();
}

function visibleConflictEvidenceForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number]) {
  return `用本镜计划中的动作和道具状态表现冲突，不添加旁白解释：${shot.prompt}`;
}

function visibleOperationResultForShot(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
) {
  return shot.actionEnd?.trim()
    ? `本段结束在计划动作终点：${shot.actionEnd.trim()}`
    : `本段结尾必须完成当前剧情目的：${shot.dramaticPurpose || project.storyBible.turningPoint}`;
}

function visibleNextQuestionForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number], index: number) {
  const isLast = index >= project.storyboard.shots.length - 1;
  if (isLast) return `最后画面只落实 Story Bible 的结尾钩子：${project.storyBible.endingHook}`;
  const next = project.storyboard.shots[index + 1];
  return `本段尾态必须能自然触发下一镜计划：${next?.dramaticPurpose || next?.prompt || '继续当前剧情'}`;
}

function visibleEndingHookEvidenceForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number], index: number) {
  const next = index < project.storyboard.shots.length - 1 ? project.storyboard.shots[index + 1] : null;
  if (next) {
    return next.firstFrameDescription?.trim()
      ? `尾帧必须与下一镜首帧状态相容：${next.firstFrameDescription.trim()}`
      : `尾帧必须自然连接镜头${next.index}：${next.prompt}`;
  }
  return `最终尾帧必须直接呈现结尾钩子：${project.storyBible.endingHook}`;
}

function actionCausalityForShot(
  _project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  index: number
) {
  const next = index < _project.storyboard.shots.length - 1 ? _project.storyboard.shots[index + 1] : null;
  return [
    shot.actionStart?.trim(),
    shot.actionEnd?.trim(),
    next?.actionStart?.trim(),
  ].filter(Boolean).join(' -> ') || shot.prompt.trim();
}

function bridgeActionForBeat(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number]) {
  if (shot.motionDescription?.trim()) return shot.motionDescription.trim();
  if (shot.actionStart?.trim() || shot.actionEnd?.trim()) {
    return `按计划从“${shot.actionStart || '当前状态'}”推进到“${shot.actionEnd || '本镜尾态'}”。`;
  }
  return `${project.storyBible.protagonist}完成本镜计划动作：${shot.prompt}`;
}

function segmentBridgeForShot(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  index: number
) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const location = projectSceneName(project, shot);
  const previous = index > 0 ? project.storyboard.shots[index - 1] : null;
  const next = index < project.storyboard.shots.length - 1 ? project.storyboard.shots[index + 1] : null;

  return {
    entryState: shot.firstFrameDescription?.trim()
      || shot.actionStart?.trim()
      || (previous
        ? `承接镜头${previous.index}的真实尾帧，再推进本镜动作。`
        : `开场建立${subject}在${location}与${prop}的空间关系。`),
    exitState: shot.lastFrameDescription?.trim()
      || shot.actionEnd?.trim()
      || (next
        ? `结尾保留能直接接入镜头${next.index}的稳定状态。`
        : `结尾呈现${project.storyBible.endingHook}`),
    bridgeAction: bridgeActionForBeat(project, shot),
    editBridge: previous
      ? `从上一段真实尾帧承接；若场景变化，当前镜头必须按计划完成空间过渡后再结束。`
      : `剪辑上用稳定开场建立主角、场景和道具，后续段落才能按同一空间继续。`,
    previousFrameMemory: previous?.lastFrameDescription?.trim()
      || previous?.actionEnd?.trim()
      || `第一段开头必须清楚建立${subject}在${location}与${prop}的空间关系。`,
    nextFrameTrigger: next?.firstFrameDescription?.trim()
      || next?.actionStart?.trim()
      || `最后一段收在 Story Bible 的结尾钩子：${project.storyBible.endingHook}`,
    viewerCheckpoint: `观众看完本段后必须能说清：${subject}对${prop}做了什么，局面因此发生了什么变化。`,
  };
}

function buildSegmentAudioState(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  bridge: SegmentBridge | undefined
): ProductionSegmentAudioState {
  const dialogue = shot.subtitleText?.trim() || null;
  const narration = shot.narrationText?.trim() || null;
  const soundCue = extractPromptSection(shot.prompt, '声音提示');
  const beat = project.storyBible.beats.find(item => item.id === shot.storyBeat);
  const emotion = shot.emotionShift || beat?.emotion || project.storyBible.emotionalArc.shift;
  const nonNarrative = isNonNarrativeProject(project);
  const soundDesign = [
    project.sceneType === 'drama'
      ? '环境声保持真实，背景音乐压低，突出角色动作、对白和危险提示音。'
      : '音乐节奏服务信息推进，不盖过关键口播、动作声和产品证据。',
    bridge?.continuityCheck ? `衔接声：${bridge.continuityCheck}` : '',
    soundCue ? `本段音效：${soundCue}` : '',
    dialogue ? `对白：${dialogue}` : nonNarrative ? '无对白。' : '无明确对白，角色保持自然呼吸和现场反应声。',
    narration ? `旁白：${narration}` : '',
  ].filter(Boolean).join(' ');
  const voiceStyle = nonNarrative
    ? '不添加人物对白；声音跟随画面节奏和空间变化。'
    : dialogue
    ? `${project.storyBible.protagonist}保持${emotion}的对白口型、语气和音色，避免跨段换声线。`
    : `${project.storyBible.protagonist}保持${emotion}的呼吸、停顿和反应声，避免无关旁白。`;
  const audioCue = [
    `情绪=${emotion}`,
    dialogue ? `对白=${dialogue}` : '对白=无',
    narration ? `旁白=${narration}` : '旁白=无',
    `声音=${soundDesign}`,
  ].join('；');

  return {
    dialogue,
    narration,
    soundDesign,
    voiceStyle,
    emotion,
    audioCue,
  };
}

function extractPromptSection(prompt: string, label: string) {
  const marker = `【${label}】`;
  const start = prompt.indexOf(marker);
  if (start < 0) return null;
  const bodyStart = start + marker.length;
  const next = prompt.indexOf('【', bodyStart);
  return prompt.slice(bodyStart, next >= 0 ? next : undefined).trim() || null;
}

function buildStoryAwareSegmentPrompt(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  bridgePlan: SegmentBridgePlan
) {
  const storyBible = project.storyBible;
  const beat = storyBible.beats.find(item => item.id === shot.storyBeat);
  const continuity = storyBible.continuityRules.slice(0, 4).join('；');
  const index = Math.max(0, shot.index - 1);
  const fallbackBridge = segmentBridgeForShot(project, shot, index);
  const bridge: SegmentBridge = bridgePlan.bridges.find(item => item.shotId === shot.id) || {
    segmentId: `${project.id}-segment-${index + 1}`,
    index,
    shotId: shot.id,
    fromBeat: shot.storyBeat,
    toBeat: shot.storyBeat,
    continuityCheck: `主角=${storyBible.protagonist}；场景=${projectSceneName(project, shot)}；关键道具=${primaryPropName(project)}`,
    ...fallbackBridge,
  };
  const checkpoint = bridge.viewerCheckpoint
    || `观众看完本段后必须能说清：${storyBible.protagonist}对${primaryPropName(project)}做了什么，局面因此发生了什么变化。`;
  return [
    storyBible.premise ? `【模型故事】${storyBible.premise}` : '',
    storyBible.desire ? `【角色动机】${storyBible.desire}` : '',
    storyBible.conflict ? `【故事冲突】${storyBible.conflict}` : '',
    `【剧情目的】${shot.dramaticPurpose || beat?.purpose || shot.prompt}`,
    `【观众必须看见】${visibleBeatForShot(project, shot)}`,
    `【视觉冲突证据】${visibleConflictEvidenceForShot(project, shot)}`,
    `【动作因果】${actionCausalityForShot(project, shot, index)}`,
    `【入点状态】${bridge.entryState}`,
    `【上一段画面记忆】${bridge.previousFrameMemory}`,
    `【出点状态】${bridge.exitState}`,
    `【下一段触发点】${bridge.nextFrameTrigger}`,
    `【桥接动作】${bridge.bridgeAction}`,
    `【剪辑衔接】${bridge.editBridge}`,
    `【操作结果】${visibleOperationResultForShot(project, shot)}`,
    `【结尾钩子证据】${visibleEndingHookEvidenceForShot(project, shot, index)}`,
    `【结尾新问题】${visibleNextQuestionForShot(project, shot, index)}`,
    checkpoint ? `【观众检查点】${checkpoint}` : '',
    bridge.continuityCheck ? `【连续性事实】${bridge.continuityCheck}` : '',
    continuity ? `【连续性规则】${continuity}` : '',
    `【镜头执行】${cleanSegmentExecutionPrompt(project, shot)}`,
    shot.subtitleText?.trim() ? `【对白】${shot.subtitleText.trim()}` : '',
    shot.narrationText?.trim() ? `【旁白】${shot.narrationText.trim()}` : '',
    shot.audioIntent?.trim() ? `【声音】${shot.audioIntent.trim()}` : '',
  ].filter(Boolean).join('\n');
}

export function buildProductionAssemblyPlan(params: BuildProductionAssemblyPlanParams): ProductionAssemblyPlan {
  const { productionProject, sourceTaskId } = params;
  const scriptAssetId = productionProject.assets.find(asset => asset.kind === 'script')?.id;
  const characterAssetIds = assetIdsByKind(productionProject, 'character');
  const sceneAssetIds = assetIdsByKind(productionProject, 'scene');
  const propAssetIds = assetIdsByKind(productionProject, 'prop');

  const nonNarrative = isNonNarrativeProject(productionProject);
  const bridgePlan = nonNarrative
    ? buildVisualSegmentBridgePlan(productionProject)
    : buildSegmentBridgePlan(productionProject);
  const boundaryBridgePlan = nonNarrative
    ? buildVisualBoundaryBridgePlan(productionProject, bridgePlan)
    : buildBoundaryBridgePlan(productionProject, bridgePlan);
  const segments: ProductionSegmentPlan[] = productionProject.storyboard.shots.map((shot, index) => {
    const bridge = bridgePlan.bridges.find(item => item.shotId === shot.id);
    const boundaryBridge = index > 0
      ? boundaryBridgePlan.boundaries.find(item => item.nextSegmentId === `${productionProject.id}-segment-${index + 1}`)
      : null;
    const prompt = nonNarrative
      ? buildVisualSegmentPrompt(productionProject, shot, bridgePlan)
      : buildStoryAwareSegmentPrompt(productionProject, shot, bridgePlan);
    const audioState = buildSegmentAudioState(productionProject, shot, bridge);
    const id = `${productionProject.id}-segment-${index + 1}`;
    const shotFrameContract = buildShotFrameContract({
      productionProject,
      shot,
      shotIndex: index,
      bridgePlan,
      executionPrompt: prompt,
    });
    const storySegmentContract = buildStorySegmentContract({
      productionProject,
      segmentId: id,
      index,
      shot,
      prompt,
      audioState,
      shotFrameContract,
      previousSegmentId: index > 0 ? `${productionProject.id}-segment-${index}` : null,
      nextSegmentId: index < productionProject.storyboard.shots.length - 1
        ? `${productionProject.id}-segment-${index + 2}`
        : null,
    });
    return {
      id,
      index,
      shotId: shot.id,
      duration: shot.duration,
      prompt,
      status: 'queued',
      dependencies: {
        scriptAssetId,
        characterAssetIds,
        sceneAssetIds,
        propAssetIds,
      },
      expectedInputs: {
        firstFrameUrl: null,
        previousLastFrameUrl: null,
        sourceSegmentId: index > 0 ? `${productionProject.id}-segment-${index}` : null,
        sourceAssetId: null,
        continuityPrompt: index > 0
          ? '等待上一段完成后写入尾帧参考；下一段开头必须先复现上一段最后状态再推进。'
          : nonNarrative
            ? '第一段负责建立空间、光色、视觉锚点和运动方向。'
            : '第一段负责建立主角、场景、关键道具和初始冲突。',
        previousAudioCue: null,
        audioContinuityPrompt: index > 0
          ? '等待上一段完成后写入声音/对白/情绪状态；下一段开头必须承接上一段的环境音、对白余韵和情绪。'
          : '第一段负责建立声音基调、角色语气、环境音和初始情绪。',
        previousStoryStateCue: null,
        storyContinuityPrompt: index > 0
          ? nonNarrative
            ? '等待上一段完成后写入视觉状态；下一段开头必须承接上一段的对象状态、运动和光色。'
            : '等待上一段完成后写入故事状态；下一段开头必须承接上一段的目标、冲突、道具状态和情绪变化。'
          : nonNarrative
            ? '第一段负责建立视觉对象、空间和初始运动状态。'
            : '第一段负责建立主角目标、冲突对象、关键道具和初始情绪。',
        boundaryBridgeId: boundaryBridge?.id || null,
        boundaryBridgePrompt: boundaryBridge?.bridgePrompt || null,
        bridgeFirstFrameUrl: null,
        bridgeStrategy: boundaryBridge?.editStrategy || null,
      },
      expectedOutputs: {
        videoUrl: null,
        lastFrameUrl: null,
        taskId: null,
        audioCue: audioState.audioCue,
        hasAudio: null,
        storyStateCue: describeStorySegmentCue(storySegmentContract),
      },
      audioState,
      shotFrameContract,
      storySegmentContract,
      retryPolicy: {
        maxRetries: 2,
        retryable: true,
        fallback: '保留已完成片段 URL，仅重试失败片段；合成失败时不得把首段冒充成片。',
      },
    };
  });

  const readiness = evaluateAssemblyShotFrameReadiness(segments);

  return {
    version: 'yh-assembly-plan-v1',
    reference: {
      primary: 'ArcReel',
      adaptedIdeas: [
        '剧本/分镜不是最终结果，必须进入异步片段任务队列',
        '每个片段都要持久化 taskId、videoUrl、lastFrameUrl 和失败原因',
        '合成和导出独立于片段生成；合成失败时保留已生成片段并支持恢复',
        '真实排队前必须通过 ViMAX 式镜头首尾帧合约，避免字段齐但段落无法衔接',
        '相邻片段边界作为独立 bridge artifact 追踪，避免只靠硬切和 prompt 承接',
      ],
    },
    productionProjectId: productionProject.id,
    sourceTaskId,
    totalDuration: segments.reduce((sum, segment) => sum + segment.duration, 0),
    segmentCount: segments.length,
    segmentDurationHint: productionProject.segmentDuration,
    status: readiness.pass ? 'planned' : 'failed',
    bridgePlan,
    boundaryBridgePlan,
    readiness,
    segments,
    assembly: {
      strategy: 'boundary-bridge-concat',
      requiresAllSegments: true,
      outputUrl: null,
      exportFormats: ['mp4', 'cut-draft-json'],
    },
    recovery: {
      persistEachSegment: true,
      resumeFromSegmentIndex: 0,
      canRetryFailedSegments: true,
      failurePolicy: '任一片段失败即停止向后加时长，保留已完成片段，任务中心展示可读失败原因和重试建议。',
    },
    nextAction: readiness.pass
      ? '确认 BYOK 和视频模型后，按片段顺序创建视频任务；每段成功后立即写回任务结果。'
      : readiness.nextAction,
  };
}
