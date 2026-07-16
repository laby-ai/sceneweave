import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const guestA = 'guest-creation-browser-session-7f9a2c';
const guestB = 'guest-creation-browser-session-4d8e1f';

const guestHeaders = (workspace: string) => ({
  'content-type': 'application/json',
  'x-paper-host-embed': 'creation-agent',
  'x-paper-host-guest-workspace': workspace,
});

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'sceneweave-paper-task-events-'));
  process.env.HUIYING_TASKS_FILE = path.join(root, 'tasks.json');

  const [{ NextRequest }, dryRun, taskEvents, taskById] = await Promise.all([
    import('next/server'),
    import('../src/app/api/production/dry-run/route'),
    import('../src/app/api/tasks/[taskId]/events/route'),
    import('../src/app/api/tasks/[taskId]/route'),
  ]);

  try {
    const createdResponse = await dryRun.POST(new NextRequest('http://localhost/api/production/dry-run', {
      method: 'POST',
      headers: guestHeaders(guestA),
      body: JSON.stringify({ prompt: '用课堂演示讲解牛顿第一定律' }),
    }));
    const created = await createdResponse.json() as { taskId?: string };
    assert.equal(createdResponse.status, 200);
    assert.equal(typeof created.taskId, 'string');
    const taskId = created.taskId || '';

    const anonymousEvents = await taskEvents.GET(
      new NextRequest(`http://localhost/api/tasks/${taskId}/events`),
      { params: Promise.resolve({ taskId }) },
    );
    assert.equal(anonymousEvents.status, 401, 'unscoped anonymous event streams must stay closed');

    const isolatedEvents = await taskEvents.GET(
      new NextRequest(`http://localhost/api/tasks/${taskId}/events`, { headers: guestHeaders(guestB) }),
      { params: Promise.resolve({ taskId }) },
    );
    assert.equal(isolatedEvents.status, 404, 'another guest workspace must not stream the task');

    const ownedEvents = await taskEvents.GET(
      new NextRequest(`http://localhost/api/tasks/${taskId}/events`, { headers: guestHeaders(guestA) }),
      { params: Promise.resolve({ taskId }) },
    );
    const eventText = await ownedEvents.text();
    assert.equal(ownedEvents.status, 200);
    assert.match(ownedEvents.headers.get('content-type') || '', /^text\/event-stream/);
    assert.match(eventText, /event: task/);
    assert.match(eventText, /event: done/);
    assert.match(eventText, new RegExp(taskId));
    assert.doesNotMatch(eventText, new RegExp(guestA));

    const ownedTask = await taskById.GET(
      new NextRequest(`http://localhost/api/tasks/${taskId}`, { headers: guestHeaders(guestA) }),
      { params: Promise.resolve({ taskId }) },
    );
    assert.equal(ownedTask.status, 200, 'same guest should restore the task after refresh');

    const isolatedTask = await taskById.GET(
      new NextRequest(`http://localhost/api/tasks/${taskId}`, { headers: guestHeaders(guestB) }),
      { params: Promise.resolve({ taskId }) },
    );
    assert.equal(isolatedTask.status, 404, 'another guest must not restore the task');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main()
  .then(() => console.log('paper host guest task event contract: ok'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
