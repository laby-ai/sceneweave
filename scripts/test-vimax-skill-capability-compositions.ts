import assert from 'node:assert/strict';

import { CREATION_CAPABILITY_SKILLS } from '../src/lib/skills/creation-capabilities';
import {
  VIMAX_SKILL_CAPABILITY_COMPOSITIONS,
  resolveVimaxSkillCapabilityComposition,
} from '../src/lib/skills/vimax-short-drama/vimax-skill-capability-compositions';
import { VIMAX_SKILL_PRESETS } from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';

const capabilityById = new Map(CREATION_CAPABILITY_SKILLS.map(skill => [skill.id, skill]));
const operationById = new Map(CREATION_CAPABILITY_SKILLS.flatMap(skill => (
  skill.operations.map(operation => [operation.id, { skill, operation }] as const)
)));
const presetIds = VIMAX_SKILL_PRESETS.map(preset => preset.id).sort();
const compositionIds = VIMAX_SKILL_CAPABILITY_COMPOSITIONS.map(composition => composition.presetId).sort();

assert.deepEqual(compositionIds, presetIds, '每个可见创作预设都必须有且只有一个能力组合');

for (const preset of VIMAX_SKILL_PRESETS) {
  const composition = resolveVimaxSkillCapabilityComposition(preset.id);
  assert.equal(composition.presetId, preset.id);
  assert.equal(composition.standard, 'sceneweave-vimax-skill-v1');
  assert.equal(composition.runtime, 'sceneweave');
  assert.equal(composition.executor, 'existing-sceneweave-chain');
  assert.equal(composition.failurePolicy.mode, 'fail-closed');
  assert.equal(composition.failurePolicy.preserveCompletedOutputs, true);
  assert.equal(composition.readiness.missingRequirementPolicy, 'fail-closed');
  assert.equal(new Set(composition.requiredCapabilityIds).size, composition.requiredCapabilityIds.length);
  assert.equal(new Set(composition.operationOrder).size, composition.operationOrder.length);

  for (const capabilityId of composition.requiredCapabilityIds) {
    assert.ok(capabilityById.has(capabilityId), `${preset.id} 引用了未知能力 ${capabilityId}`);
  }
  for (const operationId of composition.operationOrder) {
    const registered = operationById.get(operationId);
    assert.ok(registered, `${preset.id} 引用了未知操作 ${operationId}`);
    assert.ok(
      composition.requiredCapabilityIds.includes(registered!.skill.id),
      `${preset.id} 的操作 ${operationId} 未声明所属能力`,
    );
  }

  assert.equal(composition.operationOrder[0], 'delivery.manage-tasks');
  assert.ok(composition.operationOrder.includes('director.plan'));
  assert.ok(composition.operationOrder.includes('governance.lock-production-plan'));
  assert.ok(
    composition.operationOrder.indexOf('governance.lock-production-plan')
      > composition.operationOrder.indexOf('director.plan'),
    `${preset.id} 必须先生成方案再锁定制作计划`,
  );
  assert.ok(
    composition.readiness.checkBeforeOperationIds.every(operationId => composition.operationOrder.includes(operationId)),
  );
  assert.ok(
    composition.costBoundary.confirmBeforeOperationIds.every(operationId => (
      operationById.get(operationId)?.operation.cost === 'provider-gated'
      && composition.operationOrder.includes(operationId)
    )),
  );
  assert.ok(composition.resultDelivery.operationIds.includes('delivery.download-cut-draft'));
  assert.equal(composition.resultDelivery.capabilityId, 'session-delivery');
  assert.ok(
    composition.resultDelivery.operationIds.every(operationId => composition.operationOrder.includes(operationId)),
  );
}

const storyboard = resolveVimaxSkillCapabilityComposition('storyboard-director');
assert.ok(storyboard.requiredCapabilityIds.includes('project-asset-workbench'));
assert.ok(!storyboard.operationOrder.includes('director.video'));
assert.ok(!storyboard.operationOrder.includes('segments.queue'));

for (const presetId of ['short-drama', 'commerce-video', 'brand-film', 'art-film', 'game-pv']) {
  const composition = resolveVimaxSkillCapabilityComposition(presetId);
  assert.ok(composition.requiredCapabilityIds.includes('segmented-production'));
  assert.ok(composition.operationOrder.includes('director.video'));
  assert.ok(composition.costBoundary.confirmBeforeOperationIds.includes('director.video'));
}

assert.throws(() => resolveVimaxSkillCapabilityComposition('missing-preset'), /Unknown creation preset composition/);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-skill-capability-compositions',
  presets: compositionIds.length,
}));
