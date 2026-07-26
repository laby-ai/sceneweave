import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const appPort = 5398;
const providerPort = 5397;
const origin = `http://127.0.0.1:${appPort}`;
const appOrigin = `${origin}/huiying`;
const workspaceKey = 'guest-creation-planning-cancel-20260726';
const taskFile = path.join(tmpdir(), `sceneweave-planning-cancel-${randomUUID()}.json`);

const fixturePlan = JSON.stringify({
  title: '雨夜天台的胶片',
  summary: '记者在同一雨夜天台拾起发光胶片，并沿着胶片投出的光线继续追踪。',
  story: {
    premise: '发光胶片指向一段被掩盖的城市记录。',
    protagonist: '穿深蓝风衣的年轻记者',
    desire: '在天亮前找到记录源头',
    obstacle: '暴雨和逐渐熄灭的胶片',
    conflict: '她必须在保全证据和继续追踪之间选择',
    turningPoint: '胶片投出通往楼梯间的蓝光',
    endingHook: '楼梯门后传来旧放映机转动声',
    emotionalArc: { start: '警惕', shift: '确认线索', end: '决意追踪' },
  },
  characters: [{
    id: 'reporter',
    label: '年轻记者',
    description: '湿发，深蓝风衣，右手握发光胶片',
    continuityAnchors: ['深蓝风衣', '右手胶片', '湿发'],
  }],
  scenes: [{
    id: 'rooftop',
    label: '雨夜天台',
    description: '冷蓝霓虹、湿地反光和楼梯间铁门',
    timeOfDay: 'night',
    continuityAnchors: ['冷蓝主光', '雨势连续', '铁门位于画面右侧'],
  }],
  props: [{
    id: 'film',
    label: '发光胶片',
    description: '掌心大小的透明胶片，边缘发蓝光',
    state: '持续发光',
  }],
  assets: [
    { kind: 'character', label: '年轻记者', prompt: '湿发、深蓝风衣、右手握发光胶片' },
    { kind: 'scene', label: '雨夜天台', prompt: '冷蓝霓虹、湿地反光、右侧楼梯铁门' },
    { kind: 'prop', label: '发光胶片', prompt: '掌心大小、透明、边缘蓝光' },
  ],
  shots: [
    {
      index: 1,
      title: '拾起胶片',
      duration: 5,
      camera: '中景缓慢推进',
      prompt: '记者在雨夜天台弯腰拾起发光胶片，蓝光照亮深蓝风衣袖口。',
      sceneId: 'rooftop',
      characterIds: ['reporter'],
      propIds: ['film'],
      actionStart: '记者弯腰伸手',
      actionEnd: '记者直起身看向右侧铁门',
      firstFrameDescription: '记者弯腰，胶片位于积水中',
      lastFrameDescription: '记者站直，右手胶片，视线朝右',
      motionDescription: '弯腰拾取后站直',
      spatialRelation: 'same-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      conflictFlags: [],
    },
    {
      index: 2,
      title: '追随蓝光',
      duration: 5,
      camera: '右向跟拍',
      prompt: '延续上一镜尾帧，记者握着同一胶片向右侧铁门快步走去。',
      sceneId: 'rooftop',
      characterIds: ['reporter'],
      propIds: ['film'],
      actionStart: '记者站直看向右侧',
      actionEnd: '记者抵达铁门并抬起左手',
      firstFrameDescription: '复用上一镜尾帧',
      lastFrameDescription: '记者右手握胶片，左手停在门把前',
      motionDescription: '向右快步行走',
      spatialRelation: 'same-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      conflictFlags: [],
    },
  ],
  nextAction: '确认分镜后生成参考图。',
});

function listen(server: import('node:http').Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function stop(process: ChildProcess | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!process.killed) process.kill('SIGKILL');
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${appOrigin}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('planning_cancel_fixture_health_timeout');
}

async function main() {
  let providerCalls = 0;
  let firstProviderClosed = false;
  const providerServer = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/api/plan/v3/chat/completions') {
      response.writeHead(404).end();
      return;
    }
    providerCalls += 1;
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    if (providerCalls === 1) {
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: fixturePlan.slice(0, 30) } }] })}\n\n`);
      const timer = setTimeout(() => response.end(), 30_000);
      response.once('close', () => {
        clearTimeout(timer);
        firstProviderClosed = true;
      });
      return;
    }
    const chunks = fixturePlan.match(/[\s\S]{1,180}/g) || [];
    let index = 0;
    const timer = setInterval(() => {
      if (index >= chunks.length) {
        clearInterval(timer);
        response.write('data: [DONE]\n\n');
        response.end();
        return;
      }
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[index] } }] })}\n\n`);
      index += 1;
    }, 5);
    response.once('close', () => clearInterval(timer));
  });

  const appOutput: string[] = [];
  let app: ChildProcess | undefined;
  const browser = await chromium.launch({ headless: true });
  try {
    await listen(providerServer, providerPort);
    app = spawn(process.execPath, ['dist/server.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(appPort),
        HOSTNAME: '127.0.0.1',
        BIND_HOST: '127.0.0.1',
        NEXT_PUBLIC_BASE_PATH: '/huiying',
        HUIYING_REAL_ARK_API_KEY: 'fixture-planning-key',
        HUIYING_REAL_ARK_API_BASE: `http://127.0.0.1:${providerPort}/api/plan/v3`,
        HUIYING_TASKS_FILE: taskFile,
        HUIYING_OBSERVABILITY_HASH_KEY: 'fixture-observability-hash-key-32-bytes',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    app.stdout?.on('data', chunk => appOutput.push(String(chunk)));
    app.stderr?.on('data', chunk => appOutput.push(String(chunk)));
    await waitForHealth();

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('account_entitlement_token', 'planning-cancel-ui-fixture-token');
    });
    const page = await context.newPage();
    await page.route('**/api/account/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenant_id: 'paper-host-guest',
        tenant_name: '规划恢复测试空间',
        member: {
          id: 'planning-cancel-fixture',
          display_name: '规划恢复测试员',
          email: 'planning-cancel@example.test',
          role_key: 'member',
          status: 'active',
        },
        expires_at: '2099-01-01T00:00:00.000Z',
      }),
    }));
    await page.route('**/api/account/provider-profile', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          configured: true,
          text_model: 'qwen3.7-plus',
          image_model: 'wan2.7-image-pro',
          tts_model: 'qwen-audio-3.0-tts-plus',
        },
      }),
    }));
    await page.route('**/api/tasks', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, tasks: [] }),
        });
        return;
      }
      await route.continue();
    });
    const errors: string[] = [];
    const failedResponses: Array<{ status: number; url: string }> = [];
    let planningRequests = 0;
    let cancelRequests = 0;
    let mediaStageRequests = 0;
    const requestedUrls: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    });
    page.on('request', request => {
      requestedUrls.push(`${request.method()} ${request.url()}`);
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/api/smart/vimax-agent-step') && request.method() === 'POST') {
        const body = request.postDataJSON() as { phase?: string } | null;
        if (body?.phase === 'plan') planningRequests += 1;
        if (body?.phase === 'reference_assets' || body?.phase === 'video') mediaStageRequests += 1;
      }
      if (request.method() === 'DELETE' && /\/api\/tasks\/[^/]+$/.test(pathname)) cancelRequests += 1;
    });

    const url = `${appOrigin}/embed/creation-agent?embed=creation-agent&workspaceKey=${workspaceKey}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    assert.doesNotMatch(
      page.url(),
      /account-login/,
      `unexpected login redirect; requests=${requestedUrls.join(' | ')}`,
    );
    const input = page.getByPlaceholder(/输入想法、剧本或上传参考/);
    await input.fill('10秒短剧：记者在雨夜天台拾起发光胶片，两个连续的5秒镜头。');
    await input.press('Enter');
    await page.getByText(/正在规划你的短剧分镜/).waitFor({ state: 'visible' });
    await page.waitForURL(/taskId=/, { timeout: 10_000 });
    const cancelledTaskId = new URL(page.url()).searchParams.get('taskId');
    assert.ok(cancelledTaskId, 'plan.accepted must expose the owner-scoped task id before provider completion');

    await page.getByRole('button', { name: '停止生成' }).click();
    await page.getByText(/已取消本次规划/).waitFor({ state: 'visible' });
    await page.waitForFunction(() => performance.getEntriesByType('resource')
      .some(entry => entry.name.includes('/api/tasks/') && entry.name.includes('taskId') === false));
    assert.equal(cancelRequests, 1, 'one stop click must issue one authenticated task cancellation');

    const cancelledResponse = await page.evaluate(async taskId => {
      const response = await fetch(`/huiying/api/tasks/${encodeURIComponent(String(taskId))}`, {
        headers: {
          'x-paper-host-embed': 'creation-agent',
          'x-paper-host-guest-workspace': 'guest-creation-planning-cancel-20260726',
        },
      });
      return response.json();
    }, cancelledTaskId) as { task?: { status?: string } };
    assert.equal(cancelledResponse.task?.status, 'cancelled');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(/本次规划已取消/).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: '重新生成' }).dblclick();
    await page.getByText('雨夜天台的胶片', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    assert.equal(planningRequests, 2, 'double click retry must start exactly one new planning attempt');
    assert.equal(providerCalls, 2, 'cancelled attempt plus one retry should be the only planning provider calls');
    assert.equal(mediaStageRequests, 0, 'planning cancel/retry must not enter reference or video stages');
    assert.equal(firstProviderClosed, true, 'browser cancellation must close the in-flight planning provider stream');

    const persistedTasks = JSON.parse(readFileSync(taskFile, 'utf8')) as Array<{ status?: string; config?: { phase?: string } }>;
    const planningTasks = persistedTasks.filter(task => task.config?.phase === 'plan');
    assert.equal(planningTasks.filter(task => task.status === 'cancelled').length, 1);
    assert.equal(planningTasks.filter(task => task.status === 'completed').length, 1);
    assert.equal(errors.length, 0, `browser errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedResponses, [], `failed responses: ${JSON.stringify(failedResponses)}`);

    console.log(JSON.stringify({
      ok: true,
      planningRequests,
      cancelRequests,
      providerCalls,
      mediaStageRequests,
      statuses: planningTasks.map(task => task.status),
    }));
    await context.close();
  } catch (error) {
    if (appOutput.length) console.error(appOutput.join(''));
    throw error;
  } finally {
    await browser.close();
    await stop(app);
    await new Promise<void>(resolve => providerServer.close(() => resolve()));
    rmSync(taskFile, { force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
