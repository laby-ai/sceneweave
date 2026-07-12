import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { NextRequest } from 'next/server';

async function collectRouteFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(fullPath);
    return entry.name === 'route.ts' ? [fullPath] : [];
  }));
  return nested.flat();
}

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'huiying-member-tasks-'));
  const previousTaskFile = process.env.HUIYING_TASKS_FILE;
  const previousAccountBase = process.env.ACCOUNT_CENTER_API_BASE;
  process.env.HUIYING_TASKS_FILE = path.join(root, 'tasks.json');
  process.env.ACCOUNT_CENTER_API_BASE = 'http://account.test';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url !== 'http://account.test/v1/auth/me') return new Response('not found', { status: 404 });
    const token = new Headers(init?.headers).get('authorization')?.replace(/^Bearer\s+/i, '');
    if (token !== 'alpha-token' && token !== 'beta-token') {
      return Response.json({ error: 'not_authenticated' }, { status: 401 });
    }
    const suffix = token.startsWith('alpha') ? 'alpha' : 'beta';
    return Response.json({
      tenant_id: 'tenant-a',
      tenant_name: 'Tenant A',
      member: { id: `member-${suffix}`, email: `${suffix}@example.test`, display_name: suffix, role: 'member' },
    });
  };

  try {
    const manager = await import('../src/lib/task-manager');
    const alpha = { tenantId: 'tenant-a', memberId: 'member-alpha' };
    const beta = { tenantId: 'tenant-a', memberId: 'member-beta' };

    const alphaTaskId = manager.createTask('video', { prompt: 'alpha' }, alpha);
    const betaTaskId = manager.createTask('video', { prompt: 'beta' }, beta);
    manager.createTask('video', { prompt: 'legacy-unowned' });
    const childTaskId = manager.createTask('video', { prompt: 'child', parentTaskId: alphaTaskId });

    assert.deepEqual(manager.getAllTasksForOwner(alpha).map(task => task.id).sort(), [alphaTaskId, childTaskId].sort());
    assert.deepEqual(manager.getAllTasksForOwner(beta).map(task => task.id), [betaTaskId]);
    assert.equal(manager.getTaskForOwner(alphaTaskId, beta), undefined, 'cross-member detail must fail closed');
    assert.equal(manager.getTaskForOwner(alphaTaskId, alpha)?.id, alphaTaskId);
    assert.equal(manager.deleteTaskForOwner(alphaTaskId, beta), false, 'cross-member delete must fail closed');

    for (const modulePath of [
      '../src/app/api/image/submit/route',
      '../src/app/api/social/submit/route',
    ]) {
      const submitRoute = await import(modulePath);
      const anonymousStatus = await submitRoute.GET(new NextRequest(`http://localhost/api/status?taskId=${alphaTaskId}`));
      assert.equal(anonymousStatus.status, 401, `${modulePath} task status must reject anonymous reads`);
      const foreignStatus = await submitRoute.GET(new NextRequest(`http://localhost/api/status?taskId=${alphaTaskId}`, {
        headers: { Authorization: 'Bearer beta-token' },
      }));
      assert.equal(foreignStatus.status, 404, `${modulePath} task status must hide cross-member tasks`);
      const ownerStatus = await submitRoute.GET(new NextRequest(`http://localhost/api/status?taskId=${alphaTaskId}`, {
        headers: { Authorization: 'Bearer alpha-token' },
      }));
      assert.equal(ownerStatus.status, 200, `${modulePath} task owner must read its task`);
      const ownerBody = await ownerStatus.json() as Record<string, unknown>;
      assert(!('owner' in ownerBody), `${modulePath} task status must not expose owner identifiers`);
    }

    const route = await import('../src/app/api/tasks/route');
    const anonymous = await route.GET(new NextRequest('http://localhost/api/tasks'));
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: 'not_authenticated' });

    const alphaResponse = await route.GET(new NextRequest('http://localhost/api/tasks', {
      headers: { Authorization: 'Bearer alpha-token' },
    }));
    assert.equal(alphaResponse.status, 200);
    const alphaBody = await alphaResponse.json() as { tasks: Array<Record<string, unknown>> };
    assert.deepEqual(alphaBody.tasks.map(task => task.id).sort(), [alphaTaskId, childTaskId].sort());
    assert(alphaBody.tasks.every(task => !('owner' in task)), 'owner identifiers must not be returned');

    const betaResponse = await route.GET(new NextRequest('http://localhost/api/tasks', {
      headers: { Authorization: 'Bearer beta-token' },
    }));
    const betaBody = await betaResponse.json() as { tasks: Array<Record<string, unknown>> };
    assert.deepEqual(betaBody.tasks.map(task => task.id), [betaTaskId]);

    const detail = await import('../src/app/api/tasks/[taskId]/route');
    const deniedDetail = await detail.GET(new NextRequest('http://localhost/api/tasks/task', {
      headers: { Authorization: 'Bearer beta-token' },
    }), { params: Promise.resolve({ taskId: alphaTaskId }) });
    assert.equal(deniedDetail.status, 404, 'cross-member task detail must fail closed');
    const ownDetail = await detail.GET(new NextRequest('http://localhost/api/tasks/task', {
      headers: { Authorization: 'Bearer alpha-token' },
    }), { params: Promise.resolve({ taskId: alphaTaskId }) });
    const ownDetailBody = await ownDetail.json() as { task: Record<string, unknown> };
    assert.equal(ownDetail.status, 200);
    assert(!('owner' in ownDetailBody.task), 'detail must not expose owner identifiers');

    const monitorCreate = await route.POST(new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      headers: { Authorization: 'Bearer alpha-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', userId: 'member-beta', projectName: 'Owned monitor task' }),
    }));
    assert.equal(monitorCreate.status, 200);
    const monitorCreateBody = await monitorCreate.json() as { task: { taskId: string; userId?: string } };
    assert(!monitorCreateBody.task.userId, 'monitor create response must not expose owner key');
    const foreignSafety = await route.POST(new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      headers: { Authorization: 'Bearer beta-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'safety_check', taskId: monitorCreateBody.task.taskId, prompt: 'check' }),
    }));
    assert.equal(foreignSafety.status, 404, 'cross-member monitor actions must fail closed');
    const monitorList = await route.GET(new NextRequest('http://localhost/api/tasks', {
      headers: { Authorization: 'Bearer alpha-token' },
    }));
    const monitorListBody = await monitorList.json() as { monitorTasks: Array<Record<string, unknown>> };
    assert.equal(monitorListBody.monitorTasks.length, 1);
    assert(!('userId' in monitorListBody.monitorTasks[0]), 'monitor owner key must stay private');

    const detection = await import('../src/app/api/video/detect-sdk/route');
    const createdDetection = await detection.POST(new NextRequest('http://localhost/api/video/detect-sdk', {
      method: 'POST',
      headers: { Authorization: 'Bearer alpha-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'shared-id', maxTestDuration: 5 }),
    }));
    assert.equal(createdDetection.status, 200);
    const foreignDetection = await detection.GET(new NextRequest('http://localhost/api/video/detect-sdk?sessionId=shared-id', {
      headers: { Authorization: 'Bearer beta-token' },
    }));
    assert.equal(foreignDetection.status, 404, 'readiness sessions must be member isolated');
    const ownDetection = await detection.GET(new NextRequest('http://localhost/api/video/detect-sdk?sessionId=shared-id', {
      headers: { Authorization: 'Bearer alpha-token' },
    }));
    assert.equal(ownDetection.status, 200);

    const vimax = await import('../src/app/api/smart/vimax-agent-step/route');
    const anonymousVimax = await vimax.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'plan', prompt: 'anonymous provider request' }),
    }));
    assert.equal(anonymousVimax.status, 401, 'provider route must reject anonymous work before any model call');

    const detailRoute = await readFile(path.join(process.cwd(), 'src/app/api/tasks/[taskId]/route.ts'), 'utf8');
    const eventsRoute = await readFile(path.join(process.cwd(), 'src/app/api/tasks/[taskId]/events/route.ts'), 'utf8');
    const mergeRoute = await readFile(path.join(process.cwd(), 'src/app/api/tasks/[taskId]/merge-segments/route.ts'), 'utf8');
    const resumeRoute = await readFile(path.join(process.cwd(), 'src/app/api/tasks/[taskId]/resume-segment/route.ts'), 'utf8');
    for (const source of [detailRoute, eventsRoute, mergeRoute, resumeRoute]) {
      assert.match(source, /resolveTaskOwnerFromRequest/);
      assert.match(source, /getTaskForOwner/);
    }

    const taskSideChannels = [
      'src/app/api/production/archive-video-task/route.ts',
      'src/app/api/production/projects/[taskId]/storyboard/[shotId]/route.ts',
      'src/app/api/production/projects/[taskId]/assets/[assetId]/route.ts',
      'src/app/api/video/detect-sdk/route.ts',
      'src/app/api/smart/vimax-agent-step/route.ts',
    ];
    for (const relativePath of taskSideChannels) {
      const source = await readFile(path.join(process.cwd(), relativePath), 'utf8');
      assert.match(source, /resolveTaskOwnerFromRequest/, `${relativePath} must require the trusted account session`);
    }

    const apiRoutes = await collectRouteFiles(path.join(process.cwd(), 'src/app/api'));
    for (const file of apiRoutes) {
      const source = await readFile(file, 'utf8');
      if (/\b(createTask|getTask|getTaskFresh|getAllTasks|TaskMonitor)\s*\(/.test(source)) {
        assert.match(source, /resolveTaskOwnerFromRequest/, `${path.relative(process.cwd(), file)} must derive task access from the trusted session`);
      }
    }

    for (const relativePath of [
      'src/app/api/smart/director-chain/route.ts',
      'src/app/api/production/dry-run/route.ts',
      'src/app/api/storyboard/submit/route.ts',
    ]) {
      const source = await readFile(path.join(process.cwd(), relativePath), 'utf8');
      assert.match(source, /publicTask\(/, `${relativePath} must strip owner data before returning a task`);
    }

    const packageJson = await readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    assert.doesNotMatch(packageJson, /coze-coding-dev-sdk/, 'legacy provider SDK must not return');

    console.log('member task isolation tests passed');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousTaskFile === undefined) delete process.env.HUIYING_TASKS_FILE;
    else process.env.HUIYING_TASKS_FILE = previousTaskFile;
    if (previousAccountBase === undefined) delete process.env.ACCOUNT_CENTER_API_BASE;
    else process.env.ACCOUNT_CENTER_API_BASE = previousAccountBase;
    await rm(root, { recursive: true, force: true });
  }
}

void main();
