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

function projectSceneName(project: ProductionProject) {
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
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number]
) {
  const subject = project.storyBible.protagonist;
  const location = projectSceneName(project);
  const prop = primaryPropName(project);
  const cleanPrompt = shot.prompt
    .replaceAll('辽阔的海边沙滩，浪花轻柔拍打岸边', location)
    .replaceAll('温馨舒适的室内空间', location)
    .replaceAll('柔和的自然光空间', location)
    .replaceAll('故事发生的场景空间', location)
    .replaceAll('壮丽的自然景观', location)
    .replaceAll('人物形象展示', `${subject}面对${prop}的选择`)
    .replace(/[\u4e00-\u9fa5]{0,6}(女性|男性)?穿着舒适家居服的人物/g, subject)
    .replace(/着装符合人物身份和剧情场景的人物/g, subject)
    .trim();
  return [
    `本镜头必须让观众直接看见${subject}在${location}围绕${prop}完成剧情动作`,
    cleanPrompt,
    `结尾保留${prop}的明确状态，连接下一段。`,
  ].join('。');
}

function visibleBeatForShot(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number]
) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const location = projectSceneName(project);

  switch (shot.storyBeat) {
    case 'setup':
      return `观众必须看见${subject}身处${location}，手边或视线里出现${prop}，让故事从人物处境开始，而不是空镜。`;
    case 'inciting':
      return `观众必须看见${subject}发现${prop}出现异常信息，并做出停下、靠近、拿起或查看的明确动作。`;
    case 'conflict':
      return `观众必须看见${prop}带来的威胁升级：画面中出现被威胁的人/地点/对象、倒计时、报警屏、阻挡者或环境压力，${subject}明显被迫选择。`;
    case 'turning':
      return `观众必须看见${subject}主动改变行动：重剪、调换、按下、藏起或夺回${prop}，让转折通过动作发生。`;
    case 'resolution':
      return `观众必须看见${subject}的选择造成结果：${prop}状态改变、失败结局被改写或留下新悬念，最后画面必须出现一个新的未解问题。`;
    default:
      return `观众必须看见${subject}围绕${prop}完成一个清楚动作，动作前后状态发生变化。`;
  }
}

function visibleThreatTargetForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number]) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  if (shot.storyBeat === 'setup') return `先让观众看见${subject}所在场景里谁或什么可能受影响，不要只拍${prop}特写。`;
  return `画面必须出现被威胁对象：人、车厢、孩子、客户、店铺、避难所、公开证据或${subject}必须保护/挽回的具体对象。`;
}

function visibleDangerSourceForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number]) {
  const prop = primaryPropName(project);
  if (shot.storyBeat === 'setup') return `${prop}或环境里必须埋下危险源线索，例如异常屏幕、警报灯、倒计时、裂缝、封锁线或错误数据。`;
  return `危险源必须入画：倒计时、报警屏、追赶者、断裂结构、失控装置、直播曝光或具体失败画面，不能只靠主角表情表示紧张。`;
}

function visibleConflictEvidenceForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number]) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  if (shot.storyBeat === 'setup') {
    return `开场也必须埋下冲突证据：${prop}的异常状态、环境警报、被威胁对象或失败提示至少出现一个，不能只展示美术氛围。`;
  }
  if (shot.storyBeat === 'resolution') {
    return `结尾必须保留冲突余波：${prop}的新状态、危险源熄灭/转移、被威胁对象未完全安全或${subject}发现更大风险。`;
  }
  return `本段必须把冲突拍成外部证据：危险源、阻挡物、失败提示、倒计时、追赶者或被威胁对象必须和${subject}的选择同画面出现。`;
}

function visibleOperationResultForShot(project: ProductionProject) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  return `本段结尾必须看见${subject}操作后的结果：${prop}屏幕内容改变、危险被短暂阻止、失败对象暴露、新路线打开或局面变得更糟。`;
}

function visibleNextQuestionForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number], index: number) {
  const prop = primaryPropName(project);
  const subject = project.storyBible.protagonist;
  const isLast = index >= project.storyboard.shots.length - 1;
  if (isLast) return `最后画面必须留下新问题：${prop}出现新状态、屏幕弹出新线索、被威胁对象仍未完全安全或${subject}发现更大的危险。`;
  return `本段结尾必须留下下一段问题：${prop}的新状态、危险源的新变化或被威胁对象的新位置要清楚可见。`;
}

function visibleEndingHookEvidenceForShot(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number], index: number) {
  const prop = primaryPropName(project);
  const subject = project.storyBible.protagonist;
  const next = index < project.storyboard.shots.length - 1 ? project.storyboard.shots[index + 1] : null;
  if (next) {
    return `尾帧必须给下一段可接的画面钩子：${subject}的视线/手部动作、${prop}状态、危险源变化或被威胁对象新位置要指向镜头${next.index}。`;
  }
  return `最终尾帧必须是可截图理解的悬念：${prop}新状态、未完全安全的对象、熄灭/误导的危险提示或${subject}的结果反应同框出现。`;
}

function actionCausalityForShot(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  index: number
) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const previous = index > 0 ? project.storyboard.shots[index - 1] : null;
  const next = index < project.storyboard.shots.length - 1 ? project.storyboard.shots[index + 1] : null;
  return [
    previous ? `承接上一镜头 ${previous.index} 的动作/道具状态` : `开场先交代${subject}和${prop}的空间关系`,
    `本镜头必须完成一个可见动作：${subject}观察、触碰、移动、隐藏、改写或交付${prop}`,
    next ? `结尾要给下一镜头 ${next.index} 留下清楚因果钩子` : '结尾要留下结果画面或悬念画面',
  ].join('；');
}

function bridgeActionForBeat(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number]) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const location = projectSceneName(project);

  switch (shot.storyBeat) {
    case 'setup':
      return `${subject}的视线从${location}环境扫到${prop}，用一个停顿或靠近动作把观众带到线索上。`;
    case 'inciting':
      return `${subject}拿起、插入、按下或查看${prop}，画面必须显示异常信息第一次被触发。`;
    case 'conflict':
      return `${prop}里的威胁信息升级，${subject}从被动观看转为做出选择，动作不能只是站立凝视。`;
    case 'turning':
      return `${subject}主动重剪、调换、倒带、藏起或按下关键按钮，让改写结局这件事通过手部动作发生。`;
    case 'resolution':
      return `${prop}状态改变后，${subject}和画面中的结果产生可见反应，最后留下新状态或悬念。`;
    default:
      return `${subject}围绕${prop}完成一个从旧状态到新状态的可见动作。`;
  }
}

function segmentBridgeForShot(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  index: number
) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const location = projectSceneName(project);
  const previous = index > 0 ? project.storyboard.shots[index - 1] : null;
  const next = index < project.storyboard.shots.length - 1 ? project.storyboard.shots[index + 1] : null;

  return {
    entryState: previous
      ? `承接上一段末尾：${subject}仍在${location}，${prop}的位置、屏幕内容或手部动作保持连续；开头1-2秒先复现上一段最后状态，再推进新信息。`
      : `开场先建立${subject}在${location}与${prop}的空间关系，让观众知道谁在哪里、正在面对什么。`,
    exitState: next
      ? `本段结尾必须留下下一段能接住的明确状态：${subject}的视线、手部动作或${prop}的屏幕/位置发生变化，并指向镜头${next.index}。`
      : `结尾必须把${prop}的新状态和${subject}的结果反应放在同一画面里，不要突然切到无关空镜。`,
    bridgeAction: bridgeActionForBeat(project, shot),
    editBridge: previous
      ? `剪辑上把上一段末尾动作当作本段开场动作，避免换人、换景、换道具或无原因跳到新构图。`
      : `剪辑上用稳定开场建立主角、场景和道具，后续段落才能按同一空间继续。`,
    previousFrameMemory: previous
      ? `复现上一段最后一帧的三件事：${subject}的身体朝向、${prop}的位置或屏幕内容、${location}里的危险标识。`
      : `第一段开头必须清楚建立${subject}在${location}与${prop}的空间关系。`,
    nextFrameTrigger: next
      ? `结尾留给下一段的触发点：${subject}的视线、手部动作或${prop}状态变化必须指向镜头${next.index}。`
      : `最后一段收在${prop}的新状态和${subject}的结果反应上，不突然换到无关画面。`,
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
    continuityCheck: `主角=${storyBible.protagonist}；场景=${projectSceneName(project)}；关键道具=${primaryPropName(project)}`,
    ...fallbackBridge,
  };
  const checkpoint = bridge.viewerCheckpoint
    || `观众看完本段后必须能说清：${storyBible.protagonist}对${primaryPropName(project)}做了什么，局面因此发生了什么变化。`;
  return [
    `【短剧前提】${storyBible.premise}`,
    `【角色动机】${storyBible.desire}`,
    `【当前冲突】${storyBible.conflict}`,
    `【剧情目的】${shot.dramaticPurpose || beat?.purpose || '推进当前剧情节点'}`,
    `【观众必须看见】${visibleBeatForShot(project, shot)}`,
    `【威胁对象】${visibleThreatTargetForShot(project, shot)}`,
    `【危险源】${visibleDangerSourceForShot(project, shot)}`,
    `【视觉冲突证据】${visibleConflictEvidenceForShot(project, shot)}`,
    `【观众检查点】${checkpoint}`,
    `【动作因果】${actionCausalityForShot(project, shot, index)}`,
    `【入点状态】${bridge.entryState}`,
    `【上一段画面记忆】${bridge.previousFrameMemory}`,
    `【出点状态】${bridge.exitState}`,
    `【下一段触发点】${bridge.nextFrameTrigger}`,
    `【桥接动作】${bridge.bridgeAction}`,
    `【剪辑衔接】${bridge.editBridge}`,
    `【操作结果】${visibleOperationResultForShot(project)}`,
    `【结尾钩子证据】${visibleEndingHookEvidenceForShot(project, shot, index)}`,
    `【结尾新问题】${visibleNextQuestionForShot(project, shot, index)}`,
    `【预告片节拍】${bridge.fromBeat} -> ${bridge.toBeat}`,
    `【连续性检查】${bridge.continuityCheck}`,
    `【道具状态】${primaryPropName(project)}必须在画面中有可见状态变化或明确位置，不要只作为抽象概念出现。`,
    `【情绪变化】${shot.emotionShift || beat?.emotion || storyBible.emotionalArc.shift}`,
    `【连续性规则】${continuity}`,
    `【镜头执行】${cleanSegmentExecutionPrompt(project, shot)}`,
    `【三要素验收】如果观众看不出${storyBible.protagonist}、${projectSceneName(project)}和${primaryPropName(project)}之间发生了什么，本段视为失败。`,
    '要求：画面必须服务剧情，主体动作、道具状态和场景阻碍都要能被观众直接看出来；不要只展示无意义的宇宙、胶片、抽象流光、空镜、纯氛围特写或无法推动故事的美术素材；保留角色、场景、道具的连续性。',
  ].join('\n');
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
