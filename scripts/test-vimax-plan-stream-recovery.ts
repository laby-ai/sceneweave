import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  recoverPersistedVimaxPlan,
  waitForPersistedVimaxPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-plan-stream-recovery';
import { buildVimaxProductionPlan } from '../src/lib/skills/vimax-short-drama/vimax-production-plan';

const shots = Array.from({ length: 4 }, (_, index) => ({
  index: index + 1,
  title: `镜头 ${index + 1}`,
  duration: 5,
  camera: '固定镜头',
  prompt: `第 ${index + 1} 镜`,
}));
const productionPlan = buildVimaxProductionPlan({
  title: '雨夜天台',
  ratio: '16:9',
  resolution: '720p',
  planModel: 'qwen3.7-plus',
  imageModel: 'qwen-image-3.0-pro',
  videoModel: 'happyhorse-1.1-i2v',
  providerReadiness: { plan: true, referenceAssets: true, video: true },
  assets: [{ kind: 'scene', label: '城市天台', prompt: '雨夜城市天台' }],
  shots,
});

const persistedTask = {
  id: 'task-plan-1',
  status: 'completed',
  result: {
    vimaxPlan: {
      title: '雨夜天台',
      summary: '四镜头雨夜短片。',
      assets: [{ kind: 'scene', label: '城市天台', prompt: '雨夜城市天台' }],
      shots,
      nextAction: '生成参考素材',
    },
    productionPlan,
  },
};

const recovered = recoverPersistedVimaxPlan(persistedTask, 'task-plan-1');
assert.ok(recovered, 'completed owner-scoped task should recover');
assert.equal(recovered?.taskId, 'task-plan-1');
assert.equal(recovered?.plan.shots.length, 4, 'recovery must use the complete persisted plan');
assert.equal(recovered?.productionPlan.title, '雨夜天台');

assert.equal(
  recoverPersistedVimaxPlan({ ...persistedTask, status: 'running' }, 'task-plan-1'),
  null,
  'incomplete tasks must not be presented as a complete plan',
);
assert.equal(
  recoverPersistedVimaxPlan(persistedTask, 'foreign-task'),
  null,
  'a mismatched task id must fail closed',
);
assert.equal(
  recoverPersistedVimaxPlan({ ...persistedTask, result: { vimaxPlan: persistedTask.result.vimaxPlan } }, 'task-plan-1'),
  null,
  'recovery requires the persisted production plan contract',
);

async function main() {
  let loadAttempts = 0;
  const recoveredAfterPersistence = await waitForPersistedVimaxPlan({
    taskId: 'task-plan-1',
    intervalMs: 0,
    maxAttempts: 3,
    loadTask: async () => {
      loadAttempts += 1;
      return loadAttempts === 1 ? { ...persistedTask, status: 'pending' } : persistedTask;
    },
  });
  assert.equal(loadAttempts, 2, 'recovery should wait for the server-side task to finish');
  assert.equal(recoveredAfterPersistence?.plan.shots.length, 4);

  let failedTaskReads = 0;
  assert.equal(await waitForPersistedVimaxPlan({
    taskId: 'task-plan-1',
    intervalMs: 0,
    maxAttempts: 3,
    loadTask: async () => {
      failedTaskReads += 1;
      return { ...persistedTask, status: 'failed' };
    },
  }), null);
  assert.equal(failedTaskReads, 1, 'terminal failures must not be polled repeatedly');

  const routeSource = readFileSync('src/app/api/smart/vimax-agent-step/route.ts', 'utf8');
  const clientSource = readFileSync('src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill.ts', 'utf8');
  assert.ok(
    /send\('plan\.accepted'[\s\S]{0,500}await callArkTextStream\(/.test(routeSource),
    'the recovery cursor must be sent before the provider call can outlive the browser stream',
  );
  assert.match(clientSource, /waitForPersistedVimaxPlan\(\{/);

  console.log(JSON.stringify({ ok: true, recoveredShots: recovered?.plan.shots.length, loadAttempts }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
