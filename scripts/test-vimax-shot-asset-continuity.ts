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
}, 'shot-asset-continuity-fixture');

const taskId = createTask('storyboard', {});
try {
  updateTask(taskId, {
    result: {
      productionProject: built.productionProject,
      assemblyPlan: built.assemblyPlan,
    },
  });

  const secondShotId = built.productionProject.storyboard.shots[1]!.id;
  const prop = built.productionProject.assets.find(asset => asset.kind === 'prop');
  assert.ok(prop, 'fixture prop asset missing');

  const writeback = patchProductionAssetFromCanvas({
    taskId,
    assetId: prop.id,
    patch: {
      summary: '红色录音笔已从右手换到左手，指示灯仍亮',
      relatedShotIds: [secondShotId],
    },
  });

  assert.deepEqual(writeback.asset.relatedShotIds, [secondShotId]);
  assert.ok(writeback.changedFields.includes('relatedShotIds'));

  const persisted = getTaskFresh(taskId)?.result?.productionProject as ProductionProject | undefined;
  assert.ok(persisted, 'patched project was not persisted');

  const contract = buildVimaxContinuityContract({
    productionProject: persisted,
    assemblyPlan: built.assemblyPlan,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'happyhorse-dashscope',
      model: 'happyhorse-1.1-t2v',
    }),
  });
  const firstPrompt = buildVimaxContinuityPrompt(contract, 0);
  const secondPrompt = buildVimaxContinuityPrompt(contract, 1);

  assert.doesNotMatch(firstPrompt, /从右手换到左手/);
  assert.match(secondPrompt, /【本镜资产】/);
  assert.match(secondPrompt, /红色录音笔已从右手换到左手/);

  console.log(JSON.stringify({
    ok: true,
    path: 'asset PATCH -> related shot -> continuity contract -> provider prompt',
    taskId,
    assetId: prop.id,
    shotId: secondShotId,
    usedRealKey: false,
    incurredCost: false,
  }));
} finally {
  deleteTask(taskId);
}
