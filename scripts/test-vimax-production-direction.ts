import assert from 'node:assert/strict';

import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import {
  buildVimaxContinuityContract,
  buildVimaxContinuityPrompt,
  resolveVimaxProviderHandoffMode,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';
import { updateVimaxProductionDirectionForTask } from '../src/lib/skills/vimax-short-drama/vimax-production-direction';
import { buildVimaxProductionPlan } from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { createTask, deleteTask, getTaskForOwner, updateTask, type TaskOwner } from '../src/lib/task-manager';

const owner: TaskOwner = { tenantId: 'paper-host', memberId: 'guest:direction-workspace' };
const otherOwner: TaskOwner = { tenantId: 'paper-host', memberId: 'guest:other-workspace' };
const taskId = createTask('storyboard', {}, owner);

const basePlan = {
  title: '雨夜录音笔',
  summary: '记者在雨夜车站追查一支录音笔。',
  assets: [
    { kind: 'character' as const, label: '记者', prompt: '蓝色风衣，短发' },
    { kind: 'scene' as const, label: '雨夜车站', prompt: '冷蓝顶灯，湿地反光' },
  ],
  shots: [
    { index: 1, title: '发现', duration: 5, camera: '中景', prompt: '记者看见录音笔。' },
    { index: 2, title: '拾取', duration: 5, camera: '近景', prompt: '记者拾起录音笔。' },
  ],
  nextAction: '确认后生成',
};

try {
  const built = buildProductionBackedVimaxPlan(basePlan.summary, basePlan, {
    phase: 'plan',
    style: '冷蓝电影感',
    sceneType: 'drama',
    ratio: '16:9',
    resolution: '720p',
    skillId: 'short-drama',
  }, taskId);
  const initialContinuity = buildVimaxContinuityContract({
    productionProject: built.productionProject,
    assemblyPlan: built.assemblyPlan,
    imageModel: 'doubao-seedream-5-0-260128',
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'ark-video-v3',
      model: 'doubao-seedance-1-5-pro-251215',
    }),
  });
  const productionPlan = buildVimaxProductionPlan({
    title: basePlan.title,
    ratio: '16:9',
    resolution: '720p',
    planModel: 'authoritative-plan-model',
    imageModel: 'doubao-seedream-5-0-260128',
    videoModel: 'doubao-seedance-1-5-pro-251215',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: basePlan.assets,
    shots: basePlan.shots,
    continuity: initialContinuity,
  });
  updateTask(taskId, { result: { ...built, productionPlan } });

  assert.throws(() => updateVimaxProductionDirectionForTask({
    taskId,
    owner: otherOwner,
    patch: { artStyle: '伪造画风', directorManual: '伪造导演手册' },
  }), /不存在|无权/);

  const updated = updateVimaxProductionDirectionForTask({
    taskId,
    owner,
    patch: {
      artStyle: '克制的冷蓝写实电影感，低饱和，湿地高光',
      directorManual: '全片保持180度轴线；动作从左向右推进；关键道具始终在人物左手。',
      imageModel: 'client-forged-image-model',
      videoModel: 'client-forged-video-model',
      mode: 'client-forged-mode',
    },
  });

  const recovered = getTaskForOwner(taskId, owner);
  assert.ok(recovered?.result?.productionProject, 'production project should survive refresh');
  assert.equal(updated.productionProject.creativeDirection?.artStyle, '克制的冷蓝写实电影感，低饱和，湿地高光');
  assert.equal(updated.productionProject.creativeDirection?.directorManual, '全片保持180度轴线；动作从左向右推进；关键道具始终在人物左手。');
  assert.equal(updated.productionPlan.providerRoutes.find(route => route.stage === 'reference_assets')?.model, 'doubao-seedream-5-0-260128');
  assert.equal(updated.productionPlan.providerRoutes.find(route => route.stage === 'video')?.model, 'doubao-seedance-1-5-pro-251215');
  assert.notEqual(updated.productionPlan.continuity?.providerHandoff.mode, 'client-forged-mode');

  const refreshedContinuity = buildVimaxContinuityContract({
    productionProject: updated.productionProject,
    assemblyPlan: updated.assemblyPlan,
    imageModel: updated.productionPlan.providerRoutes.find(route => route.stage === 'reference_assets')?.model,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'ark-video-v3',
      model: updated.productionPlan.providerRoutes.find(route => route.stage === 'video')?.model || '',
    }),
  });
  const prompt = buildVimaxContinuityPrompt(refreshedContinuity, 0);
  assert.match(prompt, /克制的冷蓝写实电影感/);
  assert.match(prompt, /保持180度轴线/);
  assert.match(prompt, /doubao-seedream-5-0-260128/);
  assert.match(prompt, /doubao-seedance-1-5-pro-251215/);

  console.log(JSON.stringify({
    ok: true,
    path: 'direction edit -> owner writeback -> refresh -> canonical reference/video prompt',
    providerCalls: 0,
    usedRealKey: false,
    incurredCost: false,
  }));
} finally {
  deleteTask(taskId);
}
