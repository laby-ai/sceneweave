import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  resolveVimaxSkillRuntimeBinding,
} from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';
import {
  approveVimaxProductionPlan,
  assertVimaxProductionPlanForPhase,
  buildVimaxProductionPlan,
  parseVimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';

const storyboardBinding = resolveVimaxSkillRuntimeBinding({
  skillId: 'storyboard-director',
  capabilityIds: ['segmented-production'],
  operationOrder: ['segments.queue', 'director.video'],
});

assert.equal(storyboardBinding.presetId, 'storyboard-director');
assert.ok(storyboardBinding.capabilityIds.includes('project-asset-workbench'));
assert.ok(!storyboardBinding.capabilityIds.includes('segmented-production'));
assert.ok(!storyboardBinding.operationOrder.includes('segments.queue'));
assert.ok(!storyboardBinding.operationOrder.includes('director.video'));
assert.deepEqual(
  storyboardBinding.executionStages.map(stage => stage.id),
  ['project', 'plan', 'reference_assets', 'delivery'],
);
assert.doesNotMatch(
  storyboardBinding.executionStages.map(stage => stage.label).join('\n'),
  /ViMAX|Vimax|SceneWeave|Toonflow|ArcReel|OpenMontage|LibTV/,
);

const commonPlanInput = {
  title: '品牌分镜测试',
  ratio: '16:9',
  resolution: '720p',
  planModel: 'plan-model',
  imageModel: 'image-model',
  videoModel: 'video-model',
  providerReadiness: { plan: true, referenceAssets: true, video: true },
  assets: [{ kind: 'reference', label: '品牌参考图' }],
  shots: [{ index: 1, title: '开场镜头', duration: 5, camera: '推进', prompt: '产品入画' }],
};

const storyboardPlan = buildVimaxProductionPlan({
  ...commonPlanInput,
  workflow: storyboardBinding,
});
const restoredStoryboardPlan = parseVimaxProductionPlan(JSON.parse(JSON.stringify(storyboardPlan)));
assert.deepEqual(restoredStoryboardPlan?.workflow, storyboardBinding, '刷新后必须恢复同一预设与能力组合');

const forgedPlan = structuredClone(storyboardPlan);
forgedPlan.workflow.capabilityIds = ['segmented-production'];
forgedPlan.workflow.operationOrder = ['segments.queue', 'director.video'];
assert.equal(parseVimaxProductionPlan(forgedPlan), undefined, '客户端伪造能力与顺序必须被拒绝');

assert.throws(
  () => assertVimaxProductionPlanForPhase(approveVimaxProductionPlan(storyboardPlan), 'video', {
    plan: 'plan-model',
    referenceAssets: 'image-model',
    video: 'video-model',
  }),
  /本次创作流程不包含视频生成阶段/,
);

const mediaBinding = resolveVimaxSkillRuntimeBinding({ skillId: 'commerce-video' });
const mediaPlan = buildVimaxProductionPlan({ ...commonPlanInput, workflow: mediaBinding });
const approvedMediaPlan = approveVimaxProductionPlan(mediaPlan);
const costConfirmedMediaPlan = {
  ...approvedMediaPlan,
  checkpoints: approvedMediaPlan.checkpoints.map(checkpoint => checkpoint.id === 'video'
    ? { ...checkpoint, status: 'pending' as const }
    : checkpoint),
  governance: { ...approvedMediaPlan.governance, status: 'ready' as const },
  estimatedCost: { ...approvedMediaPlan.estimatedCost, amount: 1, status: 'confirmed' as const },
};
assert.equal(
  assertVimaxProductionPlanForPhase(costConfirmedMediaPlan, 'video', {
    plan: 'plan-model',
    referenceAssets: 'image-model',
    video: 'video-model',
  }).workflow.presetId,
  'commerce-video',
);

assert.throws(
  () => resolveVimaxSkillRuntimeBinding({ skillId: 'unknown-preset' }),
  /Unknown creation preset composition/,
);

const planCardSource = readFileSync(
  new URL('../src/components/generate/vimax-production-plan-card.tsx', import.meta.url),
  'utf8',
);
assert.match(planCardSource, /本次创作流程/);
assert.match(planCardSource, /currentPlan\.workflow\.executionStages/);

const routeSource = readFileSync(
  new URL('../src/app/api/smart/vimax-agent-step/route.ts', import.meta.url),
  'utf8',
);
assert.doesNotMatch(
  routeSource,
  /未知的 ViMAX Agent 阶段|ViMAX Agent 阶段执行失败|ViMAX 分段镜头|【ViMAX/,
  '用户可见结果和错误不得泄漏内部驱动名',
);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-skill-runtime-binding',
  storyboardStages: storyboardBinding.executionStages.map(stage => stage.id),
  mediaStages: mediaBinding.executionStages.map(stage => stage.id),
}));
