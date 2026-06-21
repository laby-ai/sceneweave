import type { ProductionProject } from './production-project';
import type { SegmentBridgePlan } from './trailer-beat-sheet';

export type ShotVariationType = 'large' | 'medium' | 'small';

export interface ShotFrameStateContract {
  description: string;
  visibleCharacterIds: string[];
  requiredAssetIds: string[];
  continuityAnchors: string[];
}

export interface ShotFrameContractReadiness {
  pass: boolean;
  blockers: string[];
  warnings: string[];
}

export interface ShotVisualStoryEvidence {
  threatTarget: string;
  conflictEvidence: string;
  operationResultEvidence: string;
  endingHookEvidence: string;
  viewerReadabilityTest: string;
}

export interface ShotFrameContract {
  version: 'yh-shot-frame-contract-v1';
  reference: {
    primary: 'ViMAX';
    sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type';
  };
  shotId: string;
  shotIndex: number;
  variationType: ShotVariationType;
  variationReason: string;
  firstFrame: ShotFrameStateContract;
  lastFrame: ShotFrameStateContract;
  motionDescription: string;
  audioDescription: string;
  visualStoryEvidence: ShotVisualStoryEvidence;
  handoff: {
    requiresPreviousLastFrame: boolean;
    previousShotId: string | null;
    nextShotId: string | null;
    entryContinuity: string;
    exitContinuity: string;
  };
  readiness: ShotFrameContractReadiness;
}

export interface AssemblyReadinessIssue {
  code: string;
  severity: 'blocker' | 'warning';
  segmentIndex: number | null;
  message: string;
}

export interface ProductionAssemblyReadiness {
  version: 'yh-assembly-readiness-v1';
  pass: boolean;
  checkedAt: string;
  source: 'shot-frame-contract';
  blockerCount: number;
  warningCount: number;
  issues: AssemblyReadinessIssue[];
  nextAction: string;
}

interface BuildShotFrameContractParams {
  productionProject: ProductionProject;
  shot: ProductionProject['storyboard']['shots'][number];
  shotIndex: number;
  bridgePlan: SegmentBridgePlan;
  executionPrompt?: string;
}

interface ReadinessSegmentLike {
  index: number;
  shotFrameContract?: ShotFrameContract;
}

const REQUIRED_PROMPT_LABELS = [
  '【观众必须看见】',
  '【威胁对象】',
  '【危险源】',
  '【视觉冲突证据】',
  '【入点状态】',
  '【出点状态】',
  '【桥接动作】',
  '【操作结果】',
  '【结尾钩子证据】',
  '【结尾新问题】',
];

function assetIdsByKind(project: ProductionProject, kind: string) {
  return project.assets.filter(asset => asset.kind === kind).map(asset => asset.id);
}

function propName(project: ProductionProject) {
  return project.assets.find(asset => asset.kind === 'prop')?.name || '关键线索';
}

function sceneName(project: ProductionProject) {
  return project.assets.find(asset => asset.kind === 'scene')?.name
    || project.semanticPlan?.sceneBibles?.[0]?.name
    || '主要场景';
}

function variationForShot(shot: ProductionProject['storyboard']['shots'][number]): {
  type: ShotVariationType;
  reason: string;
} {
  if (shot.storyBeat === 'setup' || shot.storyBeat === 'resolution') {
    return {
      type: 'large',
      reason: '开场和结尾需要完整交代空间、角色和道具结果，因此必须具备首尾帧约束。',
    };
  }
  if (shot.storyBeat === 'conflict' || shot.storyBeat === 'turning') {
    return {
      type: 'medium',
      reason: '冲突和转折需要动作状态连续，尾帧必须成为下一段的视觉锚点。',
    };
  }
  return {
    type: 'small',
    reason: '触发段以动作推进为主，但仍需要清楚的首帧入点和尾帧出点。',
  };
}

function frameAnchors(project: ProductionProject) {
  return [
    project.storyBible.protagonist,
    sceneName(project),
    propName(project),
  ].filter(Boolean);
}

function buildVisualStoryEvidence(
  project: ProductionProject,
  shot: ProductionProject['storyboard']['shots'][number],
  shotIndex: number
): ShotVisualStoryEvidence {
  const protagonist = project.storyBible.protagonist;
  const prop = propName(project);
  const scene = sceneName(project);
  const beat = project.storyBible.beats.find(item => item.id === shot.storyBeat);
  const isLast = shotIndex >= project.storyboard.shots.length - 1;
  const nextShot = project.storyboard.shots[shotIndex + 1] || null;
  const threatTarget = shot.storyBeat === 'setup'
    ? `${scene}里可能受影响的人、车厢、客户、证据或公共空间必须和${protagonist}同框出现。`
    : `被威胁对象必须可见：人、车厢、客户、公开证据、避难所或${protagonist}正在保护/挽回的具体对象。`;
  const conflictEvidence = shot.storyBeat === 'resolution'
    ? `尾声仍要保留危险余波：${prop}的新状态、屏幕提示、警报熄灭或被威胁对象未完全安全。`
    : `画面必须同时出现危险源和阻碍结果：倒计时、报警屏、断裂结构、追赶者、失控设备、失败提示或被封锁的路径。`;
  const operationResultEvidence = `必须看见${protagonist}完成操作后的外部变化：${prop}屏幕/位置改变、危险短暂停止、失败暴露、新路线打开或局面变得更糟。`;
  const endingHookEvidence = isLast
    ? `最后一帧必须留下新的未解问题：${prop}出现新状态、被威胁对象仍未完全安全，或${protagonist}发现更大的危险。`
    : `最后一帧必须把${nextShot ? `镜头${nextShot.index}` : '下一段'}的触发点拍清楚：${protagonist}的视线、手部动作、${prop}状态或危险源变化。`;

  return {
    threatTarget,
    conflictEvidence,
    operationResultEvidence,
    endingHookEvidence,
    viewerReadabilityTest: `观众不看字幕也要能回答：${beat?.purpose || project.storyBible.conflict}；谁受威胁、危险来自哪里、${protagonist}做了什么、结尾留下了什么新问题。`,
  };
}

function buildFrameReadiness(params: {
  prompt: string;
  firstFrame: ShotFrameStateContract;
  lastFrame: ShotFrameStateContract;
  motionDescription: string;
  visualStoryEvidence: ShotVisualStoryEvidence;
  handoffRequiresPreviousLastFrame: boolean;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (params.firstFrame.visibleCharacterIds.length === 0) {
    blockers.push('first-frame-missing-visible-character');
  }
  if (params.lastFrame.visibleCharacterIds.length === 0) {
    blockers.push('last-frame-missing-visible-character');
  }
  if (params.firstFrame.requiredAssetIds.length < 2) {
    blockers.push('first-frame-missing-required-assets');
  }
  if (params.lastFrame.requiredAssetIds.length < 2) {
    blockers.push('last-frame-missing-required-assets');
  }
  if (params.handoffRequiresPreviousLastFrame && !params.prompt.includes('【上一段画面记忆】')) {
    blockers.push('handoff-missing-previous-frame-memory');
  }
  if (!params.motionDescription || params.motionDescription.length < 16) {
    blockers.push('motion-description-too-weak');
  }
  for (const [key, value] of Object.entries(params.visualStoryEvidence)) {
    if (typeof value !== 'string' || value.trim().length < 12) {
      blockers.push(`visual-story-evidence-too-weak-${key}`);
    }
  }

  for (const label of REQUIRED_PROMPT_LABELS) {
    if (!params.prompt.includes(label)) {
      const code = `prompt-missing-${label.replace(/[【】]/g, '')}`;
      if (label === '【视觉冲突证据】' || label === '【结尾钩子证据】') {
        blockers.push(code);
      } else {
        warnings.push(code);
      }
    }
  }

  return {
    pass: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function buildShotFrameContract(params: BuildShotFrameContractParams): ShotFrameContract {
  const { productionProject, shot, shotIndex, bridgePlan } = params;
  const executionPrompt = params.executionPrompt || shot.prompt;
  const characterAssetIds = assetIdsByKind(productionProject, 'character');
  const sceneAssetIds = assetIdsByKind(productionProject, 'scene');
  const propAssetIds = assetIdsByKind(productionProject, 'prop');
  const requiredAssetIds = [
    ...characterAssetIds.slice(0, 1),
    ...sceneAssetIds.slice(0, 1),
    ...propAssetIds.slice(0, 2),
  ];
  const previousShot = productionProject.storyboard.shots[shotIndex - 1] || null;
  const nextShot = productionProject.storyboard.shots[shotIndex + 1] || null;
  const bridge = bridgePlan.bridges.find(item => item.shotId === shot.id);
  const variation = variationForShot(shot);
  const anchors = frameAnchors(productionProject);
  const protagonist = productionProject.storyBible.protagonist;
  const prop = propName(productionProject);
  const scene = sceneName(productionProject);
  const entryContinuity = bridge?.entryState || (
    previousShot
      ? `承接上一镜头 ${previousShot.index} 的人物站位、道具状态和场景方向。`
      : `先建立${protagonist}、${scene}和${prop}的空间关系。`
  );
  const exitContinuity = bridge?.exitState || (
    nextShot
      ? `结尾留下能接到镜头 ${nextShot.index} 的动作方向、视线或道具状态。`
      : `结尾展示${prop}的新状态和${protagonist}的结果反应。`
  );

  const firstFrame: ShotFrameStateContract = {
    description: `${entryContinuity} 首帧必须同时看见${protagonist}、${scene}和${prop}。`,
    visibleCharacterIds: characterAssetIds.slice(0, 1),
    requiredAssetIds,
    continuityAnchors: anchors,
  };
  const lastFrame: ShotFrameStateContract = {
    description: `${exitContinuity} 尾帧必须保留${prop}的明确状态，供下一段作为 firstFrame 参考。`,
    visibleCharacterIds: characterAssetIds.slice(0, 1),
    requiredAssetIds,
    continuityAnchors: anchors,
  };
  const motionDescription = bridge?.bridgeAction
    || `${protagonist}围绕${prop}完成一个从旧状态到新状态的可见动作。`;
  const visualStoryEvidence = buildVisualStoryEvidence(productionProject, shot, shotIndex);

  const readiness = buildFrameReadiness({
    prompt: executionPrompt,
    firstFrame,
    lastFrame,
    motionDescription,
    visualStoryEvidence,
    handoffRequiresPreviousLastFrame: shotIndex > 0,
  });

  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId: shot.id,
    shotIndex,
    variationType: variation.type,
    variationReason: variation.reason,
    firstFrame,
    lastFrame,
    motionDescription,
    audioDescription: shot.narrationText || shot.subtitleText || productionProject.suggestions.narration?.script || '',
    visualStoryEvidence,
    handoff: {
      requiresPreviousLastFrame: shotIndex > 0,
      previousShotId: previousShot?.id || null,
      nextShotId: nextShot?.id || null,
      entryContinuity,
      exitContinuity,
    },
    readiness,
  };
}

export function evaluateAssemblyShotFrameReadiness(segments: ReadinessSegmentLike[]): ProductionAssemblyReadiness {
  const issues: AssemblyReadinessIssue[] = [];

  for (const segment of segments) {
    const contract = segment.shotFrameContract;
    if (!contract) {
      issues.push({
        code: 'missing-shot-frame-contract',
        severity: 'blocker',
        segmentIndex: segment.index,
        message: `第 ${segment.index + 1} 段缺少 ShotFrameContract，不能进入片段队列。`,
      });
      continue;
    }

    for (const blocker of contract.readiness.blockers) {
      issues.push({
        code: blocker,
        severity: 'blocker',
        segmentIndex: segment.index,
        message: `第 ${segment.index + 1} 段镜头首尾帧合约未通过：${blocker}`,
      });
    }
    for (const warning of contract.readiness.warnings) {
      issues.push({
        code: warning,
        severity: 'warning',
        segmentIndex: segment.index,
        message: `第 ${segment.index + 1} 段镜头首尾帧合约警告：${warning}`,
      });
    }
  }

  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;

  return {
    version: 'yh-assembly-readiness-v1',
    pass: blockerCount === 0,
    checkedAt: new Date().toISOString(),
    source: 'shot-frame-contract',
    blockerCount,
    warningCount,
    issues,
    nextAction: blockerCount === 0
      ? '镜头首尾帧合约已通过，可以进入无费用排队；真实生成仍需等待 BYOK、对象存储和上一段 lastFrame。'
      : '先补齐镜头首尾帧合约，再创建片段子任务或触发真实视频生成。',
  };
}
