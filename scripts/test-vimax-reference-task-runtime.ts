import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function waitFor(check: () => boolean, label: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`timeout:${label}`);
}

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'huiying-reference-runtime-'));
  process.env.HUIYING_TASKS_FILE = path.join(root, 'tasks.json');

  try {
    const tasks = await import('../src/lib/task-manager');
    const { createVimaxReferenceTaskRuntime } = await import(
      '../src/lib/skills/vimax-short-drama/vimax-reference-task-runtime'
    );
    const owner = { tenantId: 'tenant-reference', memberId: 'member-reference' };
    const parentTaskId = tasks.createTask('storyboard', { prompt: '两镜短剧' }, owner);
    let executeCount = 0;
    let abortCount = 0;

    const runtime = createVimaxReferenceTaskRuntime({
      owner,
      parentTaskId,
      prompt: '两镜短剧',
      modelId: 'fixture-image',
      execute: signal => {
        executeCount += 1;
        if (executeCount === 1) {
          return new Promise((_, reject) => {
            signal.addEventListener('abort', () => {
              abortCount += 1;
              reject(new DOMException('cancelled', 'AbortError'));
            }, { once: true });
          });
        }
        return Promise.resolve({
          model: 'fixture-image',
          assets: [{
            kind: 'shot',
            label: 'Clip 1',
            prompt: '雨夜天台',
            url: '/private/reference-1.png',
            shotIndex: 1,
            status: 'generated',
          }],
          subjectRegistry: {
            version: 'sceneweave-subject-reference-registry-v1',
            subjects: [],
          },
          complete: true,
          failedShotIndices: [],
        });
      },
    });

    const firstTaskId = runtime.startBackground();
    assert.equal(runtime.startBackground(), firstTaskId, 'active reference task must be reused');
    assert.equal(executeCount, 1, 'duplicate submit must not create a parallel provider call');
    assert.equal(tasks.cancelTask(firstTaskId), true);
    await waitFor(() => abortCount === 1, 'abort propagation');
    assert.equal(tasks.getTaskForOwner(firstTaskId, owner)?.status, 'cancelled');

    const secondTaskId = runtime.startBackground();
    assert.notEqual(secondTaskId, firstTaskId, 'retry after cancellation must create one new child');
    await waitFor(
      () => tasks.getTaskForOwner(secondTaskId, owner)?.status === 'completed',
      'completed retry',
    );
    const completed = tasks.getTaskForOwner(secondTaskId, owner);
    const completedResult = completed?.result?.vimaxReferenceResult as {
      complete?: boolean;
      assets?: Array<{ url?: string }>;
    } | undefined;
    assert.equal(executeCount, 2);
    assert.equal(completedResult?.complete, true);
    assert.equal(completedResult?.assets?.[0]?.url, '/private/reference-1.png');
    assert.equal(tasks.getTaskForOwner(parentTaskId, owner)?.result?.vimaxReferenceTaskId, secondTaskId);

    console.log(JSON.stringify({
      ok: true,
      activeTaskReused: true,
      cancelPropagated: true,
      retryCreatedOneTask: true,
      providerCalls: 0,
      executeCount,
    }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main();
