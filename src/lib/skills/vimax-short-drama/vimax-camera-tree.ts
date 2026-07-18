export type VimaxCameraTransitionType = 'establish' | 'continuity-cut' | 'cut-in' | 'bridged-cut';

export interface VimaxCameraTreeInputShot {
  shotId: string;
  framing: string;
  actionStart: string;
  actionEnd: string;
  screenDirection: string;
  assetAnchors?: string[];
}

export interface VimaxCameraTreeNode {
  cameraId: string;
  activeShotIds: string[];
  parentCameraId: string | null;
  parentShotId: string | null;
  reason: string;
  isParentFullyCoversChild: boolean | null;
  missingInfo: string | null;
  transition: {
    type: VimaxCameraTransitionType;
    prompt: string;
  };
}

export interface VimaxCameraTree {
  version: 'sceneweave-camera-tree-v1';
  rootCameraId: string;
  nodes: VimaxCameraTreeNode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function framingRank(value: string) {
  const framing = value.toLowerCase();
  if (/(ecu|extreme close|大特写|特写)/.test(framing)) return 4;
  if (/(cu|mcu|close|近景)/.test(framing)) return 3;
  if (/(ms|medium|中景|半身)/.test(framing)) return 2;
  if (/(els|ls|ws|wide|long|full|全景|远景|大全景)/.test(framing)) return 1;
  return 2;
}

function missingAnchors(parent: VimaxCameraTreeInputShot, child: VimaxCameraTreeInputShot) {
  const parentAnchors = new Set(parent.assetAnchors || []);
  return (child.assetAnchors || []).filter(anchor => !parentAnchors.has(anchor));
}

function selectParent(shots: VimaxCameraTreeInputShot[], childIndex: number) {
  const child = shots[childIndex];
  const childRank = framingRank(child.framing);
  const earlier = shots.slice(0, childIndex).map((shot, index) => ({
    shot,
    index,
    rank: framingRank(shot.framing),
    missing: missingAnchors(shot, child),
  }));
  const covering = earlier.filter(candidate => candidate.rank <= childRank);
  const candidates = covering.length > 0 ? covering : earlier.slice(0, 1);
  return candidates.sort((left, right) => (
    left.missing.length - right.missing.length
    || Math.abs(childRank - left.rank) - Math.abs(childRank - right.rank)
    || right.index - left.index
  ))[0];
}

function transitionType(parentRank: number, childRank: number): VimaxCameraTransitionType {
  const difference = childRank - parentRank;
  if (difference <= 0) return 'continuity-cut';
  if (difference === 1) return 'cut-in';
  return 'bridged-cut';
}

export function buildVimaxCameraTree(shots: VimaxCameraTreeInputShot[]): VimaxCameraTree {
  if (shots.length === 0) throw new Error('镜头树至少需要一个分镜。');
  const nodes = shots.map((shot, index): VimaxCameraTreeNode => {
    const cameraId = `camera-${shot.shotId}`;
    if (index === 0) {
      return {
        cameraId,
        activeShotIds: [shot.shotId],
        parentCameraId: null,
        parentShotId: null,
        reason: '首镜建立人物、场景、道具和空间轴线，是镜头树唯一根节点。',
        isParentFullyCoversChild: null,
        missingInfo: null,
        transition: {
          type: 'establish',
          prompt: `以${shot.framing}建立空间；动作从“${shot.actionStart}”推进至“${shot.actionEnd}”。`,
        },
      };
    }

    const parent = selectParent(shots, index);
    const missing = parent.missing;
    const parentRank = parent.rank;
    const childRank = framingRank(shot.framing);
    const type = transitionType(parentRank, childRank);
    const coverage = parentRank <= childRank && missing.length === 0;
    const bridgeInstruction = type === 'bridged-cut'
      ? '景别跨度较大，必须用连续动作、视线或道具状态作为视觉桥，避免无因跳切。'
      : '保持相邻景别、人物朝向和运动轴线连续。';

    return {
      cameraId,
      activeShotIds: [shot.shotId],
      parentCameraId: `camera-${parent.shot.shotId}`,
      parentShotId: parent.shot.shotId,
      reason: coverage
        ? `父镜 ${parent.shot.shotId} 的${parent.shot.framing}覆盖本镜${shot.framing}所需主体和空间信息。`
        : `父镜 ${parent.shot.shotId} 是时间上最近且景别最匹配的可用参考镜头。`,
      isParentFullyCoversChild: coverage,
      missingInfo: missing.length > 0 ? missing.join('；') : null,
      transition: {
        type,
        prompt: `从父镜“${parent.shot.actionEnd}”承接到本镜“${shot.actionStart}”；${bridgeInstruction}方向约束：${shot.screenDirection}`,
      },
    };
  });

  return {
    version: 'sceneweave-camera-tree-v1',
    rootCameraId: nodes[0].cameraId,
    nodes,
  };
}

export function describeVimaxCameraTreeShot(tree: VimaxCameraTree | undefined, shotId: string) {
  const node = tree?.nodes.find(candidate => candidate.activeShotIds.includes(shotId));
  if (!node) return '本镜尚未建立覆盖镜头依赖；按分镜顺序保持轴线、动作与景别连续。';
  if (!node.parentCameraId || !node.parentShotId) {
    return `本镜=${shotId}；父镜=无（唯一根镜）；转场=${node.transition.type}；${node.transition.prompt}`;
  }
  return [
    `本镜=${shotId}`,
    `父镜=${node.parentShotId}`,
    `转场=${node.transition.type}`,
    `覆盖=${node.isParentFullyCoversChild ? '完整' : '部分'}`,
    node.missingInfo ? `需补信息=${node.missingInfo}` : '',
    node.transition.prompt,
  ].filter(Boolean).join('；');
}

export function parseVimaxCameraTree(value: unknown): VimaxCameraTree | undefined {
  if (!isRecord(value)
    || value.version !== 'sceneweave-camera-tree-v1'
    || typeof value.rootCameraId !== 'string'
    || !Array.isArray(value.nodes)
    || value.nodes.length === 0) return undefined;
  const validNodes = value.nodes.every(node => isRecord(node)
    && typeof node.cameraId === 'string'
    && Array.isArray(node.activeShotIds)
    && node.activeShotIds.length > 0
    && node.activeShotIds.every(shotId => typeof shotId === 'string')
    && (node.parentCameraId === null || typeof node.parentCameraId === 'string')
    && (node.parentShotId === null || typeof node.parentShotId === 'string')
    && typeof node.reason === 'string'
    && (node.isParentFullyCoversChild === null || typeof node.isParentFullyCoversChild === 'boolean')
    && (node.missingInfo === null || typeof node.missingInfo === 'string')
    && isRecord(node.transition)
    && ['establish', 'continuity-cut', 'cut-in', 'bridged-cut'].includes(String(node.transition.type))
    && typeof node.transition.prompt === 'string');
  if (!validNodes) return undefined;

  const tree = value as unknown as VimaxCameraTree;
  const byId = new Map(tree.nodes.map(node => [node.cameraId, node]));
  const roots = tree.nodes.filter(node => node.parentCameraId === null);
  if (roots.length !== 1 || roots[0].cameraId !== tree.rootCameraId) return undefined;
  for (const node of tree.nodes) {
    const seen = new Set<string>();
    let current: VimaxCameraTreeNode | undefined = node;
    while (current?.parentCameraId) {
      if (seen.has(current.cameraId)) return undefined;
      seen.add(current.cameraId);
      current = byId.get(current.parentCameraId);
      if (!current) return undefined;
    }
  }
  return tree;
}
