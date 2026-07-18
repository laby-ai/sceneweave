import assert from 'node:assert/strict';

import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import type { ProductionProject } from '../src/lib/production-project';
import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { patchProductionAssetFromCanvas } from '../src/lib/production-asset-writeback';
import { createTask, deleteTask, getTaskFresh, updateTask } from '../src/lib/task-manager';
import {
  buildVimaxContinuityContract,
  buildVimaxContinuityPrompt,
  resolveVimaxProviderHandoffMode,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

const plan: VimaxAgentPlan = {
  title: '雨夜录音笔',
  summary: '同一位穿蓝色风衣的女记者在雨夜车站追查红色录音笔。',
  assets: [
    { kind: 'character', label: '女记者', prompt: '短发，蓝色风衣' },
    { kind: 'scene', label: '雨夜车站', prompt: '冷蓝顶灯，湿地反光' },
    { kind: 'prop', label: '红色录音笔', prompt: '红色金属录音笔，指示灯常亮' },
  ],
  shots: [
    { index: 1, title: '发现', duration: 5, camera: '中景向右跟拍', prompt: '女记者走向长椅。' },
    { index: 2, title: '换手', duration: 5, camera: '近景保持轴线', prompt: '女记者拾起录音笔。' },
    { index: 3, title: '追踪', duration: 5, camera: '全景向右跟拍', prompt: '女记者向站台右侧追去。' },
  ],
  nextAction: '确认后生成。',
};

const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
  phase: 'plan',
  duration: 15,
  segmentDuration: 5,
  segmentCount: 3,
  ratio: '16:9',
  resolution: '720p',
  sceneType: 'drama',
  style: '冷蓝雨夜电影感',
  skillId: 'short-drama',
}, 'derived-asset-version-fixture');

function versionState(project: ProductionProject, assetId: string) {
  const asset = project.assets.find(candidate => candidate.id === assetId);
  assert.ok(asset, `asset ${assetId} missing`);
  return asset.metadata?.assetVersion as {
    rootAssetId: string;
    parentAssetId: string | null;
    number: number;
    status: string;
  } | undefined;
}

function continuityPrompt(project: ProductionProject, shotIndex: number) {
  const contract = buildVimaxContinuityContract({
    productionProject: project,
    assemblyPlan: built.assemblyPlan,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'happyhorse-dashscope',
      model: 'happyhorse-1.1-t2v',
    }),
  });
  return buildVimaxContinuityPrompt(contract, shotIndex);
}

const taskId = createTask('storyboard', {});
try {
  updateTask(taskId, {
    result: {
      productionProject: built.productionProject,
      assemblyPlan: built.assemblyPlan,
    },
  });

  const rootAsset = built.productionProject.assets.find(asset => asset.kind === 'prop');
  assert.ok(rootAsset, 'fixture prop asset missing');
  const targetShotId = built.productionProject.storyboard.shots[1]!.id;

  const draft = patchProductionAssetFromCanvas({
    taskId,
    assetId: rootAsset.id,
    patch: {
      versionAction: 'derive',
      name: '红色录音笔 · 换手状态',
      summary: '红色录音笔已从右手换到左手，指示灯仍亮',
      relatedShotIds: [targetShotId],
    },
  });

  assert.notEqual(draft.asset.id, rootAsset.id);
  assert.deepEqual(versionState(draft.productionProject, draft.asset.id), {
    rootAssetId: rootAsset.id,
    parentAssetId: rootAsset.id,
    number: 2,
    status: 'draft',
  });
  assert.equal(draft.productionProject.assets.length, built.productionProject.assets.length + 1);
  assert.doesNotMatch(continuityPrompt(draft.productionProject, 1), /从右手换到左手/);

  const approved = patchProductionAssetFromCanvas({
    taskId,
    assetId: draft.asset.id,
    patch: { versionAction: 'approve' },
  });
  assert.equal(versionState(approved.productionProject, rootAsset.id)?.status, 'superseded');
  assert.equal(versionState(approved.productionProject, draft.asset.id)?.status, 'approved');
  assert.match(continuityPrompt(approved.productionProject, 1), /从右手换到左手/);
  assert.doesNotMatch(continuityPrompt(approved.productionProject, 0), /从右手换到左手/);

  const failedDraft = patchProductionAssetFromCanvas({
    taskId,
    assetId: draft.asset.id,
    patch: {
      versionAction: 'derive',
      summary: '失败的错误版本，不应进入连续性请求',
      relatedShotIds: [targetShotId],
    },
  });
  patchProductionAssetFromCanvas({
    taskId,
    assetId: failedDraft.asset.id,
    patch: { status: 'failed' },
  });

  const recovered = getTaskFresh(taskId)?.result?.productionProject as ProductionProject | undefined;
  assert.ok(recovered, 'versioned project was not persisted');
  assert.equal(versionState(recovered, failedDraft.asset.id)?.status, 'failed');
  assert.match(continuityPrompt(recovered, 1), /从右手换到左手/);
  assert.doesNotMatch(continuityPrompt(recovered, 1), /失败的错误版本/);
  assert.throws(() => patchProductionAssetFromCanvas({
    taskId,
    assetId: failedDraft.asset.id,
    patch: { versionAction: 'approve' },
  }), /只有待批准/);

  console.log(JSON.stringify({
    ok: true,
    path: 'parent asset -> derived draft -> approval -> shot continuity -> failed version isolation -> refresh',
    taskId,
    rootAssetId: rootAsset.id,
    approvedAssetId: draft.asset.id,
    failedAssetId: failedDraft.asset.id,
    usedRealKey: false,
    incurredCost: false,
  }));
} finally {
  deleteTask(taskId);
}
