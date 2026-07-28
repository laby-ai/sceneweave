import type { ProductionProject, ProductionStoryBeatId } from './production-project';

export type TrailerBeatKind = 'hook' | 'setup' | 'inciting' | 'escalation' | 'turning' | 'climax' | 'button';

export interface TrailerBeat {
  id: string;
  kind: TrailerBeatKind;
  label: string;
  timeRange: string;
  purpose: string;
  requiredVisual: string;
  viewerCheckpoint: string;
  storyQuestion: string;
  imageHandoff: string;
  audioCue: string;
  sourceStoryBeat: ProductionStoryBeatId;
  shotIds: string[];
}

export interface TrailerBeatSheet {
  version: 'yh-trailer-beat-sheet-v1';
  reference: {
    primary: 'ViMAX';
    adaptedIdeas: string[];
  };
  duration: number;
  structure: '30s-trailer' | '60s-trailer' | '90s-trailer';
  logline: string;
  beats: TrailerBeat[];
  continuityRules: string[];
}

export interface SegmentBridge {
  segmentId: string;
  index: number;
  shotId: string;
  fromBeat: string;
  toBeat: string;
  entryState: string;
  exitState: string;
  bridgeAction: string;
  editBridge: string;
  previousFrameMemory: string;
  nextFrameTrigger: string;
  viewerCheckpoint: string;
  continuityCheck: string;
}

export interface SegmentBridgePlan {
  version: 'yh-segment-bridge-plan-v1';
  reference: {
    primary: 'ArcReel';
    adaptedIdeas: string[];
  };
  productionProjectId: string;
  bridges: SegmentBridge[];
}

export type BoundaryBridgeStatus = 'planned' | 'blocked' | 'ready' | 'generated' | 'stale';

export interface BoundaryBridge {
  id: string;
  index: number;
  previousSegmentId: string;
  nextSegmentId: string;
  previousShotId: string;
  nextShotId: string;
  sourceLastFrameUrl: string | null;
  targetFirstFrameUrl: string | null;
  bridgeVideoUrl: string | null;
  bridgeLastFrameUrl: string | null;
  newCameraImageUrl: string | null;
  sourceLastFrameHash?: string | null;
  status: BoundaryBridgeStatus;
  bridgeDurationSeconds: number;
  bridgePrompt: string;
  targetOpeningContract: string;
  editStrategy: 'transition-bridge' | 'direct-tail-frame-fallback';
  audioBridgeCue: string;
  readiness: {
    pass: boolean;
    blockers: string[];
    warnings: string[];
  };
}

export interface BoundaryBridgePlan {
  version: 'yh-boundary-bridge-plan-v1';
  reference: {
    primary: 'ViMAX';
    secondary: Array<'ArcReel' | 'Toonflow-app'>;
    adaptedIdeas: string[];
  };
  productionProjectId: string;
  boundaries: BoundaryBridge[];
}

function primaryPropName(project: ProductionProject) {
  return project.assets.find(asset => asset.kind === 'prop')?.name || '关键线索';
}

function sceneName(
  project: ProductionProject,
  shot?: ProductionProject['storyboard']['shots'][number],
) {
  if (shot?.sceneLabel?.trim()) return shot.sceneLabel.trim();
  return project.assets.find(asset => asset.kind === 'scene')?.name
    || project.semanticPlan?.sceneBibles?.[0]?.name
    || '主要场景';
}

function trailerStructure(duration: number): TrailerBeatSheet['structure'] {
  if (duration <= 45) return '30s-trailer';
  if (duration <= 75) return '60s-trailer';
  return '90s-trailer';
}

function trailerKindForBeat(beatId: ProductionStoryBeatId, index: number, total: number): TrailerBeatKind {
  if (index === 0) return 'hook';
  if (index === total - 1) return 'button';
  if (beatId === 'setup') return 'setup';
  if (beatId === 'inciting') return 'inciting';
  if (beatId === 'turning') return 'turning';
  if (beatId === 'resolution') return 'climax';
  return 'escalation';
}

export function buildTrailerBeatSheet(productionProject: ProductionProject): TrailerBeatSheet {
  const structure = trailerStructure(productionProject.duration);
  let elapsed = 0;
  const beats = productionProject.storyboard.shots.map((shot, index) => {
    const start = elapsed;
    elapsed += shot.duration;
    const nextShot = productionProject.storyboard.shots[index + 1];
    const source = productionProject.storyBible.beats.find(beat => beat.id === shot.storyBeat);
    const kind = trailerKindForBeat(shot.storyBeat, index, productionProject.storyboard.shots.length);
    const targetState = nextShot?.firstFrameDescription?.trim()
      || nextShot?.actionStart?.trim()
      || productionProject.storyBible.endingHook;
    return {
      id: `trailer-beat-${index + 1}`,
      kind,
      label: shot.phaseLabel || shot.dramaticPurpose || `镜头 ${index + 1}`,
      timeRange: `${start}-${elapsed}s`,
      purpose: shot.dramaticPurpose || source?.purpose || shot.prompt,
      requiredVisual: shot.prompt,
      viewerCheckpoint: shot.actionEnd?.trim()
        || shot.lastFrameDescription?.trim()
        || shot.prompt,
      storyQuestion: targetState,
      imageHandoff: [
        shot.lastFrameDescription?.trim() || shot.actionEnd?.trim(),
        targetState,
      ].filter(Boolean).join(' -> '),
      audioCue: shot.audioIntent?.trim()
        || shot.subtitleText?.trim()
        || shot.narrationText?.trim()
        || '',
      sourceStoryBeat: shot.storyBeat,
      shotIds: [shot.id],
    };
  });

  return {
    version: 'yh-trailer-beat-sheet-v1',
    reference: {
      primary: 'ViMAX',
      adaptedIdeas: [
        '模型逐镜计划是唯一叙事事实源',
        '节拍 artifact 只索引模型镜头，不补写剧情',
        '相邻镜头只保存真实尾态、目标首态和媒体血缘',
      ],
    },
    duration: productionProject.duration,
    structure,
    logline: productionProject.storyBible.premise,
    beats,
    continuityRules: productionProject.storyBible.continuityRules,
  };
}

function bridgeAction(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
) {
  if (shot.motionDescription?.trim()) return shot.motionDescription.trim();
  if (shot.actionStart?.trim() || shot.actionEnd?.trim()) {
    return `从“${shot.actionStart || '本镜起始状态'}”推进到“${shot.actionEnd || '本镜结束状态'}”。`;
  }
  return `${project.storyBible.protagonist}完成本镜计划动作：${shot.prompt}`;
}

function previousFrameMemory(project: ProductionProject, shot: ProductionProject['storyboard']['shots'][number], previous?: ProductionProject['storyboard']['shots'][number]) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const scene = sceneName(project, shot);
  if (!previous) {
    return `第一段开头必须清楚建立${subject}在${scene}与${prop}的空间关系。`;
  }
  return previous.lastFrameDescription?.trim()
    || previous.actionEnd?.trim()
    || `复现镜头${previous.index}的真实尾帧，再推进本镜计划。`;
}

function nextFrameTrigger(project: ProductionProject, next?: ProductionProject['storyboard']['shots'][number]) {
  if (!next) {
    return `最后一段收在 Story Bible 的结尾钩子：${project.storyBible.endingHook}`;
  }
  return next.firstFrameDescription?.trim()
    || next.actionStart?.trim()
    || `结尾必须自然连接镜头${next.index}：${next.prompt}`;
}

export function buildSegmentBridgePlan(productionProject: ProductionProject, trailerBeatSheet = buildTrailerBeatSheet(productionProject)): SegmentBridgePlan {
  const subject = productionProject.storyBible.protagonist;
  const prop = primaryPropName(productionProject);
  const bridges = productionProject.storyboard.shots.map((shot, index) => {
    const previous = productionProject.storyboard.shots[index - 1];
    const next = productionProject.storyboard.shots[index + 1];
    const scene = sceneName(productionProject, shot);
    const previousScene = previous ? sceneName(productionProject, previous) : scene;
    const currentBeat = trailerBeatSheet.beats.find(beat => beat.shotIds.includes(shot.id))
      || trailerBeatSheet.beats[Math.min(index, trailerBeatSheet.beats.length - 1)];
    const nextBeat = next
      ? trailerBeatSheet.beats.find(beat => beat.shotIds.includes(next.id)) || currentBeat
      : currentBeat;

    return {
      segmentId: `${productionProject.id}-segment-${index + 1}`,
      index,
      shotId: shot.id,
      fromBeat: currentBeat.label,
      toBeat: nextBeat.label,
      entryState: shot.firstFrameDescription?.trim()
        || shot.actionStart?.trim()
        || (previous
          ? `承接镜头${previous.index}在${previousScene}的真实尾帧，再进入${scene}。`
          : `开场建立${subject}、${scene}和${prop}的空间关系。`),
      exitState: shot.lastFrameDescription?.trim()
        || shot.actionEnd?.trim()
        || (next
          ? `结尾保留能接入镜头${next.index}的稳定状态。`
          : `结尾呈现${productionProject.storyBible.endingHook}`),
      bridgeAction: bridgeAction(productionProject, shot),
      editBridge: previous
        ? previousScene === scene
          ? '从上一段真实尾帧继续同一动作，保持主体、道具和运动方向。'
          : `本镜负责完成从${previousScene}到${scene}的空间过渡，尾帧必须已经落在${scene}。`
        : '剪辑上先用稳定开场建立主角、场景和道具，后续段落按同一空间继续。',
      previousFrameMemory: previousFrameMemory(productionProject, shot, previous),
      nextFrameTrigger: nextFrameTrigger(productionProject, next),
      viewerCheckpoint: currentBeat.viewerCheckpoint,
      continuityCheck: `主角=${subject}；当前场景=${scene}；关键道具=${prop}；动作终点=${shot.actionEnd || '按本镜计划验收'}。`,
    };
  });

  return {
    version: 'yh-segment-bridge-plan-v1',
    reference: {
      primary: 'ArcReel',
      adaptedIdeas: [
        '每个片段不只保存 prompt，还保存入点、出点、桥接动作和剪辑策略',
        '每段显式保存上一帧记忆、下一帧触发点和观众检查点，防止段落硬切',
        '失败恢复时可以从 bridgePlan 判断重试片段应继承的上一段状态',
        '导出/合成前先检查 bridgePlan，避免第一段成功后伪装成完整成片',
      ],
    },
    productionProjectId: productionProject.id,
    bridges,
  };
}

function bridgePromptForBoundary(
  project: ProductionProject,
  previous: ProductionProject['storyboard']['shots'][number],
  next: ProductionProject['storyboard']['shots'][number],
  previousBridge: SegmentBridge,
  nextBridge: SegmentBridge
) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const previousScene = sceneName(project, previous);
  const nextScene = sceneName(project, next);
  return [
    `边界桥接 ${previous.index}->${next.index}：从上一段真实尾帧出发，保持${subject}和${prop}的身份状态连续。`,
    previousScene === nextScene
      ? `场景保持${previousScene}。`
      : `空间从${previousScene}过渡到${nextScene}，不得把${nextScene}误写成${previousScene}。`,
    `上一段出口：${previousBridge.exitState}`,
    `下一段入口：${nextBridge.entryState}`,
    `桥接动作：${previousBridge.nextFrameTrigger}；${nextBridge.bridgeAction}`,
    '镜头语法：用动作匹配、道具状态匹配或同方向运动完成过渡，避免硬切到新人物、新服装、新景别或新空间。',
    '输出目标：生成可抽取 newCameraImage 的 1.5-2 秒过渡片段，最后一帧能作为下一段开场参考。',
  ].join('\n');
}

export function buildBoundaryBridgePlan(
  productionProject: ProductionProject,
  segmentBridgePlan = buildSegmentBridgePlan(productionProject)
): BoundaryBridgePlan {
  const boundaries = productionProject.storyboard.shots.slice(0, -1).map((previous, index) => {
    const next = productionProject.storyboard.shots[index + 1];
    const previousSegmentId = `${productionProject.id}-segment-${index + 1}`;
    const nextSegmentId = `${productionProject.id}-segment-${index + 2}`;
    const previousBridge = segmentBridgePlan.bridges.find(bridge => bridge.shotId === previous.id)
      || segmentBridgePlan.bridges[index];
    const nextBridge = segmentBridgePlan.bridges.find(bridge => bridge.shotId === next.id)
      || segmentBridgePlan.bridges[index + 1]
      || previousBridge;
    const bridgePrompt = bridgePromptForBoundary(
      productionProject,
      previous,
      next,
      previousBridge,
      nextBridge
    );

    return {
      id: `${productionProject.id}-boundary-${index + 1}-${index + 2}`,
      index,
      previousSegmentId,
      nextSegmentId,
      previousShotId: previous.id,
      nextShotId: next.id,
      sourceLastFrameUrl: null,
      targetFirstFrameUrl: null,
      bridgeVideoUrl: null,
      bridgeLastFrameUrl: null,
      newCameraImageUrl: null,
      sourceLastFrameHash: null,
      status: 'blocked' as const,
      bridgeDurationSeconds: 2,
      bridgePrompt,
      targetOpeningContract: nextBridge.entryState,
      editStrategy: 'transition-bridge' as const,
      audioBridgeCue: [
        `声音桥接：保留上一段环境声尾音，进入下一段前不新增解释性旁白。`,
        `下一段声音入口：${nextBridge.continuityCheck}`,
      ].join(' '),
      readiness: {
        pass: false,
        blockers: ['waiting-for-previous-last-frame'],
        warnings: ['bridge-video-not-generated-yet'],
      },
    };
  });

  return {
    version: 'yh-boundary-bridge-plan-v1',
    reference: {
      primary: 'ViMAX',
      secondary: ['ArcReel', 'Toonflow-app'],
      adaptedIdeas: [
        '把相邻片段边界作为独立 artifact，而不是只把上一段尾帧塞进下一段 prompt',
        '为每个 i->i+1 边界保存 sourceLastFrame、targetOpeningContract、bridgePrompt 和 newCameraImage 槽位',
        '边界桥接状态参与恢复和 QA，避免 URL 写回成功但视觉仍硬切',
        '声音桥接与画面桥接一起记录，后续合成可做 J-cut/L-cut 或短 crossfade',
      ],
    },
    productionProjectId: productionProject.id,
    boundaries,
  };
}
