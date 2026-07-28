import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'vimax-video-resume-'));
  process.env.HUIYING_TASK_STORE_FILE = path.join(root, 'tasks.json');
  const taskManager = await import('../src/lib/task-manager');
  const { createVimaxVideoTaskRuntime } = await import(
    '../src/lib/skills/vimax-short-drama/vimax-video-task-runtime'
  );
  const owner = { tenantId: 'tenant-fixture', memberId: 'member-fixture' };
  const parentTaskId = taskManager.createTask('storyboard', {
    workflow: 'vimax-agent',
    prompt: '雨夜天台 10 秒短剧',
  }, owner);
  taskManager.startTask(parentTaskId);
  taskManager.completeTask(parentTaskId, {
    vimaxPlan: { title: '雨夜天台', shots: [{ index: 1 }, { index: 2 }] },
  });

  let resolveExecution!: (value: { videoUrl: string }) => void;
  const execution = new Promise<{ videoUrl: string }>(resolve => {
    resolveExecution = resolve;
  });
  const runtime = createVimaxVideoTaskRuntime({
    owner,
    parentTaskId,
    totalShots: 2,
    prompt: '雨夜天台',
    ratio: '16:9',
    resolution: '720p',
    modelId: 'fixture-video',
    execute: async () => execution,
  });

  const childTaskId = runtime.startBackground();
  const parent = taskManager.getTaskForOwner(parentTaskId, owner);
  assert.equal(
    parent?.result?.vimaxVideoTaskId,
    childTaskId,
    'parent must persist the active video/compose child for refresh recovery',
  );

  resolveExecution({ videoUrl: '/huiying/api/final-videos/fixture-final' });
  await new Promise(resolve => setTimeout(resolve, 25));
  const child = taskManager.getTaskForOwner(childTaskId, owner);
  assert.equal(child?.status, 'completed');
  const videoResult = child?.result?.vimaxVideoResult as { videoUrl?: string } | undefined;
  assert.equal(videoResult?.videoUrl, '/huiying/api/final-videos/fixture-final');
  console.log(JSON.stringify({
    ok: true,
    persistedSameTask: true,
    providerCalls: 0,
  }));
  await rm(root, { recursive: true, force: true });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
