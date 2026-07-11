import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveFilmPostScriptTransition } from '../src/lib/film-workflow-transition';

const success = resolveFilmPostScriptTransition({
  outcome: 'success',
  entityCardCount: 6,
});
assert.deepEqual(success, {
  phase: 'visual',
  queueAssetGeneration: true,
});

for (const outcome of ['error', 'cancelled'] as const) {
  assert.deepEqual(
    resolveFilmPostScriptTransition({ outcome, entityCardCount: 6 }),
    { phase: 'planning', queueAssetGeneration: false },
  );
}

assert.deepEqual(
  resolveFilmPostScriptTransition({ outcome: 'success', entityCardCount: 0 }),
  { phase: 'planning', queueAssetGeneration: false },
);

const planHook = readFileSync(
  new URL('../src/hooks/useFilmPlanCreation.ts', import.meta.url),
  'utf8',
);
const workspace = readFileSync(
  new URL('../src/components/film/film-main-stage-workspace.tsx', import.meta.url),
  'utf8',
);

assert.match(planHook, /setPhase\(transition\.phase\)/);
assert.match(planHook, /phase: transition\.phase/);
assert.match(planHook, /if \(transition\.queueAssetGeneration\)/);
assert.doesNotMatch(workspace, /下一步：画面生成/);

console.log('film script handoff state machine passed');
