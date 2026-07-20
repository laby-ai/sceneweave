import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CREATION_CAPABILITY_SKILLS,
  getCreationCapabilitySkill,
  listCreationCapabilityOperations,
} from '../src/lib/skills/creation-capabilities';

const expectedSkills = [
  ['director-artifacts', 'ViMAX'],
  ['project-asset-workbench', 'Toonflow-app'],
  ['segmented-production', 'ArcReel'],
  ['production-governance', 'OpenMontage'],
  ['session-delivery', 'LibTV Agent'],
] as const;

assert.equal(CREATION_CAPABILITY_SKILLS.length, expectedSkills.length);

for (const [id, sourceProject] of expectedSkills) {
  const skill = getCreationCapabilitySkill(id);
  assert.equal(skill.id, id);
  assert.equal(skill.sourceProject, sourceProject);
  assert.equal(skill.standard, 'sceneweave-vimax-skill-v1');
  assert.equal(skill.implementation, 'sceneweave-native');
  assert.equal(skill.referenceMode, id === 'director-artifacts' ? 'native-baseline' : 'behavioral-reference');
  assert.equal(skill.runtime, 'sceneweave');
  assert.equal(skill.executor, 'existing-sceneweave-chain');
  assert.ok(skill.operations.length > 0);
  assert.ok(skill.inputs.length > 0);
  assert.ok(skill.outputs.length > 0);
}

const operationIds = listCreationCapabilityOperations().map(operation => operation.id);
assert.ok(operationIds.includes('director.plan'));
assert.ok(operationIds.includes('workbench.load-project-assets'));
assert.ok(operationIds.includes('segments.retry-failed'));
assert.ok(operationIds.includes('governance.lock-production-plan'));
assert.ok(operationIds.includes('delivery.stream-task-events'));
assert.ok(operationIds.includes('delivery.download-cut-draft'));

for (const operation of listCreationCapabilityOperations()) {
  assert.equal(operation.runtime, 'sceneweave');
  assert.ok(operation.entrypoint.startsWith('/api/') || operation.entrypoint.startsWith('module:'));
  assert.notEqual(operation.entrypoint, '/api/skills/execute');
  let sourcePath = operation.entrypoint.startsWith('module:')
    ? operation.entrypoint.slice('module:'.length).split('#')[0]
    : `src/app${operation.entrypoint
      .replace(/:taskId/g, '[taskId]')
      .replace(/:assetId/g, '[assetId]')
      .replace(/:shotId/g, '[shotId]')}/route.ts`;
  if (operation.entrypoint.startsWith('module:') && !path.extname(sourcePath)) sourcePath += '.ts';
  assert.ok(fs.existsSync(path.resolve(sourcePath)), `${operation.id} references missing ${sourcePath}`);
}

const upload = listCreationCapabilityOperations().find(operation => operation.id === 'delivery.upload-reference');
assert.deepEqual(upload?.requires, ['huiying-object-storage']);

console.log(JSON.stringify({
  ok: true,
  script: 'test-creation-capability-skills',
  skills: CREATION_CAPABILITY_SKILLS.length,
  operations: listCreationCapabilityOperations().length,
}));
