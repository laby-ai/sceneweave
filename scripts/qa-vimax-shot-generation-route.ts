import assert from 'node:assert/strict';

import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import {
  applyVimaxShotGenerationRoutes,
  resolveVimaxShotGenerationRoutes,
  type VimaxShotGenerationRoute,
} from '../src/lib/skills/vimax-short-drama/vimax-shot-generation-route';

const plan: VimaxAgentPlan = {
  title: '小红帽的雨夜信号',
  summary: '小红帽在同一雨夜街区追踪一枚发光徽章。',
  assets: [],
  shots: [
    {
      index: 1,
      title: '发现徽章',
      duration: 5,
      camera: '中景跟拍',
      prompt: '小红帽从画面左侧走向右侧并捡起徽章。',
      handoffIntent: 'reference-flexible',
      handoffReason: '第一镜建立人物与场景。',
      continuityPriorities: ['subject', 'scene', 'prop'],
    },
    {
      index: 2,
      title: '动作承接',
      duration: 5,
      camera: '同轴近景',
      prompt: '承接捡起徽章的动作，小红帽起身继续向右跑。',
      handoffIntent: 'strict-frame',
      handoffReason: '同一动作、同一空间，必须从上一镜尾帧继续。',
      continuityPriorities: ['action', 'screen-direction', 'subject'],
    },
    {
      index: 3,
      title: '切到钟楼',
      duration: 5,
      camera: '远景俯拍',
      prompt: '小红帽抵达钟楼广场，画面允许明显换景。',
      handoffIntent: 'reference-flexible',
      handoffReason: '主动换景但仍需保持人物与服饰。',
      continuityPriorities: ['subject', 'scene'],
    },
  ],
  nextAction: '确认后生成。',
};

const routes = resolveVimaxShotGenerationRoutes({
  shots: plan.shots,
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});

assert.deepEqual(routes.map(route => route.mode), [
  'first-frame',
  'first-frame',
  'first-frame',
]);
assert.deepEqual(routes.map(route => route.model), [
  'happyhorse-1.1-i2v',
  'happyhorse-1.1-i2v',
  'happyhorse-1.1-i2v',
]);
assert.equal(routes[0].requestedBy, 'server-default');
assert.equal(routes[1].requestedBy, 'server-default');
assert.equal(routes[1].requiresPreviousLastFrame, true);
assert.equal(routes[1].canonicalFirstFrameRequired, true);
assert.deepEqual(routes[0].referenceRoles, ['subject', 'scene', 'prop']);
assert.deepEqual(routes[1].referenceRoles, ['subject', 'scene', 'prop', 'previous-tail']);
assert.deepEqual(routes[2].referenceRoles, ['subject', 'scene', 'prop', 'previous-tail']);

const assemblyPlan = {
  segments: plan.shots.map((shot, index) => ({
    index,
    shotId: `shot-${shot.index}`,
  })),
};
const routed = applyVimaxShotGenerationRoutes({
  plan,
  assemblyPlan,
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});
const recovered = JSON.parse(JSON.stringify(routed.assemblyPlan)) as {
  segments: Array<{ generationRoute?: VimaxShotGenerationRoute }>;
};
assert.deepEqual(
  recovered.segments.map(segment => segment.generationRoute?.model),
  ['happyhorse-1.1-i2v', 'happyhorse-1.1-i2v', 'happyhorse-1.1-i2v'],
);
assert.match(recovered.segments[1].generationRoute?.reason || '', /权威首帧/);

console.log(JSON.stringify({
  ok: true,
  providerCalls: 0,
  incurredCost: false,
  modes: routes.map(route => route.mode),
  models: routes.map(route => route.model),
}));
