import assert from 'node:assert/strict';

import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import {
  applyVimaxShotGenerationRoutes,
  collectVimaxShotRouteIssues,
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
      sceneId: 'scene-rainy-street',
      characterIds: ['character-red'],
      propIds: ['prop-badge'],
      actionStart: '小红帽站在街口，徽章落在前方地面。',
      actionEnd: '小红帽蹲下并握住发光徽章。',
      spatialRelation: 'new-scene',
      temporalRelation: 'time-jump',
      routeConfidence: 'high',
      continuityPriorities: ['subject', 'scene', 'prop'],
    },
    {
      index: 2,
      title: '动作承接',
      duration: 5,
      camera: '同轴近景',
      prompt: '承接捡起徽章的动作，小红帽起身继续向右跑。',
      sceneId: 'scene-rainy-street',
      characterIds: ['character-red'],
      propIds: ['prop-badge'],
      actionStart: '小红帽蹲下并握住发光徽章。',
      actionEnd: '小红帽握着徽章起身并向画面右侧跑。',
      spatialRelation: 'same-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      continuityPriorities: ['action', 'screen-direction', 'subject'],
    },
    {
      index: 3,
      title: '切到钟楼',
      duration: 5,
      camera: '远景俯拍',
      prompt: '小红帽抵达钟楼广场，画面允许明显换景。',
      sceneId: 'scene-clock-tower',
      characterIds: ['character-red'],
      propIds: ['prop-badge'],
      actionStart: '小红帽握着徽章进入钟楼广场。',
      actionEnd: '小红帽停在钟楼下抬头观察。',
      spatialRelation: 'new-scene',
      temporalRelation: 'time-jump',
      routeConfidence: 'high',
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
assert.deepEqual(routes.map(route => route.boundaryIntent), [
  'establish',
  'continue',
  'cut',
]);
assert.equal(routes[0].requestedBy, 'server-default');
assert.equal(routes[1].requestedBy, 'planner');
assert.equal(routes[1].requiresPreviousLastFrame, true);
assert.equal(routes[1].canonicalFirstFrameRequired, false);
assert.equal(routes[1].requiresConfirmation, false);
assert.equal(routes[0].canonicalFirstFrameRequired, true);
assert.equal(routes[2].canonicalFirstFrameRequired, true);
assert.deepEqual(routes[0].referenceRoles, ['subject', 'scene', 'prop']);
assert.deepEqual(routes[1].referenceRoles, ['previous-tail']);
assert.deepEqual(routes[2].referenceRoles, ['subject', 'scene', 'prop']);

const bridgeRoutes = resolveVimaxShotGenerationRoutes({
  shots: [
    {
      ...plan.shots[1],
      index: 5,
      title: '推门前',
      sceneId: 'scene-rooftop',
      actionStart: '林浅走向铁门。',
      actionEnd: '林浅站在铁门前，右手伸出触碰生锈的门把手。',
    },
    {
      ...plan.shots[2],
      index: 6,
      title: '穿过铁门',
      sceneId: 'scene-projection-room',
      actionStart: '林浅站在铁门前，右手伸出触碰生锈的门把手。',
      actionEnd: '林浅完全进入黑暗房间，门在身后半掩，眼前出现放映机。',
      spatialRelation: 'new-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      conflictFlags: [],
    },
  ],
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});
assert.equal(bridgeRoutes[1].boundaryIntent, 'bridge');
assert.equal(bridgeRoutes[1].mode, 'first-frame');
assert.equal(bridgeRoutes[1].model, 'happyhorse-1.1-i2v');
assert.equal(bridgeRoutes[1].requiresPreviousLastFrame, true);
assert.equal(bridgeRoutes[1].canonicalFirstFrameRequired, false);
assert.equal(bridgeRoutes[1].requiresConfirmation, false);
assert.deepEqual(bridgeRoutes[1].referenceRoles, ['previous-tail']);

const uncertainRoutes = resolveVimaxShotGenerationRoutes({
  shots: [
    plan.shots[0],
    {
      ...plan.shots[1],
      routeConfidence: 'low',
      conflictFlags: ['人物仍在天台，但镜头说明要求切到次日室内。'],
    },
  ],
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});
assert.equal(uncertainRoutes[1].requiresConfirmation, true);
assert.match(uncertainRoutes[1].confirmationReason || '', /低置信度|冲突/);

const mediumConfidenceRoutes = resolveVimaxShotGenerationRoutes({
  shots: [
    plan.shots[0],
    { ...plan.shots[1], routeConfidence: 'medium' },
  ],
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});
assert.equal(mediumConfidenceRoutes[1].requiresConfirmation, true);
assert.match(mediumConfidenceRoutes[1].confirmationReason || '', /中置信度/);

const brokenBoundaryRoutes = resolveVimaxShotGenerationRoutes({
  shots: [
    plan.shots[0],
    {
      ...plan.shots[1],
      sceneId: 'scene-other',
      actionStart: '小红帽已经站在钟楼门口。',
    },
  ],
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});
assert.equal(brokenBoundaryRoutes[1].requiresConfirmation, true);
assert.match(brokenBoundaryRoutes[1].confirmationReason || '', /场景 ID|动作边界/);

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
assert.match(recovered.segments[1].generationRoute?.reason || '', /连续动作/);

const legacyRoutes = resolveVimaxShotGenerationRoutes({
  shots: [{
    ...plan.shots[0],
    spatialRelation: undefined,
    temporalRelation: undefined,
    routeConfidence: undefined,
  }],
  provider: 'happyhorse-dashscope',
  configuredModel: 'happyhorse-1.1-r2v',
});
assert.equal(legacyRoutes[0].requiresConfirmation, true);
assert.match(legacyRoutes[0].confirmationReason || '', /缺少新版镜头时空与置信度合同/);
assert.deepEqual(collectVimaxShotRouteIssues({
  segments: [{ index: 0, generationRoute: legacyRoutes[0] }],
}), [{
  shotIndex: 1,
  code: 'legacy-plan-route-contract-missing',
  reason: legacyRoutes[0].confirmationReason,
}]);

console.log(JSON.stringify({
  ok: true,
  providerCalls: 0,
  incurredCost: false,
  modes: routes.map(route => route.mode),
  models: routes.map(route => route.model),
}));
