import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const port = 5395;
const accountPort = 5394;
const origin = `http://127.0.0.1:${port}`;
const appOrigin = `${origin}/huiying`;
const fixtureToken = 'segment-retry-fixture-session';
const taskFile = path.join(tmpdir(), `sceneweave-segment-retry-browser-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.length,
  });
  response.end(bytes);
}

const accountServer = createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${fixtureToken}`) {
    return json(response, 401, { error: 'not_authenticated' });
  }
  if (request.url === '/v1/auth/me') {
    return json(response, 200, {
      tenant_id: 'tenant-segment-fixture',
      tenant_name: '分段恢复测试团队',
      member: {
        id: 'member-segment-fixture',
        display_name: '分段恢复测试员',
        email: 'segment-retry@example.test',
        role_key: 'member',
        status: 'active',
      },
      expires_at: '2099-01-01T00:00:00.000Z',
    });
  }
  if (request.url === '/v1/me/provider-key-profile') {
    return json(response, 200, {
      profile: {
        configured: false,
        text_model: 'qwen3.7-plus',
        image_model: 'wan2.7-image-pro',
        tts_model: 'qwen-audio-3.0-tts-plus',
      },
    });
  }
  return json(response, 404, { error: 'fixture_route_not_found' });
});

function listen(server: import('node:http').Server, listenPort: number) {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(listenPort, '127.0.0.1', resolve);
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${appOrigin}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('segment_retry_fixture_health_timeout');
}

async function stop(process: ChildProcess | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!process.killed) process.kill('SIGKILL');
}

async function main() {
  const { buildProductionBackedVimaxPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts');
  const {
    approveVimaxProductionPlan,
    buildVimaxProductionPlan,
    confirmVimaxProductionExternalCost,
  } = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const { createTask, failTask, getTaskFresh, updateTask } = await import('../src/lib/task-manager');

  const owner = { tenantId: 'tenant-segment-fixture', memberId: 'member-segment-fixture' };
  const plan = {
    title: '雨夜交接',
    summary: '记者在雨夜天台拾起证据后继续追踪。无费用分段恢复测试。',
    assets: [
      { kind: 'character' as const, label: '记者', prompt: '蓝色风衣，短发' },
      { kind: 'scene' as const, label: '雨夜天台', prompt: '冷蓝灯光，湿地反光' },
    ],
    shots: [
      { index: 1, title: '拾起证据', duration: 5, camera: '中景', prompt: '记者弯腰拾起录音笔。' },
      { index: 2, title: '继续追踪', duration: 5, camera: '跟拍', prompt: '记者握住录音笔走向楼梯。' },
    ],
    nextAction: '确认后生成',
  };
  const parentTaskId = createTask('storyboard', {
    prompt: plan.summary,
    workflow: 'vimax-agent',
  }, owner);
  const completedChildTaskId = createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 0,
    assemblySegmentId: 'segment-1',
    productionProjectId: 'production-segment-browser',
    shotId: 'shot-1',
  }, owner);
  const failedChildTaskId = createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 1,
    assemblySegmentId: 'segment-2',
    productionProjectId: 'production-segment-browser',
    shotId: 'shot-2',
  }, owner);

  updateTask(completedChildTaskId, {
    status: 'completed',
    progress: 100,
    stage: '片段已完成',
    result: { videoUrl: '/huiying/api/final-videos/completed-fixture' },
  });
  failTask(failedChildTaskId, 'fixture_provider_timeout');

  const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
    phase: 'video',
    style: '冷蓝电影感',
    sceneType: 'drama',
    ratio: '16:9',
    resolution: '720p',
    skillId: 'short-drama',
  }, parentTaskId);
  const productionPlan = confirmVimaxProductionExternalCost(approveVimaxProductionPlan(buildVimaxProductionPlan({
    title: plan.title,
    ratio: '16:9',
    resolution: '720p',
    planModel: 'fixture-plan-model',
    imageModel: 'wan2.7-image-pro',
    videoModel: 'happyhorse-1.1-i2v',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: plan.assets,
    shots: plan.shots,
  })));
  const parentResult = {
      ...built,
      vimaxPlan: plan,
      productionPlan,
      productionProject: {
        id: 'production-segment-browser',
        title: plan.title,
        prompt: plan.summary,
        style: '冷蓝电影感',
        ratio: '16:9',
        sceneType: 'drama',
        duration: 10,
      },
      assemblyPlan: {
        version: 'fixture',
        productionProjectId: 'production-segment-browser',
        sourceTaskId: parentTaskId,
        totalDuration: 10,
        segmentCount: 2,
        status: 'failed',
        segments: [
          {
            id: 'segment-1',
            index: 0,
            shotId: 'shot-1',
            duration: 5,
            prompt: plan.shots[0].prompt,
            status: 'completed',
            expectedInputs: {
              firstFrameUrl: null,
              previousLastFrameUrl: null,
              sourceSegmentId: null,
              sourceAssetId: null,
              continuityPrompt: '首段无需前序尾帧。',
            },
            expectedOutputs: {
              taskId: completedChildTaskId,
              videoUrl: '/huiying/api/final-videos/completed-fixture',
              lastFrameUrl: '/huiying/api/final-videos/completed-fixture/tail',
              providerTaskId: 'fixture-completed-provider-task',
            },
          },
          {
            id: 'segment-2',
            index: 1,
            shotId: 'shot-2',
            duration: 5,
            prompt: plan.shots[1].prompt,
            status: 'failed',
            error: 'fixture_provider_timeout',
            expectedInputs: {
              firstFrameUrl: '/huiying/api/final-videos/completed-fixture/tail',
              previousLastFrameUrl: '/huiying/api/final-videos/completed-fixture/tail',
              sourceSegmentId: 'segment-1',
              sourceAssetId: 'video-segment-1',
              continuityPrompt: '使用片段 1 真实尾帧继续动作。',
            },
            expectedOutputs: {
              taskId: failedChildTaskId,
              videoUrl: null,
              lastFrameUrl: null,
              providerTaskId: 'fixture-failed-provider-task',
            },
          },
        ],
        recovery: { resumeFromSegmentIndex: 1 },
      },
      assemblyQueue: {
        version: 'fixture',
        sourceTaskId: parentTaskId,
        status: 'failed',
        queuedSegmentCount: 2,
        childTaskIds: [completedChildTaskId, failedChildTaskId],
        updatedAt: new Date(0).toISOString(),
      },
    } as unknown as NonNullable<Parameters<typeof updateTask>[1]['result']>;
  updateTask(parentTaskId, {
    status: 'completed',
    progress: 100,
    result: parentResult,
  });

  const appOutput: string[] = [];
  let app: ChildProcess | undefined;
  const browser = await chromium.launch({ headless: true });
  try {
    await listen(accountServer, accountPort);
    app = spawn(process.execPath, ['dist/server.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        BIND_HOST: '127.0.0.1',
        NEXT_PUBLIC_BASE_PATH: '/huiying',
        ACCOUNT_CENTER_API_BASE: `http://127.0.0.1:${accountPort}`,
        ACCOUNT_CENTER_REQUIRE_AUTH: 'true',
        ACCOUNT_CENTER_APP_KEY: 'huiying',
        ACCOUNT_CENTER_CREDENTIAL_KEY: 'fixture-credential',
        ACCOUNT_CENTER_CLIENT_SECRET: 'fixture-client-secret',
        HUIYING_TASKS_FILE: taskFile,
        HUIYING_OBSERVABILITY_HASH_KEY: 'fixture-observability-hash-key-32-bytes',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    app.stdout?.on('data', chunk => appOutput.push(String(chunk)));
    app.stderr?.on('data', chunk => appOutput.push(String(chunk)));
    await waitForHealth();

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: 'huiying_account_token', value: fixtureToken, url: origin }]);
    await context.addInitScript(token => localStorage.setItem('account_entitlement_token', token), fixtureToken);
    const page = await context.newPage();
    const errors: string[] = [];
    const failedResponses: Array<{ status: number; url: string }> = [];
    let retryRequests = 0;
    let cancelRequests = 0;
    let providerRequests = 0;
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    });
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/api/production/assembly-plan/segment/retry')) retryRequests += 1;
      if (request.method() === 'DELETE' && pathname.endsWith(`/api/tasks/${failedChildTaskId}`)) cancelRequests += 1;
      if (/\/api\/(?:image\/generate|video\/generate|smart\/vimax-agent-step|production\/assembly-plan\/segment\/start)$/.test(pathname)) {
        providerRequests += 1;
      }
    });

    await page.goto(`${appOrigin}/embed/creation-agent?taskId=${parentTaskId}`, { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('vimax-segmented-production');
    await card.waitFor({ state: 'visible', timeout: 15_000 });
    await card.getByText('片段 1', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('已完成', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('片段 2', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('失败', { exact: true }).waitFor({ state: 'visible' });

    const retryButton = card.getByRole('button', { name: '仅重试此片段', exact: true });
    await retryButton.click();
    await card.getByText('等待制作', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(retryRequests, 1, 'one click must submit exactly one retry request');
    assert.equal(providerRequests, 0, 'retry action must not call a provider');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.waitFor({ state: 'visible', timeout: 15_000 });
    await card.getByText('片段 1', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('已完成', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('片段 2', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('等待制作', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await card.getByRole('button', { name: '仅重试此片段', exact: true }).count(), 0);

    const failedAfterRetry = getTaskFresh(failedChildTaskId);
    const completedAfterRetry = getTaskFresh(completedChildTaskId);
    const parentAfterRetry = getTaskFresh(parentTaskId);
    const segments = parentAfterRetry?.result?.assemblyPlan?.segments || [];
    assert.equal(failedAfterRetry?.status, 'pending');
    assert.equal(failedAfterRetry?.config.retryCount, 1);
    assert.equal(completedAfterRetry?.status, 'completed');
    assert.equal(segments[0]?.status, 'completed');
    assert.equal(segments[0]?.expectedOutputs?.videoUrl, '/huiying/api/final-videos/completed-fixture');
    assert.equal(segments[1]?.status, 'queued');
    assert.equal(segments[1]?.expectedOutputs?.taskId, failedChildTaskId);
    assert.equal(retryRequests, 1, 'refresh must not submit another retry request');
    assert.equal(providerRequests, 0, 'refresh must not call a provider');

    const cancelButton = card.getByRole('button', { name: '取消此片段', exact: true });
    await cancelButton.click();
    await card.getByText('已取消', { exact: true }).first().waitFor({ state: 'visible' });
    assert.equal(cancelRequests, 1, 'one click must submit exactly one cancel request');
    assert.equal(providerRequests, 0, 'cancel action must not call a provider');
    assert.equal(getTaskFresh(failedChildTaskId)?.status, 'cancelled');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.waitFor({ state: 'visible', timeout: 15_000 });
    await card.getByText('片段 1', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('已完成', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('片段 2', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('已取消', { exact: true }).first().waitFor({ state: 'visible' });
    assert.equal(cancelRequests, 1, 'refresh must not submit another cancel request');

    await card.getByRole('button', { name: '仅重试此片段', exact: true }).click();
    await card.getByText('等待制作', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(retryRequests, 2, 'cancelled segment recovery must submit one additional retry request');
    assert.equal(providerRequests, 0, 'cancelled segment recovery must not call a provider');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.waitFor({ state: 'visible', timeout: 15_000 });
    await card.getByText('片段 1', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('已完成', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('片段 2', { exact: true }).waitFor({ state: 'visible' });
    await card.getByText('等待制作', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await card.getByRole('button', { name: '仅重试此片段', exact: true }).count(), 0);

    const cancelledAfterRecovery = getTaskFresh(failedChildTaskId);
    const completedAfterCancelRecovery = getTaskFresh(completedChildTaskId);
    const parentAfterCancelRecovery = getTaskFresh(parentTaskId);
    const recoveredSegments = parentAfterCancelRecovery?.result?.assemblyPlan?.segments || [];
    assert.equal(cancelledAfterRecovery?.status, 'pending');
    assert.equal(cancelledAfterRecovery?.config.retryCount, 2);
    assert.equal(completedAfterCancelRecovery?.status, 'completed');
    assert.equal(recoveredSegments[0]?.status, 'completed');
    assert.equal(recoveredSegments[0]?.expectedOutputs?.videoUrl, '/huiying/api/final-videos/completed-fixture');
    assert.equal(recoveredSegments[1]?.status, 'queued');
    assert.equal(recoveredSegments[1]?.expectedOutputs?.taskId, failedChildTaskId);
    assert.equal(cancelRequests, 1, 'cancelled segment recovery must not repeat cancellation');
    assert.equal(retryRequests, 2, 'refresh after cancelled segment recovery must not repeat retry');
    assert.equal(providerRequests, 0, 'refresh after cancelled segment recovery must not call a provider');

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, 'segment recovery page has horizontal overflow');
    assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedResponses, [], `failed responses: ${JSON.stringify(failedResponses)}`);

    console.log(JSON.stringify({
      ok: true,
      path: 'failed segment retry -> cancel queued segment -> refresh -> recover cancelled segment',
      taskId: parentTaskId,
      childTaskId: failedChildTaskId,
      retryRequests,
      cancelRequests,
      providerCalls: providerRequests,
      retryCount: cancelledAfterRecovery?.config.retryCount,
      completedSegmentPreserved: true,
      cancelledSegmentRefreshed: true,
      cancelledSegmentRecovered: true,
      refreshedSameTask: true,
      usedRealKey: false,
      incurredCost: false,
    }, null, 2));
    await context.close();
  } catch (error) {
    console.error(appOutput.join(''));
    throw error;
  } finally {
    await browser.close();
    await stop(app);
    accountServer.close();
    rmSync(taskFile, { force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
