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

function sceneName(project: ProductionProject) {
  return project.assets.find(asset => asset.kind === 'scene')?.name
    || project.semanticPlan?.sceneBibles?.[0]?.name
    || '主要场景';
}

function trailerStructure(duration: number): TrailerBeatSheet['structure'] {
  if (duration <= 45) return '30s-trailer';
  if (duration <= 75) return '60s-trailer';
  return '90s-trailer';
}

function timeRanges(duration: number, count: number) {
  const ranges: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = Math.round((duration * index) / count);
    const end = Math.round((duration * (index + 1)) / count);
    ranges.push(`${start}-${end}s`);
  }
  return ranges;
}

function beatKind(index: number, total: number): TrailerBeatKind {
  if (index === 0) return 'hook';
  if (index === 1) return 'setup';
  if (index === 2) return 'inciting';
  if (index < total - 2) return 'escalation';
  if (index === total - 2) return 'climax';
  return 'button';
}

function beatLabel(kind: TrailerBeatKind) {
  const labels: Record<TrailerBeatKind, string> = {
    hook: '冷开场钩子',
    setup: '主角和目标',
    inciting: '引爆事件',
    escalation: '冲突升级',
    turning: '关键转折',
    climax: '最强预告片瞬间',
    button: '结尾悬念',
  };
  return labels[kind];
}

function sourceBeat(kind: TrailerBeatKind, index: number, storyBeatIds: ProductionStoryBeatId[]): ProductionStoryBeatId {
  if (kind === 'hook' || kind === 'setup') return storyBeatIds.find(id => id === 'setup') || storyBeatIds[0];
  if (kind === 'inciting') return storyBeatIds.find(id => id === 'inciting') || storyBeatIds[Math.min(index, storyBeatIds.length - 1)];
  if (kind === 'climax') return storyBeatIds.find(id => id === 'turning') || storyBeatIds[Math.min(index, storyBeatIds.length - 1)];
  if (kind === 'button') return storyBeatIds.find(id => id === 'resolution') || storyBeatIds[storyBeatIds.length - 1];
  return storyBeatIds.find(id => id === 'conflict') || storyBeatIds[Math.min(index, storyBeatIds.length - 1)];
}

function requiredVisual(project: ProductionProject, kind: TrailerBeatKind) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const scene = sceneName(project);
  switch (kind) {
    case 'hook':
      return `用一个不解释但能看懂的异常画面抓住观众：${scene}里${prop}状态异常，同时露出被威胁对象或危险源，${subject}即将被牵入事件。`;
    case 'setup':
      return `明确展示${subject}、目标、被威胁对象和赌注，观众要知道主角为什么必须行动。`;
    case 'inciting':
      return `${subject}发现${prop}触发新信息，动作必须是拿起、查看、按下、推开或冲向目标，并让屏幕/环境显示危险源。`;
    case 'escalation':
      return `危险升级到画面可见：被威胁对象、阻挡、倒计时、追赶、警报、坍塌、直播或数据失控必须入画。`;
    case 'climax':
      return `${subject}做出最大风险动作，让预告片的高光通过身体动作、道具状态和操作结果发生。`;
    case 'button':
      return `只给结果边缘和悬念：${prop}状态改变，并出现新的未解问题或更大危险，不提前解释完整结局。`;
    default:
      return `${subject}围绕${prop}完成一个能改变局面的动作。`;
  }
}

function viewerCheckpoint(project: ProductionProject, kind: TrailerBeatKind) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  switch (kind) {
    case 'hook':
      return `观众不用读字幕也能回答：发生了什么异常，${prop}为什么值得注意。`;
    case 'setup':
      return `观众能说清${subject}是谁、想做什么、为什么不能离开。`;
    case 'inciting':
      return `观众能看见${prop}触发新信息，并理解${subject}必须马上行动。`;
    case 'escalation':
      return `观众能看见失败风险升级：谁会受损、危险来自哪里，不只是角色表情变紧张。`;
    case 'climax':
      return `观众能看见${subject}做出最大风险动作，并看见操作结果让局面明显不同。`;
    case 'button':
      return `观众能记住最后一个悬念画面，说出新的未解问题，并期待下一场。`;
    default:
      return `观众能看懂${subject}围绕${prop}完成了什么动作。`;
  }
}

function storyQuestion(project: ProductionProject, kind: TrailerBeatKind) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  switch (kind) {
    case 'hook':
      return `${prop}为什么会出现在这里？`;
    case 'setup':
      return `${subject}为什么必须介入？`;
    case 'inciting':
      return `${prop}暴露了什么新危险？`;
    case 'escalation':
      return `${subject}如果失败会失去什么？`;
    case 'climax':
      return `${subject}敢不敢付出代价改写结果？`;
    case 'button':
      return `结果真的被改写了吗？`;
    default:
      return `${subject}下一步要做什么？`;
  }
}

function imageHandoff(project: ProductionProject, kind: TrailerBeatKind) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const scene = sceneName(project);
  switch (kind) {
    case 'hook':
      return `${scene}中的${prop}特写作为下一段视觉接力棒。`;
    case 'setup':
      return `${subject}的视线落到${prop}，下一段从同一视线方向接起。`;
    case 'inciting':
      return `${prop}上的异常信息保持在画面中，下一段先复现该状态。`;
    case 'escalation':
      return `危险标识、倒计时或阻挡物保持同一位置，下一段承接升级。`;
    case 'climax':
      return `${subject}的手部动作或身体冲刺方向作为下一段开头动作。`;
    case 'button':
      return `${prop}的新状态留在最后一帧，作为首页/素材回看时的记忆点。`;
    default:
      return `${subject}、${scene}、${prop}三者关系必须在相邻段落保持。`;
  }
}

function audioCue(project: ProductionProject, kind: TrailerBeatKind) {
  if (kind === 'hook') return '冷开场低频、环境声或一句短促求救/警报。';
  if (kind === 'button') return `声音戛然而止，保留一句和${primaryPropName(project)}有关的悬念声。`;
  return '音乐逐步抬升，字幕/旁白只补充目标和危险，不解释画面已经能表达的信息。';
}

export function buildTrailerBeatSheet(productionProject: ProductionProject): TrailerBeatSheet {
  const structure = trailerStructure(productionProject.duration);
  const targetCount = structure === '30s-trailer' ? 5 : structure === '60s-trailer' ? 7 : 8;
  const storyBeatIds = productionProject.storyBible.beats.map(beat => beat.id);
  const ranges = timeRanges(productionProject.duration, targetCount);
  const beats = ranges.map((timeRange, index) => {
    const kind = beatKind(index, ranges.length);
    const storyBeatId = sourceBeat(kind, index, storyBeatIds);
    const source = productionProject.storyBible.beats.find(beat => beat.id === storyBeatId);
    return {
      id: `trailer-beat-${index + 1}`,
      kind,
      label: beatLabel(kind),
      timeRange,
      purpose: source?.purpose || productionProject.storyBible.conflict,
      requiredVisual: requiredVisual(productionProject, kind),
      viewerCheckpoint: viewerCheckpoint(productionProject, kind),
      storyQuestion: storyQuestion(productionProject, kind),
      imageHandoff: imageHandoff(productionProject, kind),
      audioCue: audioCue(productionProject, kind),
      sourceStoryBeat: storyBeatId,
      shotIds: source?.shotIds?.length ? source.shotIds : productionProject.storyboard.shots
        .filter(shot => shot.storyBeat === storyBeatId)
        .map(shot => shot.id),
    };
  });

  return {
    version: 'yh-trailer-beat-sheet-v1',
    reference: {
      primary: 'ViMAX',
      adaptedIdeas: [
        '把创意先压成预告片节拍 artifact，再交给导演链和分镜',
        '30/60/90 秒采用不同节拍密度，但都保留冷开场、主角目标、危机升级、高光和结尾悬念',
        '每个节拍都要求可见动作和可见赌注，减少抽象空镜',
        '每个节拍提供观众检查点和视觉接力棒，用来约束相邻片段衔接',
      ],
    },
    duration: productionProject.duration,
    structure,
    logline: productionProject.storyBible.premise,
    beats,
    continuityRules: productionProject.storyBible.continuityRules,
  };
}

function bridgeAction(project: ProductionProject, index: number) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const verbs = ['看见', '拿起', '按下', '推开', '冲向', '停住', '回头'];
  return `${subject}${verbs[index % verbs.length]}${prop}，动作必须在本段开头或结尾被镜头明确捕捉。`;
}

function previousFrameMemory(project: ProductionProject, index: number, previous?: ProductionProject['storyboard']['shots'][number]) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  const scene = sceneName(project);
  if (!previous) {
    return `第一段开头必须清楚建立${subject}在${scene}与${prop}的空间关系。`;
  }
  return `复现上一段最后一帧的三件事：${subject}的身体朝向、${prop}的位置或屏幕内容、${scene}中的危险标识。`;
}

function nextFrameTrigger(project: ProductionProject, index: number, next?: ProductionProject['storyboard']['shots'][number]) {
  const subject = project.storyBible.protagonist;
  const prop = primaryPropName(project);
  if (!next) {
    return `最后一段收在${prop}的新状态和${subject}的结果反应上，不突然换到无关画面。`;
  }
  return `结尾留给下一段的触发点：${subject}的视线、手部动作或${prop}状态变化必须指向镜头${next.index}。`;
}

export function buildSegmentBridgePlan(productionProject: ProductionProject, trailerBeatSheet = buildTrailerBeatSheet(productionProject)): SegmentBridgePlan {
  const subject = productionProject.storyBible.protagonist;
  const prop = primaryPropName(productionProject);
  const scene = sceneName(productionProject);
  const bridges = productionProject.storyboard.shots.map((shot, index) => {
    const previous = productionProject.storyboard.shots[index - 1];
    const next = productionProject.storyboard.shots[index + 1];
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
      entryState: previous
        ? `承接上一段末尾：${subject}仍在${scene}，${prop}的位置、屏幕内容或手部动作保持连续；先复现上一段最后状态再推进。`
        : `开场建立${subject}、${scene}和${prop}的空间关系，观众必须在前2秒知道谁在哪里、面对什么。`,
      exitState: next
        ? `结尾留下下一段能接住的状态：${subject}的视线、手部动作或${prop}状态变化指向${nextBeat.label}。`
        : `结尾只给悬念边缘：${prop}状态改变，${subject}有结果反应，但不解释完整结局。`,
      bridgeAction: bridgeAction(productionProject, index),
      editBridge: previous
        ? '剪辑上使用动作匹配或道具状态匹配，禁止无原因换人、换景、换道具。'
        : '剪辑上先用稳定开场建立主角、场景和道具，后续段落按同一空间继续。',
      previousFrameMemory: previousFrameMemory(productionProject, index, previous),
      nextFrameTrigger: nextFrameTrigger(productionProject, index, next),
      viewerCheckpoint: currentBeat.viewerCheckpoint,
      continuityCheck: `主角=${subject}；场景=${scene}；关键道具=${prop}；下一段必须继承这三个锚点。`,
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
  const scene = sceneName(project);
  return [
    `边界桥接 ${previous.index}->${next.index}：从上一段尾帧出发，保持${subject}、${scene}、${prop}三项视觉锚点不变。`,
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
