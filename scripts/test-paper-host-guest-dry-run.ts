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
    assert(guestBody.productionPlan && typeof guestBody.productionPlan === 'object', 'response must expose a production plan');
    const productionPlan = guestBody.productionPlan as Record<string, unknown>;
    assert.equal(productionPlan.version, 'paper-production-plan-v1');
    assert.deepEqual(productionPlan.pipeline, {
      id: 'lesson-script',
      label: '教学脚本',
      mode: 'dry-run',
    });
    assert(Array.isArray(productionPlan.materials) && productionPlan.materials.length > 0);
    assert(Array.isArray(productionPlan.stages) && productionPlan.stages.length > 0);
    assert.deepEqual(productionPlan.estimatedCost, {
      currency: 'CNY',
      amount: 0,
      status: 'no-cost-dry-run',
    });
    assert.deepEqual(productionPlan.render, {
      status: 'not-started',
      requiresPaidProvider: true,
      reason: '当前仅生成制作方案，未提交图像或视频渲染。',
    });
    const task = guestBody.task as { result?: Record<string, unknown> };
    assert.deepEqual(task.result?.productionPlan, productionPlan, 'production plan must persist with the task');
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
