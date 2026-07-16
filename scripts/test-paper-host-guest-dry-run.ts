import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const prompt = '用三幕结构讲解光合作用，输出课堂分镜与讲解节奏。';
const guestWorkspace = 'guest-creation-browser-session-7f9a2c';

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'sceneweave-paper-guest-'));
  process.env.HUIYING_TASKS_FILE = path.join(root, 'tasks.json');

  const [{ NextRequest }, { POST }] = await Promise.all([
    import('next/server'),
    import('../src/app/api/production/dry-run/route'),
  ]);
  const request = (headers: Record<string, string> = {}) => new NextRequest(
    'http://localhost/api/production/dry-run',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ prompt, workflow: 'lesson-script', model: 'production-dry-run' }),
    },
  );

  try {
    const anonymousResponse = await POST(request());
    assert.equal(anonymousResponse.status, 401, 'unscoped anonymous requests must stay closed');

    const invalidGuestResponse = await POST(request({
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': 'guest',
    }));
    assert.equal(invalidGuestResponse.status, 401, 'invalid guest workspace must stay closed');

    const guestResponse = await POST(request({
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': guestWorkspace,
    }));
    const guestBody = await guestResponse.json() as Record<string, unknown>;

    assert.equal(guestResponse.status, 200, 'scoped paper-host guest dry-run should succeed');
    assert.equal(guestBody.success, true);
    assert.equal(guestBody.usedRealKey, false);
    assert.equal(guestBody.incurredCost, false);
    assert.equal(guestBody.sessionMode, 'guest');
    assert.equal(typeof guestBody.taskId, 'string');
    assert(Array.isArray(guestBody.shots) && guestBody.shots.length > 0);
    assert.doesNotMatch(JSON.stringify(guestBody), new RegExp(guestWorkspace));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main()
  .then(() => console.log('paper host guest dry-run contract: ok'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
