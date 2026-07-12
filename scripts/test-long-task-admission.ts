import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function main() {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'huiying-long-task-'));
  process.env.HUIYING_TASKS_FILE = path.join(temp, 'tasks.json');
  process.env.HUIYING_MEMBER_TASK_CONCURRENCY = '2';

  const taskManager = await import('../src/lib/task-manager');

  try {
  const ownerA = { tenantId: 'tenant-a', memberId: 'member-a' };
  const ownerB = { tenantId: 'tenant-a', memberId: 'member-b' };
  const first = taskManager.createTask('video', { prompt: 'first', idempotencyKey: 'video-key-0001' }, ownerA);
  assert.equal(taskManager.startTask(first), true);

  const replay = taskManager.createTask('video', { prompt: 'first duplicate', idempotencyKey: 'video-key-0001' }, ownerA);
  assert.equal(replay, first);
  assert.equal(taskManager.startTask(replay), false, 'duplicate submission must not start provider work twice');

  const second = taskManager.createTask('image', { prompt: 'second', idempotencyKey: 'image-key-0002' }, ownerA);
  assert.throws(
    () => taskManager.createTask('storyboard', { prompt: 'third', idempotencyKey: 'story-key-0003' }, ownerA),
    (error: unknown) => error instanceof taskManager.TaskAdmissionError && error.status === 429,
  );
  const otherMember = taskManager.createTask('storyboard', { prompt: 'other', idempotencyKey: 'story-key-0003' }, ownerB);
  assert.ok(otherMember);

  assert.equal(taskManager.cancelTask(first), true);
  assert.equal(taskManager.cancelTask(first), true, 'cancel must be idempotent');
  assert.equal(taskManager.startTask(second), true);
  assert.equal(taskManager.completeTask(second, { imageUrls: ['fixture'] }), true);
  assert.equal(taskManager.startTask(second), false, 'terminal tasks cannot restart without explicit retry');

  const interrupted = taskManager.createTask('video', { prompt: 'restart', idempotencyKey: 'restart-key-0004' }, ownerA);
  assert.equal(taskManager.startTask(interrupted), true);
  taskManager.reloadTaskStoreForTest();
  const recovered = taskManager.getTaskFresh(interrupted);
  assert.equal(recovered?.status, 'failed');
  assert.equal(recovered?.error, 'task_interrupted_by_restart');

  const rawStore = readFileSync(process.env.HUIYING_TASKS_FILE, 'utf8');
  assert.doesNotMatch(rawStore, /video-key-0001|restart-key-0004/);
  assert.equal('idempotencyHash' in (taskManager.publicTask(recovered) || {}), false);

  const videoRoute = readFileSync(path.join(process.cwd(), 'src/app/api/video/submit/route.ts'), 'utf8');
  const imageRoute = readFileSync(path.join(process.cwd(), 'src/app/api/image/submit/route.ts'), 'utf8');
  assert.match(videoRoute, /resolveTaskIdempotencyKey/);
  assert.match(videoRoute, /replayed: true/);
  assert.match(imageRoute, /taskAdmissionErrorResponse/);

  console.log(JSON.stringify({ status: 'pass', idempotency: true, concurrency: 2, restartRecovery: 'failed-safe', cancelIdempotent: true }));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

void main();
