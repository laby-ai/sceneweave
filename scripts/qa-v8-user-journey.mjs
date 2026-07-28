import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const appPort = 5299;
const accountPort = 5298;
const providerPort = 5297;
const origin = `http://127.0.0.1:${appPort}`;
const appOrigin = `${origin}/huiying`;
const fixtureToken = 'fixture-session-token';
const accountCalls = [];
const providerCalls = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAQh7WQAAAABJRU5ErkJggg==', 'base64');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'huiying-v8-journey-'));
const outputRoot = path.join(process.cwd(), 'output', 'v8-user-journey');

function json(response, status, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length });
  response.end(bytes);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const accountServer = createServer(async (request, response) => {
  accountCalls.push({ url: request.url, authorized: request.headers.authorization === `Bearer ${fixtureToken}` });
  if (request.url === '/v1/auth/me') {
    if (request.headers.authorization !== `Bearer ${fixtureToken}`) return json(response, 401, { error: 'not_authenticated' });
    return json(response, 200, {
      tenant_id: 'tenant-fixture',
      tenant_name: 'V8 隔离团队',
      member: { id: 'member-fixture', display_name: '旅程测试员', email: 'journey@example.test', role_key: 'member', status: 'active' },
      expires_at: '2099-01-01T00:00:00.000Z',
    });
  }
  if (request.url === '/v1/auth/logout' && request.method === 'POST') return json(response, 200, { status: 'logged_out' });
  if (request.url === '/v1/auth/login' && request.method === 'POST') {
    return json(response, 200, {
      token: fixtureToken,
      expires_at: '2099-01-01T00:00:00.000Z',
      tenant_id: 'tenant-fixture',
      tenant_name: 'V8 隔离团队',
      member: { id: 'member-fixture', display_name: '旅程测试员', email: 'journey@example.test', role_key: 'member', status: 'active' },
    });
  }
  return json(response, 404, { error: 'fixture_route_not_found' });
});

const screenplay = {
  title: '雨夜信号', coreTheme: '陌生人之间的信任', style: '电影感', totalDuration: 30,
  screenplay: [
    { sceneNumber: 1, title: '站台', interior: false, location: '雨夜车站', timeOfDay: '夜', stageDirections: '女孩在雨中发现失灵信号灯。', dialogues: [{ character: '林夏', line: '还有人在吗？', direction: '抬头' }], cameraDirections: '缓慢推进', soundDesign: '雨声', transition: '切' },
    { sceneNumber: 2, title: '回声', interior: true, location: '值班室', timeOfDay: '夜', stageDirections: '旧收音机传来回应。', dialogues: [{ character: '林夏', line: '我听见你了。', direction: '靠近' }], cameraDirections: '特写', soundDesign: '电流声', transition: '叠化' },
    { sceneNumber: 3, title: '天亮', interior: false, location: '站台', timeOfDay: '晨', stageDirections: '信号恢复，第一班车进站。', dialogues: [], cameraDirections: '拉远', soundDesign: '列车声', transition: '淡出' },
  ],
  shots: [
    { id: 'shot_1', sceneId: 'scene_1', sceneNumber: 1, shotNumber: 1, shotType: '全景', cameraAngle: '平视', cameraMovement: '推进', description: '雨夜站台与独自等待的林夏。', contentEn: '[Character:black hair,brown eyes,blue coat,black trousers][Scene:blue,rainy,cinematic]', dialogue: '还有人在吗？', duration: 5, characters: ['林夏'], emotionTag: '紧张', emotionIntensity: 7 },
    { id: 'shot_2', sceneId: 'scene_2', sceneNumber: 2, shotNumber: 2, shotType: '特写', cameraAngle: '俯视', cameraMovement: '固定', description: '收音机灯光亮起。', contentEn: '[Character:black hair,brown eyes,blue coat,black trousers][Scene:amber,interior,cinematic]', dialogue: '我听见你了。', duration: 5, characters: ['林夏'], emotionTag: '希望', emotionIntensity: 6 },
    { id: 'shot_3', sceneId: 'scene_3', sceneNumber: 3, shotNumber: 3, shotType: '远景', cameraAngle: '平视', cameraMovement: '拉远', description: '晨光中的列车驶入站台。', contentEn: '[Character:black hair,brown eyes,blue coat,black trousers][Scene:golden,dawn,cinematic]', dialogue: '', duration: 5, characters: ['林夏'], emotionTag: '释然', emotionIntensity: 5 },
  ],
  narrationScript: '雨停之前，信号终于穿过黑夜。', bgmSuggestion: '克制弦乐', subtitleSuggestion: '白色底部字幕',
};

const directorPlan = {
  characterCards: [{ id: 'char_1', name: '林夏', age: '24', gender: '女', mbti: 'ISTJ', arc: '从孤立到信任', motivation: '找到回应', relationships: {}, signatureDetail: '蓝色雨衣', appearance: '黑色短发，棕色眼睛，清瘦', outfit: '蓝色雨衣，黑色长裤，白色运动鞋', consistencyRules: { mustInclude: ['蓝色雨衣'], mustExclude: ['红色外套'] } }],
  sceneCards: [{ id: 'scene_1', sceneNumber: 1, name: '雨夜站台', location: '车站', timeOfDay: '夜', interior: false, visualDescription: '冷蓝色雨夜，站台顶灯形成纵深', fiveSenses: { sight: '雨幕', hearing: '雨声' }, symbolism: '等待', mood: '悬念', keyProps: '收音机', colorPalette: '冷蓝' }],
  propCards: [{ id: 'prop_1', name: '旧收音机', category: '工具', material: '金属', color: '灰', size: '手持', significance: '连接陌生人', closeup: true, appearance: '磨损金属外壳和橙色指示灯', propEn: 'worn radio, amber indicator' }],
  consistencyConstraints: '林夏始终穿蓝色雨衣。',
};

const providerServer = createServer(async (request, response) => {
  if (request.url === '/fixture.png') {
    response.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'no-store' });
    response.end(png);
    return;
  }
  if (request.url?.endsWith('/images/generations') && request.method === 'POST') {
    await requestBody(request);
    return json(response, 200, { data: [{ url: `http://127.0.0.1:${providerPort}/fixture.png` }] });
  }
  if (request.url?.endsWith('/chat/completions') && request.method === 'POST') {
    const body = await requestBody(request);
    const system = String(body.messages?.[0]?.content || '');
    const content = system.includes('资深影视编剧')
      ? JSON.stringify(screenplay)
      : system.includes('资深导演')
        ? JSON.stringify(directorPlan)
        : system.includes('影视分镜师')
          ? JSON.stringify(screenplay.shots.map(shot => ({ id: shot.id, visualPrompt: shot.contentEn, content: shot.description, contentEn: shot.contentEn })))
          : JSON.stringify({ safe: true, result: 'fixture-complete', issues: [], enhancedText: '电影感雨夜站台，冷蓝色光线，清晰主体' });
    providerCalls.push({
      stream: Boolean(body.stream),
      kind: system.includes('资深影视编剧') ? 'screenplay' : system.includes('资深导演') ? 'director' : system.includes('影视分镜师') ? 'storyboard' : 'other',
    });
    if (body.stream) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      response.end('data: [DONE]\n\n');
      return;
    }
    return json(response, 200, { choices: [{ message: { content } }], model: body.model || 'fixture-model' });
  }
  return json(response, 404, { error: 'fixture_provider_route_not_found' });
});

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${appOrigin}/api/health`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('huiying_fixture_health_timeout');
}

function assertNoOverflow(result, label) {
  assert(result.scrollWidth <= result.clientWidth + 1, `${label} has horizontal overflow: ${result.scrollWidth}/${result.clientWidth}`);
}

async function pageLayout(page) {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
}

async function brokenImages(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  return page.locator('img').evaluateAll(images => images
    .filter(image => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0)
    .filter(image => image.complete && image.naturalWidth === 0)
    .map(image => ({ src: image.currentSrc || image.src, alt: image.alt })));
}

async function expectOne(locator, label, timeout = 15_000) {
  const first = locator.first();
  await first.waitFor({ state: 'visible', timeout }).catch(error => {
    throw new Error(`${label} was not visible: ${error.message}`);
  });
  return first;
}

async function waitForCount(locator, expected, label, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await locator.count() >= expected) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${label} expected at least ${expected}, found ${await locator.count()}`);
}

async function createSubject(page) {
  return page.evaluate(async ({ dataUrl }) => {
    const response = await fetch('/huiying/api/subjects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '林夏', type: 'character', source: 'generated', referenceUrl: dataUrl }),
    });
    return { status: response.status, body: await response.json() };
  }, { dataUrl: `data:image/png;base64,${png.toString('base64')}` });
}

await mkdir(outputRoot, { recursive: true });
await Promise.all([listen(accountServer, accountPort), listen(providerServer, providerPort)]);
let app;
let browser;
try {
  app = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production', PORT: String(appPort), HOSTNAME: '127.0.0.1', BIND_HOST: '127.0.0.1',
      NEXT_PUBLIC_BASE_PATH: '/huiying', ACCOUNT_CENTER_API_BASE: `http://127.0.0.1:${accountPort}`,
      ACCOUNT_CENTER_REQUIRE_AUTH: 'true', ACCOUNT_CENTER_TENANT_ID: 'tenant-fixture',
      YH_BYOK_ALLOW_PRIVATE_API_BASE: 'true',
      ARK_API_BASE: `http://127.0.0.1:${providerPort}/v1`, ARK_API_KEY: 'fixture-only-key',
      ARK_AGENT_MODEL: 'fixture-text', ARK_IMAGE_MODEL: 'fixture-image', ARK_VIDEO_MODEL: 'fixture-video',
      HUIYING_OBSERVABILITY_HASH_KEY: 'fixture-observability-hash-key-32-bytes',
      HUIYING_TASK_STORE_PATH: path.join(tempRoot, 'tasks.json'),
      HUIYING_SUBJECT_STORE_PATH: path.join(tempRoot, 'subjects'),
      HUIYING_FINAL_VIDEO_STORE_PATH: path.join(tempRoot, 'final-videos'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const appOutput = [];
  app.stdout.on('data', chunk => appOutput.push(String(chunk)));
  app.stderr.on('data', chunk => appOutput.push(String(chunk)));
  const health = await waitForHealth();
  assert.equal(health.runtimeReadiness.subjectStore.ready, true);
  assert.equal(health.runtimeReadiness.finalVideoStore.ready, true);

  browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  const responsive = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addCookies([{ name: 'huiying_account_token', value: fixtureToken, url: origin }]);
    await context.addInitScript(token => localStorage.setItem('account_entitlement_token', token), fixtureToken);
    const page = await context.newPage();
    const errors = [];
    const failedResponses = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
    await page.goto(`${appOrigin}/`, { waitUntil: 'networkidle' });
    const accountProbe = await page.request.get(`${appOrigin}/api/account/me`);
    assert.equal(accountProbe.status(), 200, `${viewport.name} account fixture rejected the browser session`);
    const responsiveAccount = page.getByRole('button', { name: '账号信息' });
    await responsiveAccount.waitFor({ state: 'visible', timeout: 10_000 }).catch(async error => {
      const nav = await page.locator('nav').innerText().catch(() => 'nav-unavailable');
      throw new Error(`${viewport.name} account status did not render: ${error.message}; url=${page.url()}; nav=${nav}; console=${errors.join(' | ')}; failed=${JSON.stringify(failedResponses)}; accountCalls=${JSON.stringify(accountCalls)}`);
    });
    await expectOne(responsiveAccount, `${viewport.name} account status`);
    const images = await brokenImages(page);
    assert.deepEqual(images, [], `${viewport.name} homepage has broken images`);
    assertNoOverflow(await pageLayout(page), `${viewport.name} homepage`);
    await page.screenshot({ path: path.join(outputRoot, `home-${viewport.name}.png`), fullPage: true });
    responsive.push({ viewport: viewport.name, errors: errors.length, failedResponses: failedResponses.length, brokenImages: images.length });
    assert.equal(errors.length + failedResponses.length, 0, `${viewport.name} browser failures: ${JSON.stringify({ errors, failedResponses })}`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await context.addCookies([{ name: 'huiying_account_token', value: fixtureToken, url: origin }]);
  await context.addInitScript(token => localStorage.setItem('account_entitlement_token', token), fixtureToken);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });

  await page.goto(`${appOrigin}/`, { waitUntil: 'networkidle' });
  const accountLocator = page.getByRole('button', { name: '账号信息' });
  await accountLocator.waitFor({ state: 'visible', timeout: 10_000 });
  const accountButton = await expectOne(accountLocator, 'account button');
  await accountButton.click();
  await page.getByText('旅程测试员', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible' });

  const createdSubject = await createSubject(page);
  assert.equal(createdSubject.status, 201, JSON.stringify(createdSubject.body));

  await expectOne(page.getByRole('button', { name: '生成创作' }), 'generate navigation').then(item => item.click());
  assert.equal(await page.locator('button[title="添加主体"]').count(), 0, 'creation input must not expose the internal subject registry');
  assert.equal(await page.locator('select[aria-label="参考图用途"]').count(), 0, 'creation input must not require an internal reference taxonomy');

  await expectOne(page.getByRole('button', { name: '回到绘影首页' }), 'home navigation').then(item => item.click());
  await expectOne(page.getByText('剧本分镜', { exact: true }), 'film entry').then(item => item.click());
  const storyInput = await expectOne(page.getByPlaceholder('输入剧本标题与描述，如：小红帽去森林深处看望外婆...'), 'film story input');
  await storyInput.fill('雨夜车站里，一位女孩通过旧收音机与陌生人建立联系。');
  await expectOne(page.getByRole('button', { name: '开始创作' }), 'film create button').then(item => item.click());
  await expectOne(page.getByText('剧本已完成！', { exact: false }), 'film script completion', 60_000).catch(async error => {
    const bodyText = await page.locator('body').innerText().catch(() => 'body-unavailable');
    throw new Error(`film script did not complete: ${error.message}; providerCalls=${JSON.stringify(providerCalls)}; failed=${JSON.stringify(failedResponses)}; body=${bodyText.slice(-2500)}`);
  });
  await expectOne(page.getByText('画面生成', { exact: true }), 'automatic visual phase').then(item => item.waitFor({ state: 'visible' }));
  await expectOne(page.getByRole('button', { name: '连续', exact: true }), 'sequential mode').then(item => item.click());
  await expectOne(page.getByRole('button', { name: '并行', exact: true }), 'parallel mode').then(item => item.click());
  await page.screenshot({ path: path.join(outputRoot, 'film-script-visual.png'), fullPage: true });

  await page.goto(`${appOrigin}/`, { waitUntil: 'networkidle' });
  await expectOne(page.getByRole('button', { name: '生成创作' }), 'generate navigation after film').then(item => item.click());
  await expectOne(page.getByRole('button', { name: 'Agent 模式' }), 'creation mode menu').then(item => item.click());
  await expectOne(page.getByRole('button', { name: '图片生成' }), 'image mode').then(item => item.click());
  const imagePrompt = await expectOne(page.getByPlaceholder('描述你想生成的图片，也可直接粘贴图片…'), 'image prompt textarea');
  await imagePrompt.fill('雨夜站台上的蓝色雨衣女孩，电影感冷蓝色灯光');
  await expectOne(page.getByRole('button', { name: '生成图片' }), 'generate image button').then(item => item.click());
  await page.locator(`img[src="http://127.0.0.1:${providerPort}/fixture.png"]`).waitFor({ state: 'visible', timeout: 60_000 });
  assert.deepEqual(await brokenImages(page), [], 'generated image failed to decode');

  await page.goto(`${appOrigin}/canvas?mode=new`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/huiying\/canvas\/[^/?]+/);
  const nodes = page.locator('[data-node-id]');
  const textTool = await expectOne(page.getByRole('button', { name: '文本', exact: true }), 'canvas text toolbar');
  await textTool.click();
  await waitForCount(nodes, 1, 'first canvas text node');
  await textTool.click();
  await waitForCount(nodes, 2, 'second canvas text node');
  const sourceBox = await nodes.nth(0).boundingBox();
  const targetBox = await nodes.nth(1).boundingBox();
  assert(sourceBox && targetBox, 'canvas nodes are not measurable');
  await page.mouse.move(sourceBox.x + sourceBox.width + 12, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x - 12, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
  assert((await page.locator('[data-connection-id]').count()) >= 1, 'canvas connection did not render');
  await expectOne(page.getByRole('button', { name: 'Agent', exact: true }), 'canvas agent panel').then(item => item.click());
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.locator('[data-node-id]').count()) >= 2, 'canvas nodes did not survive refresh');
  assertNoOverflow(await pageLayout(page), 'desktop canvas');
  await page.screenshot({ path: path.join(outputRoot, 'canvas-nodes.png'), fullPage: true });

  const ownerSubject = createdSubject.body.subject;
  const ownerImage = await page.request.get(`${origin}${ownerSubject.imageUrl}`);
  assert.equal(ownerImage.status(), 200);
  assert.match(ownerImage.headers()['content-type'] || '', /^image\//);
  const anonymous = await playwrightRequest(`${origin}${ownerSubject.imageUrl}`);
  assert.equal(anonymous.status, 401);
  const deleted = await page.evaluate(async id => {
    const response = await fetch(`/huiying/api/subjects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return response.status;
  }, ownerSubject.id);
  assert.equal(deleted, 200);

  assert.deepEqual(consoleErrors, [], `desktop interaction console errors: ${consoleErrors.join(' | ')}`);
  assert.deepEqual(failedResponses, [], `desktop interaction failed responses: ${JSON.stringify(failedResponses)}`);
  await context.close();

  console.log(JSON.stringify({
    ok: true,
    responsive,
    checked: [
      'authenticated account status and menu',
      'homepage image decode and responsive overflow',
      'subject create, menu selection, private image and delete',
      'film prompt to script to automatic visual phase',
      'sequential and parallel mode controls',
      'image generation with decoded provider bytes',
      'canvas open, two text nodes, connection attempt, agent tab and refresh persistence',
    ],
    usedProductionAccount: false,
    usedPaidProvider: false,
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (app && !app.killed) app.kill('SIGTERM');
  accountServer.closeAllConnections();
  providerServer.closeAllConnections();
  await Promise.allSettled([
    new Promise(resolve => accountServer.close(resolve)),
    new Promise(resolve => providerServer.close(resolve)),
  ]);
  await rm(tempRoot, { recursive: true, force: true });
}

async function playwrightRequest(url) {
  const response = await fetch(url);
  return { status: response.status };
}
