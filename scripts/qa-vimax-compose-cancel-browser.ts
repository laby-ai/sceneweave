import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const port = 5401;
const accountPort = 5400;
const origin = `http://127.0.0.1:${port}`;
const appOrigin = `${origin}/huiying`;
const fixtureToken = 'compose-cancel-fixture-session';
const taskFile = path.join(tmpdir(), `sceneweave-compose-cancel-browser-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.HUIYING_TASK_STORE_FILE = taskFile;

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
      tenant_id: 'tenant-compose-fixture',
      tenant_name: '成片恢复测试团队',
      member: {
        id: 'member-compose-fixture',
        display_name: '成片恢复测试员',
        email: 'compose-cancel@example.test',
        role_key: 'member',
        status: 'active',
      },
      expires_at: '2099-01-01T00:00:00.000Z',
    });
  }
  if (request.url === '/v1/me/provider-key-profile') {
    return json(response, 200, {
      profile: {
        configured: true,
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
  throw new Error('compose_cancel_fixture_health_timeout');
}

async function stop(process: ChildProcess | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!process.killed) process.kill('SIGKILL');
}

async function main() {
  const {
    approveVimaxProductionPlan,
    buildVimaxProductionPlan,
    confirmVimaxProductionExternalCost,
  } = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const taskManager = await import('../src/lib/task-manager');
  const owner = { tenantId: 'tenant-compose-fixture', memberId: 'member-compose-fixture' };
  const plan = {
    title: '雨夜交接',
    summary: '记者从天台进入楼梯间，两个镜头连续完成。',
    assets: [
      { kind: 'character' as const, label: '记者', prompt: '深蓝风衣，短发' },
      { kind: 'scene' as const, label: '雨夜天台', prompt: '冷蓝灯光，湿地反光' },
    ],
    shots: [
      { index: 1, title: '走向铁门', duration: 5, camera: '跟拍', prompt: '记者走向天台铁门。' },
      { index: 2, title: '进入楼梯间', duration: 5, camera: '中景', prompt: '记者推门进入楼梯间。' },
    ],
    nextAction: '继续完成成片。',
  };
  const productionPlan = confirmVimaxProductionExternalCost(
    approveVimaxProductionPlan(buildVimaxProductionPlan({
      title: plan.title,
      ratio: '16:9',
      resolution: '720p',
      planModel: 'fixture-plan-model',
      imageModel: 'wan2.7-image-pro',
      videoModel: 'happyhorse-1.1-i2v',
      providerReadiness: { plan: true, referenceAssets: true, video: true },
      assets: plan.assets,
      shots: plan.shots,
    })),
  );
  let parentTaskId = '';
  let childTaskId = '';
  const createFixtureTasks = () => {
    parentTaskId = taskManager.createTask('storyboard', {
      workflow: 'vimax-agent',
      prompt: plan.summary,
    }, owner);
    taskManager.startTask(parentTaskId);
    taskManager.completeTask(parentTaskId, {
      vimaxPlan: plan,
      productionPlan,
      productionProject: { id: 'compose-project', title: plan.title },
    });
    childTaskId = taskManager.createTask('video', {
      workflow: 'vimax-agent-video',
      parentTaskId,
      prompt: plan.title,
      modelId: 'happyhorse-1.1-i2v',
    }, owner);
    taskManager.startTask(childTaskId);
    taskManager.updateTask(parentTaskId, {
      result: {
        ...(taskManager.getTaskFresh(parentTaskId)?.result || {}),
        vimaxVideoTaskId: childTaskId,
        vimaxVideoTaskStatus: 'running',
        vimaxHappyHorseSegments: [{
          shotIndex: 1,
          status: 'succeeded',
          taskId: 'fixture-provider-segment-1',
          videoUrl: '/huiying/api/final-videos/preserved-segment',
        }],
      },
    });
  };

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
        HUIYING_TASK_STORE_FILE: taskFile,
        HUIYING_OBSERVABILITY_HASH_KEY: 'fixture-observability-hash-key-32-bytes',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    app.stdout?.on('data', chunk => appOutput.push(String(chunk)));
    app.stderr?.on('data', chunk => appOutput.push(String(chunk)));
    await waitForHealth();
    createFixtureTasks();
    await new Promise(resolve => setTimeout(resolve, 1_100));

    let cancelRequests = 0;
    let providerRequests = 0;
    const screenshots: string[] = [];
    for (const width of [1280, 768, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
      });
      await context.addCookies([{ name: 'huiying_account_token', value: fixtureToken, url: origin }]);
      await context.addInitScript(token => {
        localStorage.setItem('account_entitlement_token', token);
      }, fixtureToken);
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const failedResponses: Array<{ status: number; url: string }> = [];
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', error => consoleErrors.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
      });
      page.on('request', request => {
        const pathname = new URL(request.url()).pathname;
        if (request.method() === 'DELETE' && pathname.endsWith(`/api/tasks/${childTaskId}`)) {
          cancelRequests += 1;
        }
        if (/\/api\/(?:image\/generate|video\/generate|smart\/vimax-agent-step|production\/assembly-plan\/segment\/start)$/.test(pathname)) {
          providerRequests += 1;
        }
      });

      await page.goto(`${appOrigin}/embed/creation-agent?taskId=${parentTaskId}`, {
        waitUntil: 'domcontentloaded',
      });
      if (width === 1280) {
        await page.getByText(/正在处理的成片任务/).waitFor({ state: 'visible', timeout: 15_000 });
        await page.getByRole('button', { name: '取消成片', exact: true }).click();
        await page.getByText(/已取消本次成片任务/).waitFor({ state: 'visible' });
        assert.equal(cancelRequests, 1, 'one click must send exactly one compose cancel request');
        assert.equal(taskManager.getTaskFresh(childTaskId)?.status, 'cancelled');
        assert.equal(
          taskManager.getTaskFresh(parentTaskId)?.result?.vimaxVideoTaskStatus,
          'cancelled',
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      await page.getByText(/上次成片任务已取消/).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: '找回已完成片段', exact: true }).waitFor({ state: 'visible' });
      await page.getByText(/正在处理的成片任务/).waitFor({ state: 'detached' });
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${width}px page has horizontal overflow`);
      assert.deepEqual(consoleErrors, [], `${width}px console errors: ${consoleErrors.join(' | ')}`);
      assert.deepEqual(failedResponses, [], `${width}px failed responses: ${JSON.stringify(failedResponses)}`);
      const screenshotPath = path.join(process.cwd(), 'outputs', `compose-cancel-recovery-${width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
      await context.close();
    }

    assert.equal(cancelRequests, 1, 'refresh and other viewports must not repeat cancellation');
    assert.equal(providerRequests, 0, 'cancel and refresh must not call a provider');
    assert.doesNotMatch(
      appOutput.join('\n'),
      /Controller is already closed|ERR_INVALID_STATE|uncaughtException/,
    );
    console.log(JSON.stringify({
      ok: true,
      path: 'running compose -> cancel -> refresh same project -> recoverable result',
      parentTaskId,
      childTaskId,
      cancelRequests,
      providerCalls: providerRequests,
      incurredCost: false,
      preservedCompletedSegments: 1,
      screenshots,
    }, null, 2));
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
