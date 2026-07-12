import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const rawTenant = 'tenant-observability-raw-DO-NOT-ECHO';
const rawMember = 'member-observability-raw-DO-NOT-ECHO';
const rawPrompt = 'prompt-observability-raw-DO-NOT-ECHO';
const rawError = 'error-observability-raw-DO-NOT-ECHO';
const rawUrl = 'https://private.example.invalid/observability-raw-DO-NOT-ECHO';

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'huiying-secure-observability-'));
  const previousKey = process.env.HUIYING_OBSERVABILITY_HASH_KEY;
  const previousTasksFile = process.env.HUIYING_TASKS_FILE;
  process.env.HUIYING_OBSERVABILITY_HASH_KEY = 'test-only-observability-key-32-bytes-minimum';
  process.env.HUIYING_TASKS_FILE = path.join(tempRoot, 'tasks.json');

  const captured: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const capture = (...values: unknown[]) => captured.push(values.map(value => String(value)).join(' '));
  console.log = capture;
  console.warn = capture;
  console.error = capture;

  try {
  const observation = await import('../src/lib/operational-observability');
  const requestObservation = await import('../src/lib/request-observability');
  const tasks = await import('../src/lib/task-manager');

  assert.deepEqual(observation.getOperationalObservabilityReadiness(), {
    ready: true,
    blockers: [],
  });
  assert.equal(
    observation.createSecureRef('tenant', rawTenant),
    observation.createSecureRef('tenant', rawTenant),
    'secure references must be deterministic',
  );
  assert.notEqual(
    observation.createSecureRef('tenant', rawTenant),
    observation.createSecureRef('member', rawTenant),
    'reference namespaces must be separated',
  );

  await requestObservation.runWithRequestObservationContext('secure-task-request-123', async () => {
    const owner = { tenantId: rawTenant, memberId: rawMember };
    const completedTask = tasks.createTask('video', { prompt: rawPrompt, customImageUrl: rawUrl }, owner);
    assert.equal(tasks.startTask(completedTask), true);
    assert.equal(tasks.completeTask(completedTask, { videoUrl: rawUrl }), true);

    const failedTask = tasks.createTask('image', { prompt: rawPrompt }, owner);
    assert.equal(tasks.startTask(failedTask), true);
    assert.equal(tasks.failTask(failedTask, rawError), true);

    const cancelledTask = tasks.createTask('storyboard', { prompt: rawPrompt }, owner);
    assert.equal(tasks.cancelTask(cancelledTask), true);

    const providerResult = await observation.observeProviderCall(
      { owner, taskId: completedTask, provider: 'ark-byok-video' },
      async () => 'provider-ok',
    );
    assert.equal(providerResult, 'provider-ok');

    await assert.rejects(
      () => observation.observeProviderCall(
        { owner, taskId: failedTask, provider: 'ark-byok-video' },
        async () => { throw new Error(rawError); },
      ),
      /DO-NOT-ECHO/,
    );
  });

  const events = captured
    .filter(line => line.startsWith('{'))
    .map(line => JSON.parse(line) as Record<string, unknown>)
    .filter(line => typeof line.event === 'string');

  const names = events.map(event => event.event);
  for (const expected of [
    'task.queued',
    'task.running',
    'task.succeeded',
    'task.failed',
    'task.cancelled',
    'provider.started',
    'provider.succeeded',
    'provider.failed',
  ]) {
    assert(names.includes(expected), `missing operational event: ${expected}`);
  }

  const lifecycleEvents = new Set([
    'task.queued', 'task.running', 'task.succeeded', 'task.failed', 'task.cancelled',
    'provider.started', 'provider.succeeded', 'provider.failed',
  ]);
  for (const event of events.filter(item => lifecycleEvents.has(String(item.event)))) {
    assert.equal(event.service, 'huiying');
    assert.equal(event.requestId, 'secure-task-request-123');
    assert.match(String(event.tenantRef), /^tn_[a-f0-9]{24}$/);
    assert.match(String(event.memberRef), /^mb_[a-f0-9]{24}$/);
    assert.match(String(event.taskRef), /^tk_[a-f0-9]{24}$/);
    assert(!('tenantId' in event));
    assert(!('memberId' in event));
    assert(!('prompt' in event));
    assert(!('url' in event));
    assert(!('error' in event));
  }

  const failedProvider = events.find(event => event.event === 'provider.failed');
  assert.equal(failedProvider?.errorType, 'Error');
  assert.equal(typeof failedProvider?.durationMs, 'number');

  const rawLogs = captured.join('\n');
  for (const forbidden of [rawTenant, rawMember, rawPrompt, rawError, rawUrl]) {
    assert(!rawLogs.includes(forbidden), `raw sensitive value leaked: ${forbidden}`);
  }

  delete process.env.HUIYING_OBSERVABILITY_HASH_KEY;
  assert.deepEqual(observation.getOperationalObservabilityReadiness(), {
    ready: false,
    blockers: ['observability_identity_hash_unavailable'],
  });

  const healthRoute = await readFile(path.join(process.cwd(), 'src/app/api/health/route.ts'), 'utf8');
  assert.match(healthRoute, /getOperationalObservabilityReadiness/);
  assert.match(healthRoute, /operationalObservability/);

  const startScript = await readFile(path.join(process.cwd(), 'scripts/start.sh'), 'utf8');
  assert.match(startScript, /HUIYING_OBSERVABILITY_HASH_KEY/);
  assert.match(startScript, /observability hash key is required/);

  const serverSource = await readFile(path.join(process.cwd(), 'src/server.ts'), 'utf8');
  assert.match(serverSource, /getOperationalObservabilityReadiness/);
  assert.match(serverSource, /process\.exit\(78\)/);

  const videoSubmitRoute = await readFile(path.join(process.cwd(), 'src/app/api/video/submit/route.ts'), 'utf8');
  for (const forbiddenLog of [
    "console.log('[Video Background] prompt:'",
    "console.log('[Video Background] Ark BYOK 视频生成成功:'",
    "console.log('[Video Submit] 创建后台任务:'",
    "console.error('[Video Background] 后台视频生成失败:'",
  ]) {
    assert(!videoSubmitRoute.includes(forbiddenLog), `unsafe legacy log remains: ${forbiddenLog}`);
  }
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    if (previousKey === undefined) delete process.env.HUIYING_OBSERVABILITY_HASH_KEY;
    else process.env.HUIYING_OBSERVABILITY_HASH_KEY = previousKey;
    if (previousTasksFile === undefined) delete process.env.HUIYING_TASKS_FILE;
    else process.env.HUIYING_TASKS_FILE = previousTasksFile;
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log('secure task observability contract: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
