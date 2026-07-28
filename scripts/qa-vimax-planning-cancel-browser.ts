import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, expect } from '@playwright/test';

const appPort = 5398;
const providerPort = 5397;
const origin = `http://127.0.0.1:${appPort}`;
const appOrigin = `${origin}/huiying`;
const workspaceKey = 'guest-creation-planning-cancel-20260726';
const taskFile = path.join(tmpdir(), `sceneweave-planning-cancel-${randomUUID()}.json`);
const attachmentRoot = path.join(tmpdir(), `sceneweave-project-attachments-${randomUUID()}`);
const attachmentFixtureRoot = path.join(tmpdir(), `sceneweave-project-attachment-fixtures-${randomUUID()}`);

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
  mkdirSync(attachmentFixtureRoot, { recursive: true });
  const imageFixture = path.join(attachmentFixtureRoot, 'reporter.png');
  const videoFixture = path.join(attachmentFixtureRoot, 'rain-reference.mp4');
  const documentFixture = path.join(attachmentFixtureRoot, 'story-outline.txt');
  writeFileSync(
    imageFixture,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  writeFileSync(videoFixture, Buffer.from('000000186674797069736f6d0000000069736f6d69736f32', 'hex'));
  writeFileSync(documentFixture, '雨夜旧影院。记者拾到会发光的胶片，并沿蓝光寻找记录源头。\n', 'utf8');

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
        HUIYING_PROJECT_ATTACHMENT_STORE_PATH: attachmentRoot,
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
    let forcedAttachmentFailure = false;
    await page.route('**/api/project-attachments', async route => {
      if (route.request().method() === 'POST' && !forcedAttachmentFailure) {
        forcedAttachmentFailure = true;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'fixture_upload_interrupted' }),
        });
        return;
      }
      await route.continue();
    });
    const errors: string[] = [];
    const failedResponses: Array<{ status: number; url: string }> = [];
    let planningRequests = 0;
    const planningAttachmentIds: string[][] = [];
    let cancelRequests = 0;
    let mediaStageRequests = 0;
    let subjectWriteRequests = 0;
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
        const body = request.postDataJSON() as { phase?: string; projectAttachmentIds?: string[] } | null;
        if (body?.phase === 'plan') {
          planningRequests += 1;
          planningAttachmentIds.push(Array.isArray(body.projectAttachmentIds) ? body.projectAttachmentIds : []);
        }
        if (body?.phase === 'reference_assets' || body?.phase === 'video') mediaStageRequests += 1;
      }
      if (request.method() === 'DELETE' && /\/api\/tasks\/[^/]+$/.test(pathname)) cancelRequests += 1;
      if (request.method() !== 'GET' && pathname.endsWith('/api/subjects')) subjectWriteRequests += 1;
    });

    const url = `${appOrigin}/embed/creation-agent?embed=creation-agent&workspaceKey=${workspaceKey}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    assert.doesNotMatch(
      page.url(),
      /account-login/,
      `unexpected login redirect; requests=${requestedUrls.join(' | ')}`,
    );
    const attachmentChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '添加项目素材' }).click();
    await (await attachmentChooser).setFiles([imageFixture, videoFixture, documentFixture]);
    const retryAttachment = page.getByRole('button', { name: '重试 reporter.png' });
    await retryAttachment.waitFor({ state: 'visible', timeout: 15_000 });
    await retryAttachment.click();
    await page.getByText('上传失败', { exact: true }).waitFor({ state: 'hidden', timeout: 15_000 });
    const attachmentRegion = page.getByLabel('已添加项目素材');
    await expect(attachmentRegion).toContainText('reporter.png');
    await expect(attachmentRegion).toContainText('rain-reference.mp4');
    await expect(attachmentRegion).toContainText('story-outline.txt');
    await page.getByRole('button', { name: '后移 reporter.png' }).click();
    await page.getByRole('button', { name: '移除 story-outline.txt' }).click();
    await expect(attachmentRegion).not.toContainText('story-outline.txt');
    const attachmentOrderBeforeRefresh = await attachmentRegion.locator('span > span.min-w-0 > span:first-child').allTextContents();
    assert.deepEqual(attachmentOrderBeforeRefresh, ['rain-reference.mp4', 'reporter.png']);
    const outputDir = path.resolve('outputs');
    mkdirSync(outputDir, { recursive: true });
    const attachmentScreenshot = path.join(outputDir, 'project-attachments-1280.png');
    await page.screenshot({ path: attachmentScreenshot });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restoredAttachmentRegion = page.getByLabel('已添加项目素材');
    await restoredAttachmentRegion.waitFor({ state: 'visible', timeout: 15_000 });
    const attachmentOrderAfterRefresh = await restoredAttachmentRegion.locator('span > span.min-w-0 > span:first-child').allTextContents();
    assert.deepEqual(attachmentOrderAfterRefresh, attachmentOrderBeforeRefresh);

    const input = page.getByPlaceholder(/写下故事、粘贴剧本，或上传参考素材/);
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
    await page.getByRole('heading', { name: '雨夜天台的胶片' }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByText('拾起胶片', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByText('追随蓝光', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByLabel('创作理解确认')).toBeVisible();
    await expect(page.getByLabel('分镜确认')).toBeVisible();
    await expect(page.getByLabel('下一步确认')).toBeVisible();
    const confirmationScreenshots: string[] = [];
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.getByLabel('创作理解确认').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const screenshotPath = path.join(outputDir, `agent-confirmation-${viewport.width}.png`);
      await page.screenshot({ path: screenshotPath });
      confirmationScreenshots.push(screenshotPath);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: '确认故事和分镜' }).click();
    await expect(page.getByRole('button', { name: '使用百炼继续制作' })).toBeVisible();
    await page.getByRole('button', { name: '使用百炼继续制作' }).click();
    await expect(page.getByRole('button', { name: '确认分镜，生成参考图' })).toBeVisible();
    await expect(page.getByTestId('creation-production-plan')).toHaveCount(0);
    const visiblePlanText = await page.locator('body').innerText();
    assert.match(visiblePlanText, /拾起胶片/);
    assert.match(visiblePlanText, /追随蓝光/);
    assert.match(visiblePlanText, /深蓝风衣/);
    assert.match(visiblePlanText, /右侧铁门/);
    assert.match(visiblePlanText, /延续上一镜尾帧/);
    assert.match(visiblePlanText, /故事起点/);
    assert.match(visiblePlanText, /主角/);
    assert.match(visiblePlanText, /目标/);
    assert.doesNotMatch(visiblePlanText, /qwen3\.7|wan2\.7|happyhorse|I2V|R2V|渲染路线|供应商/i);
    assert.doesNotMatch(
      visiblePlanText,
      /短剧主角|The Data Stream|核心场景|关键物件「信」|宁静的水域|初见之时|进一步了解|最终，我们看到的，是|被威胁对象|倒计时|报警屏/,
      'the visible plan must not be overwritten by a generic short-drama template',
    );
    assert.equal(planningRequests, 2, 'double click retry must start exactly one new planning attempt');
    assert.deepEqual(
      planningAttachmentIds.map(ids => ids.length),
      [2, 2],
      'the initial plan and its idempotent retry must keep the same two project attachments',
    );
    assert.deepEqual(
      planningAttachmentIds[1],
      planningAttachmentIds[0],
      'retry must preserve project attachment identity and order',
    );
    assert.equal(providerCalls, 2, 'cancelled attempt plus one retry should be the only planning provider calls');
    assert.equal(mediaStageRequests, 0, 'planning cancel/retry must not enter reference or video stages');
    assert.equal(subjectWriteRequests, 0, 'ordinary project attachments must not be written into the reusable subject library');
    assert.equal(firstProviderClosed, true, 'browser cancellation must close the in-flight planning provider stream');

    let planningTasks: Array<{ status?: string; config?: { phase?: string } }> = [];
    await expect.poll(() => {
      const persistedTasks = JSON.parse(readFileSync(taskFile, 'utf8')) as Array<{
        status?: string;
        config?: { phase?: string };
      }>;
      planningTasks = persistedTasks.filter(task => task.config?.phase === 'plan');
      return planningTasks.filter(task => task.status === 'completed').length;
    }).toBe(1);
    assert.equal(planningTasks.filter(task => task.status === 'cancelled').length, 1);
    assert.equal(planningTasks.filter(task => task.status === 'completed').length, 1);
    const unexpectedFailures = failedResponses.filter(response => !(
      response.status === 503 && response.url.endsWith('/api/project-attachments')
    ));
    assert.deepEqual(unexpectedFailures, [], `failed responses: ${JSON.stringify(failedResponses)}`);
    const actionableErrors = errors.filter(error => !error.startsWith('Failed to load resource:'));
    assert.equal(actionableErrors.length, 0, `browser errors: ${actionableErrors.join(' | ')}`);
    await page.waitForTimeout(250);
    assert.doesNotMatch(
      appOutput.join(''),
      /Controller is already closed|ERR_INVALID_STATE|uncaughtException/,
      'cancelling the planning stream must not close or enqueue into an already closed controller',
    );
    const screenshots: string[] = [];
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(
        overflow.scrollWidth <= overflow.innerWidth + 1,
        `${viewport.width}px viewport overflow: ${JSON.stringify(overflow)}`,
      );
      const screenshotPath = path.join(outputDir, `model-driven-plan-${viewport.width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
    }

    console.log(JSON.stringify({
      ok: true,
      planningRequests,
      cancelRequests,
      providerCalls,
      mediaStageRequests,
      attachmentOrder: attachmentOrderAfterRefresh,
      attachmentRetryRequests: 1,
      subjectWriteRequests,
      visibleStoryPreserved: true,
      statuses: planningTasks.map(task => task.status),
      confirmationScreenshots,
      attachmentScreenshot,
      screenshots,
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
    rmSync(attachmentRoot, { recursive: true, force: true });
    rmSync(attachmentFixtureRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
