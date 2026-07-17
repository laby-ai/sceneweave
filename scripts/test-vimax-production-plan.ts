import assert from 'node:assert/strict';

import {
  assertVimaxProductionPlanForPhase,
  buildVimaxProductionPlan,
  parseVimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';

const plan = buildVimaxProductionPlan({
  title: '新品竖屏广告',
  ratio: '9:16',
  resolution: '1080p',
  planModel: VIMAX_PLAN_MODEL,
  imageModel: 'doubao-seedream-5-0-260128',
  videoModel: 'doubao-seedance-1-5-pro-251215',
  providerReadiness: {
    plan: true,
    referenceAssets: true,
    video: false,
  },
  assets: [
    { kind: 'character', label: '品牌主角', prompt: '年轻创作者' },
    { kind: 'scene', label: '夜间工作室', prompt: '蓝色环境光' },
  ],
  shots: [
    { index: 1, title: '开场', duration: 5, camera: '推进', prompt: '主角拿起新品' },
    { index: 2, title: '功能展示', duration: 5, camera: '环绕', prompt: '屏幕功能特写' },
  ],
});

assert.equal(plan.version, 'sceneweave-production-plan-v1');
assert.equal(plan.pipeline.id, 'vimax-short-drama');
assert.equal(plan.preferences.ratio, '9:16');
assert.equal(plan.preferences.resolution, '1080p');
assert.deepEqual(plan.providerRoutes.map(route => [route.stage, route.ready]), [
  ['plan', true],
  ['reference_assets', true],
  ['video', false],
]);
assert.equal(plan.materials.length, 4);
assert.equal(plan.checkpoints.find(stage => stage.id === 'plan')?.status, 'completed');
assert.equal(plan.checkpoints.find(stage => stage.id === 'video')?.status, 'blocked');
assert.equal(plan.estimatedCost.amount, null);
assert.equal(plan.estimatedCost.requiresConfirmation, true);
assert.equal(plan.render.runtime, 'sceneweave-segmented-ffmpeg-v1');
assert.equal(plan.render.locked, true);
assert.equal(plan.render.allowSilentFallback, false);

assert.deepEqual(parseVimaxProductionPlan(JSON.parse(JSON.stringify(plan))), plan);
assert.doesNotThrow(() => assertVimaxProductionPlanForPhase(plan, 'reference_assets'));
assert.throws(
  () => assertVimaxProductionPlanForPhase(plan, 'video'),
  /视频模型服务尚未就绪/,
);

assert.throws(
  () => assertVimaxProductionPlanForPhase({
    ...plan,
    render: { ...plan.render, runtime: 'unknown-runtime' },
  }, 'reference_assets'),
  /制作运行时与已确认计划不一致/,
);

assert.throws(
  () => assertVimaxProductionPlanForPhase({
    ...plan,
    providerRoutes: plan.providerRoutes.map(route => route.stage === 'reference_assets'
      ? { ...route, model: 'silent-fallback-model' }
      : route),
  }, 'reference_assets'),
  /模型路由与已确认计划不一致/,
);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-production-plan',
  checks: 18,
}));
