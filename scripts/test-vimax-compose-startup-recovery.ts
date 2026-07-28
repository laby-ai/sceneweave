import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'vimax-compose-startup-'));
  const taskFile = path.join(root, 'tasks.json');
  process.env.HUIYING_TASKS_FILE = taskFile;
  process.env.HUIYING_TASK_STORE_FILE = taskFile;
  const owner = { tenantId: 'tenant-startup', memberId: 'member-startup' };
  const parentTaskId = '11111111-1111-4111-8111-111111111111';
  const childTaskId = '22222222-2222-4222-8222-222222222222';
  const now = Date.now();
  await writeFile(taskFile, JSON.stringify([
    {
      id: parentTaskId,
      type: 'storyboard',
      status: 'completed',
      config: { workflow: 'vimax-agent', prompt: '重启恢复测试' },
      progress: 100,
      result: {
        vimaxVideoTaskId: childTaskId,
        vimaxVideoTaskStatus: 'running',
      },
      createdAt: now - 1_000,
      completedAt: now - 500,
      owner,
    },
    {
      id: childTaskId,
      type: 'video',
      status: 'running',
      config: {
        workflow: 'vimax-agent-video',
        parentTaskId,
      },
      progress: 92,
      stage: '正在合成',
      createdAt: now - 800,
      startedAt: now - 700,
      owner,
    },
  ], null, 2));

  try {
    const taskManager = await import('../src/lib/task-manager');
    const child = taskManager.getTaskForOwner(childTaskId, owner);
    const parent = taskManager.getTaskForOwner(parentTaskId, owner);
    assert.equal(child?.status, 'failed');
    assert.equal(child?.error, 'task_interrupted_by_restart');
    assert.equal(
      parent?.result?.vimaxVideoTaskStatus,
      'failed',
      'startup recovery must not leave the parent project showing a running compose task',
    );
    const persisted = JSON.parse(await readFile(taskFile, 'utf8')) as Array<{
      id: string;
      result?: { vimaxVideoTaskStatus?: string };
    }>;
    assert.equal(
      persisted.find(task => task.id === parentTaskId)?.result?.vimaxVideoTaskStatus,
      'failed',
    );
    console.log(JSON.stringify({
      ok: true,
      childRecoveredAs: child?.status,
      parentRecoveredAs: parent?.result?.vimaxVideoTaskStatus,
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
