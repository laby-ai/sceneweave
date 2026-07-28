import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean, message: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(message);
}

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'vimax-compose-cancel-'));
  process.env.HUIYING_TASK_STORE_FILE = path.join(root, 'tasks.json');

  try {
    const taskManager = await import('../src/lib/task-manager');
    const { createVimaxVideoTaskRuntime } = await import(
      '../src/lib/skills/vimax-short-drama/vimax-video-task-runtime'
    );
    const { recoverVimaxTaskProject } = await import(
      '../src/lib/skills/vimax-short-drama/vimax-task-project-recovery'
    );
    const owner = { tenantId: 'tenant-compose', memberId: 'member-compose' };
    const parentTaskId = taskManager.createTask('storyboard', {
      workflow: 'vimax-agent',
      prompt: '两镜头短剧',
    }, owner);
    taskManager.startTask(parentTaskId);
    taskManager.completeTask(parentTaskId, {
      vimaxPlan: {
        title: '两镜头短剧',
        summary: '两个连续镜头的无费用合成恢复测试。',
        assets: [],
        shots: [{ index: 1, title: '镜头一' }, { index: 2, title: '镜头二' }],
      },
      productionPlan: { providerRoutes: [] },
      productionProject: { title: '两镜头短剧' },
    });

    const executions = [deferred<{ videoUrl: string }>(), deferred<{ videoUrl: string }>()];
    const signals: AbortSignal[] = [];
    let executionCount = 0;
    const runtime = createVimaxVideoTaskRuntime({
      owner,
      parentTaskId,
      totalShots: 2,
      prompt: '两镜头短剧',
      ratio: '16:9',
      resolution: '720p',
      modelId: 'fixture-video',
      execute: async (_persistSegment, signal) => {
        signals.push(signal);
        const current = executions[executionCount];
        executionCount += 1;
        return current.promise;
      },
    });

    const childTaskId = runtime.startBackground();
    await waitFor(() => executionCount === 1, 'first compose execution did not start');
    assert.equal(taskManager.cancelTask(childTaskId), true);
    await waitFor(
      () => signals[0]?.aborted === true,
      'cancelling the task must abort the compose execution',
    );

    executions[0].resolve({ videoUrl: '/huiying/api/final-videos/cancelled-result' });
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(taskManager.getTaskForOwner(childTaskId, owner)?.status, 'cancelled');
    await waitFor(
      () => taskManager.getTaskForOwner(parentTaskId, owner)?.result?.vimaxVideoTaskStatus === 'cancelled',
      'parent project did not persist cancelled compose state',
    );
    assert.equal(
      taskManager.getTaskForOwner(parentTaskId, owner)?.result?.vimaxVideoResult,
      undefined,
      'a late compose result must not overwrite the parent after cancellation',
    );
    const cancelledProject = recoverVimaxTaskProject(
      taskManager.getTaskForOwner(parentTaskId, owner),
    );
    assert.match(cancelledProject?.messages.at(-1)?.content || '', /上次成片任务已取消/);
    assert.deepEqual(
      cancelledProject?.messages.at(-1)?.quickOptions,
      ['找回已完成片段', '调整分镜'],
    );

    assert.ok(taskManager.retryTask(childTaskId), 'cancelled compose task must be retryable');
    const retryId = runtime.startBackground();
    const duplicateRetryId = runtime.startBackground();
    assert.equal(retryId, childTaskId, 'retry must resume the same persisted compose task');
    assert.equal(duplicateRetryId, childTaskId, 'duplicate retry must reuse the active compose task');
    await waitFor(() => executionCount === 2, 'retry compose execution did not start');
    assert.equal(executionCount, 2, 'duplicate retry must not start parallel compose executions');

    executions[1].resolve({ videoUrl: '/huiying/api/final-videos/retried-result' });
    await waitFor(
      () => taskManager.getTaskForOwner(childTaskId, owner)?.status === 'completed',
      'retried compose task did not complete',
    );
    const parent = taskManager.getTaskForOwner(parentTaskId, owner);
    const result = parent?.result?.vimaxVideoResult as { videoUrl?: string } | undefined;
    assert.equal(result?.videoUrl, '/huiying/api/final-videos/retried-result');
    assert.equal(parent?.result?.vimaxVideoTaskStatus, 'completed');
    assert.equal(taskManager.getTaskForOwner(childTaskId, owner)?.config.retryCount, 1);

    console.log(JSON.stringify({
      ok: true,
      sameTaskRecovered: true,
      duplicateRetryExecutions: executionCount - 2,
      providerCalls: 0,
      incurredCost: false,
    }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
