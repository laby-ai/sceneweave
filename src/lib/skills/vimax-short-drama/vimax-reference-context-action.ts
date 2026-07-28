import type { VimaxAgentPlan, VimaxAgentReferenceAsset } from './vimax-agent-contract';
import {
  getTaskForOwner,
  updateTask,
  type TaskOwner,
} from '@/lib/task-manager';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function shotReference(
  assets: VimaxAgentReferenceAsset[],
  shotIndex: number,
) {
  return assets.find(asset => (
    asset.kind === 'shot'
    && asset.shotIndex === shotIndex
    && text(asset.url)
  ));
}

function hasVideoWorkAtOrAfter(
  result: Record<string, unknown>,
  targetShotIndex: number,
) {
  const segmentSources = [
    result.vimaxHappyHorseSegments,
    (result.vimaxVideoResult && typeof result.vimaxVideoResult === 'object')
      ? (result.vimaxVideoResult as { segments?: unknown }).segments
      : undefined,
    result.segments,
  ];
  const knownSegments = segmentSources.flatMap(source => Array.isArray(source) ? source : []);
  const targetStarted = knownSegments.some(segment => {
    if (!segment || typeof segment !== 'object') return false;
    const value = segment as { shotIndex?: unknown; index?: unknown; status?: unknown };
    const shotIndex = Number(value.shotIndex ?? (Number(value.index) + 1));
    const status = text(value.status).toLowerCase();
    return Number.isInteger(shotIndex)
      && shotIndex >= targetShotIndex
      && !['', 'pending', 'failed', 'cancelled'].includes(status);
  });
  if (targetStarted) return true;
  return knownSegments.length === 0 && Boolean(
    text(result.vimaxVideoTaskId) || result.vimaxVideoResult,
  );
}

export function assignVimaxShotReferenceToNextShot(input: {
  taskId: string;
  owner: TaskOwner;
  sourceShotIndex: number;
  targetShotIndex: number;
}) {
  const task = getTaskForOwner(input.taskId, input.owner);
  if (!task?.result) throw new Error('项目不存在或无权访问');
  if (input.targetShotIndex !== input.sourceShotIndex + 1) {
    throw new Error('只能把当前画面用于紧接着的下一镜');
  }
  if (hasVideoWorkAtOrAfter(task.result, input.targetShotIndex)) {
    throw new Error('这个镜头已经开始制作，请先停止或重做当前镜头再更换参考画面');
  }

  const plan = task.result.vimaxPlan as VimaxAgentPlan | undefined;
  const sourceShot = plan?.shots.find(shot => shot.index === input.sourceShotIndex);
  const targetShot = plan?.shots.find(shot => shot.index === input.targetShotIndex);
  if (!sourceShot || !targetShot) throw new Error('没有找到对应的相邻镜头');

  const currentAssets = Array.isArray(task.result.vimaxReferenceAssets)
    ? task.result.vimaxReferenceAssets as VimaxAgentReferenceAsset[]
    : [];
  const source = shotReference(currentAssets, input.sourceShotIndex);
  if (!source?.url) throw new Error('当前镜头还没有可用画面');

  const target: VimaxAgentReferenceAsset = {
    ...source,
    kind: 'shot',
    shotIndex: input.targetShotIndex,
    label: `Clip ${input.targetShotIndex} · ${targetShot.title}`,
    prompt: targetShot.prompt,
    sourceShotIndex: input.sourceShotIndex,
    selectionReason: `用户将镜头 ${input.sourceShotIndex} 的已验收画面指定为下一镜参考`,
  };
  const nextAssets = [
    ...currentAssets.filter(asset => !(
      asset.kind === 'shot' && asset.shotIndex === input.targetShotIndex
    )),
    target,
  ];
  const orderedAssets = nextAssets.sort((left, right) => (
    (left.shotIndex || Number.MAX_SAFE_INTEGER) - (right.shotIndex || Number.MAX_SAFE_INTEGER)
  ));
  const updated = updateTask(input.taskId, {
    result: {
      ...task.result,
      vimaxReferenceAssets: orderedAssets,
      imageUrls: orderedAssets.flatMap(asset => text(asset.url) ? [text(asset.url)] : []),
    },
  });
  if (!updated) throw new Error('项目状态保存失败');

  return {
    task: updated,
    sourceShotIndex: input.sourceShotIndex,
    targetShotIndex: input.targetShotIndex,
    targetReference: target,
    references: orderedAssets,
  };
}
