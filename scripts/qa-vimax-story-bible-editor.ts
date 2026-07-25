import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const port = 5397;
const accountPort = 5396;
const origin = `http://127.0.0.1:${port}`;
const appOrigin = `${origin}/huiying`;
const fixtureToken = 'story-bible-fixture-session';
const taskFile = path.join(tmpdir(), `sceneweave-story-bible-browser-${randomUUID()}.json`);
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
      tenant_id: 'tenant-fixture',
      tenant_name: '故事编辑测试团队',
      member: {
        id: 'member-fixture',
        display_name: '故事编辑测试员',
        email: 'story-editor@example.test',
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
  throw new Error('story_bible_fixture_health_timeout');
}

async function stop(process: ChildProcess | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!process.killed) process.kill('SIGKILL');
}

async function main() {
  const { buildProductionBackedVimaxPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts');
  const { buildVimaxProductionPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const { createTask, updateTask } = await import('../src/lib/task-manager');

  const owner = { tenantId: 'tenant-fixture', memberId: 'member-fixture' };
  const plan = {
    title: '雨夜录音笔',
    summary: '记者在雨夜车站追查一支录音笔。',
    assets: [
      { kind: 'character' as const, label: '记者', prompt: '蓝色风衣，短发' },
      { kind: 'scene' as const, label: '雨夜车站', prompt: '冷蓝顶灯，湿地反光' },
    ],
    shots: [
      { index: 1, title: '发现', duration: 5, camera: '中景', prompt: '记者看见录音笔。' },
      { index: 2, title: '拾取', duration: 5, camera: '近景', prompt: '记者拾起录音笔。' },
    ],
    nextAction: '确认后生成',
  };
  const taskId = createTask('storyboard', { prompt: plan.summary, workflow: 'vimax-agent' }, owner);
  const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
    phase: 'plan',
    style: '冷蓝电影感',
    sceneType: 'drama',
    ratio: '16:9',
    resolution: '720p',
    skillId: 'short-drama',
  }, taskId);
  const productionPlan = buildVimaxProductionPlan({
    title: plan.title,
    ratio: '16:9',
    resolution: '720p',
    planModel: 'authoritative-plan-model',
    imageModel: 'wan2.7-image-pro',
    videoModel: 'happyhorse-1.1-i2v',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: plan.assets,
    shots: plan.shots,
  });
  updateTask(taskId, {
    status: 'completed',
    progress: 100,
    result: {
      ...built,
      vimaxPlan: plan,
      productionPlan,
    },
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

    const results = [];
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      await context.addCookies([{ name: 'huiying_account_token', value: fixtureToken, url: origin }]);
      await context.addInitScript(token => localStorage.setItem('account_entitlement_token', token), fixtureToken);
      const page = await context.newPage();
      const errors: string[] = [];
      const failedResponses: Array<{ status: number; url: string }> = [];
      let providerRequests = 0;
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
      });
      page.on('request', request => {
        if (/\/api\/(?:image\/generate|video\/generate|smart\/vimax-agent-step)/.test(request.url())) providerRequests += 1;
      });

      const url = `${appOrigin}/embed/creation-agent?taskId=${taskId}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const editor = page.getByTestId('creation-project-editor');
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      const premise = `记者必须在末班车离站前找回录音证据（${viewport.name}）`;
      await page.getByLabel('故事前提').fill(premise);
      await page.getByLabel('连续性规则').fill('蓝色风衣保持不变\n录音笔始终在主角左手');
      await page.getByRole('button', { name: '保存故事', exact: true }).click();
      await page.getByRole('button', { name: '保存故事', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.getByLabel('故事前提').inputValue(), premise);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      assert.equal(await page.getByLabel('故事前提').inputValue(), premise);
      assert.match(await page.getByLabel('连续性规则').inputValue(), /录音笔始终在主角左手/);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${viewport.name} horizontal overflow`);
      assert.equal(providerRequests, 0, `${viewport.name} story edit called a provider`);
      assert.deepEqual(errors, [], `${viewport.name} console errors: ${errors.join(' | ')}`);
      assert.deepEqual(failedResponses, [], `${viewport.name} failed responses: ${JSON.stringify(failedResponses)}`);
      results.push({ viewport: viewport.name, saved: true, refreshed: true, overflow: false });
      await context.close();
    }

    console.log(JSON.stringify({
      ok: true,
      path: 'story Bible click -> save -> refresh recovery',
      results,
      providerCalls: 0,
      usedRealKey: false,
      incurredCost: false,
    }));
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
