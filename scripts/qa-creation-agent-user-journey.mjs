import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const appPort = 5399;
const accountPort = 5398;
const origin = `http://127.0.0.1:${appPort}`;
const appOrigin = `${origin}/huiying`;
const fixtureToken = 'fixture-session-token';
const fixtureKey = ['fixture', 'browser', 'only'].join('-');
const outputRoot = path.join(process.cwd(), 'output', 'creation-agent-user-journey');
let profile = null;
const accountCalls = [];
const appOutput = [];

function json(response, status, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.length,
  });
  response.end(bytes);
}

function publicProfile() {
  return profile ? {
    configured: true,
    provider_id: 'aliyun-bailian',
    region: 'cn-beijing',
    secret_mask: '****only',
    text_model: 'qwen3.7-plus',
    image_model: 'wan2.7-image-pro',
    tts_model: 'qwen-audio-3.0-tts-plus',
  } : {
    configured: false,
    text_model: 'qwen3.7-plus',
    image_model: 'wan2.7-image-pro',
    tts_model: 'qwen-audio-3.0-tts-plus',
  };
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const accountServer = createServer(async (request, response) => {
  const authorized = request.headers.authorization === `Bearer ${fixtureToken}`;
  accountCalls.push({ method: request.method, url: request.url, authorized });
  if (request.url === '/v1/auth/me') {
    if (!authorized) return json(response, 401, { error: 'not_authenticated' });
    return json(response, 200, {
      tenant_id: 'tenant-fixture',
      tenant_name: '隔离测试团队',
      member: {
        id: 'member-fixture',
        display_name: '创作测试员',
        email: 'creator@example.test',
        role_key: 'member',
        status: 'active',
      },
      expires_at: '2099-01-01T00:00:00.000Z',
    });
  }
  if (request.url === '/v1/me/provider-key-profile') {
    if (!authorized) return json(response, 401, { error: 'not_authenticated' });
    if (request.method === 'GET') return json(response, 200, { profile: publicProfile() });
    if (request.method === 'PUT') {
      const body = await requestBody(request);
      assert.equal(body.api_key, fixtureKey);
      assert.equal('workspace_id' in body, false);
      profile = { api_key: body.api_key };
      return json(response, 200, { profile: publicProfile() });
    }
    if (request.method === 'DELETE') {
      profile = null;
      return json(response, 200, { profile: publicProfile() });
    }
  }
  if (request.url === '/v1/internal/provider-key-profile/resolve' && request.method === 'POST') {
    if (!profile) return json(response, 404, { error: 'provider_profile_not_configured' });
    return json(response, 200, {
      provider_id: 'aliyun-bailian',
      workspace_id: '',
      region: 'cn-beijing',
      api_key: profile.api_key,
    });
  }
  return json(response, 404, { error: 'fixture_route_not_found' });
});

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
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
  throw new Error('creation_agent_fixture_health_timeout');
}

async function assertDarkAndContained(page, viewport) {
  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-creation-agent-theme="dark"]');
    if (!(shell instanceof HTMLElement)) throw new Error('dark creation shell missing');
    return {
      shellBackground: getComputedStyle(shell).backgroundColor,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      legacyHomeVisible: document.body.innerText.includes('剧本分镜'),
      canvasEntryVisible: document.body.innerText.includes('无限画布'),
    };
  });
  assert.match(metrics.shellBackground, /^rgb\((?:7, 9, 15|11, 14, 20)\)$/);
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${viewport} horizontal overflow`);
  assert.equal(metrics.legacyHomeVisible, false, `${viewport} exposed the legacy home`);
  assert.equal(metrics.canvasEntryVisible, false, `${viewport} exposed the legacy canvas`);
}

await mkdir(outputRoot, { recursive: true });
await listen(accountServer, accountPort);
let app;
let browser;
try {
  app = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(appPort),
      HOSTNAME: '127.0.0.1',
      BIND_HOST: '127.0.0.1',
      NEXT_PUBLIC_BASE_PATH: '/huiying',
      ACCOUNT_CENTER_API_BASE: `http://127.0.0.1:${accountPort}`,
      ACCOUNT_CENTER_REQUIRE_AUTH: 'true',
      ACCOUNT_CENTER_APP_KEY: 'huiying',
      ACCOUNT_CENTER_CREDENTIAL_KEY: 'fixture-credential',
      ACCOUNT_CENTER_CLIENT_SECRET: 'fixture-client-secret',
      HUIYING_OBSERVABILITY_HASH_KEY: 'fixture-observability-hash-key-32-bytes',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.stdout.on('data', chunk => appOutput.push(String(chunk)));
  app.stderr.on('data', chunk => appOutput.push(String(chunk)));
  await waitForHealth();

  const normalizedRoot = await fetch(`${appOrigin}/`, { redirect: 'manual' });
  assert.equal(normalizedRoot.status, 308);
  assert.match(normalizedRoot.headers.get('location') || '', /\/huiying$/);
  const creationRedirect = await fetch(appOrigin, { redirect: 'manual' });
  assert.equal(creationRedirect.status, 307);
  assert.match(creationRedirect.headers.get('location') || '', /\/huiying\/embed\/creation-agent$/);

  browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  const results = [];
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

    await page.goto(`${appOrigin}/embed/creation-agent`, { waitUntil: 'commit' });
    assert.match(page.url(), /\/huiying\/embed\/creation-agent$/);
    await page.locator('[data-testid="vimax-project-home"]').waitFor({ state: 'visible' });
    await assertDarkAndContained(page, viewport.name);
    assert.equal(await page.getByRole('button', { name: 'Agent 模式' }).count(), 0, 'agent-only mode must not open legacy choices');

    const header = page.locator('header');
    await header.getByRole('img', { name: '绘影' }).waitFor({ state: 'visible' });
    await header.getByRole('button', { name: '账号信息' }).waitFor({ state: 'visible' });
    const hero = page.locator('[data-testid="creation-agent-hero"]');
    await hero.waitFor({ state: 'visible' });
    await page.locator('[data-testid="creation-agent-brand-mark"]').waitFor({ state: 'visible' });
    const heroBox = await page.locator('[data-testid="creation-agent-hero"]').boundingBox();
    assert(heroBox && heroBox.height >= (viewport.width <= 640 ? 140 : 200), `${viewport.name} hero is too small`);

    const settings = page.getByRole('button', { name: '百炼模型设置' });
    assert.equal(await settings.count(), 1, `${viewport.name} duplicated Bailian settings`);
    assert.equal(await header.getByRole('button', { name: '百炼模型设置' }).count(), 1, `${viewport.name} settings are not in the global header`);
    await settings.waitFor({ state: 'visible' });
    if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click();
    assert.equal(await page.getByLabel('API Base').count(), 0);
    await page.getByLabel('API Key').fill(fixtureKey);
    assert.equal(await page.getByLabel('业务空间 ID').count(), 0);
    await page.getByRole('button', { name: '保存到当前账号' }).click();
    await page.getByText('已保存到当前账号。', { exact: false }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '关闭模型设置' }).click();
    await page.getByText('百炼已配置', { exact: true }).waitFor({ state: 'visible' });

    const accountButton = header.getByRole('button', { name: '账号信息' });
    await accountButton.click();
    await page.getByText('creator@example.test', { exact: true }).waitFor({ state: 'visible' });
    await page.getByText('所属团队：隔离测试团队', { exact: true }).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByText('creator@example.test', { exact: true }).waitFor({ state: 'hidden' });

    await page.screenshot({ path: path.join(outputRoot, `${viewport.name}-home.png`), fullPage: true });

    await page.getByTitle('使用技能').click();
    await page.getByPlaceholder('搜索短剧、电商、分镜…').fill('电商');
    await page.getByRole('button', { name: '电商商品片 商品卖点、使用场景与转化镜头', exact: true }).click();
    assert.match(await page.getByPlaceholder(/输入想法、剧本或上传参考/).inputValue(), /商品/);
    await page.getByTitle('画面比例与清晰度').click();
    await page.getByRole('button', { name: '9:16', exact: true }).click();
    await page.getByRole('button', { name: '超清', exact: true }).click();
    await page.getByRole('button', { name: '创建第一个项目' }).click();
    await page.getByRole('button', { name: '返回项目' }).waitFor({ state: 'visible' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '返回项目' }).waitFor({ state: 'visible' });

    await page.getByRole('button', { name: '返回项目' }).click();
    const recentProjects = page.locator('[data-testid="vimax-recent-projects"]');
    await recentProjects.waitFor({ state: 'visible' });
    let projectCard = recentProjects.locator('article').first();
    await projectCard.waitFor({ state: 'visible' });
    assert.equal(await recentProjects.locator('article').count(), 1, `${viewport.name} did not persist the first project`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await recentProjects.waitFor({ state: 'visible' });
    projectCard = recentProjects.locator('article').first();
    await projectCard.waitFor({ state: 'visible' });
    const openProjectButton = projectCard.locator('button').first();
    await openProjectButton.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '返回项目' }).waitFor({ state: 'visible' });

    await page.getByRole('button', { name: '返回项目' }).click();
    projectCard = recentProjects.locator('article').first();
    const manageProjectButton = projectCard.getByRole('button', { name: /^管理项目 / });
    await manageProjectButton.click();
    await projectCard.getByRole('button', { name: '删除项目' }).click();
    await projectCard.getByRole('button', { name: '确认删除' }).click();
    await page.getByRole('button', { name: '创建第一个项目' }).waitFor({ state: 'visible' });
    assert.equal(await recentProjects.locator('article').count(), 0, `${viewport.name} kept the deleted project`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '创建第一个项目' }).waitFor({ state: 'visible' });

    const leaked = await page.evaluate(secret => ({
      body: document.body.innerText.includes(secret),
      local: Object.values(localStorage).some(value => String(value).includes(secret)),
      session: Object.values(sessionStorage).some(value => String(value).includes(secret)),
    }), fixtureKey);
    assert.deepEqual(leaked, { body: false, local: false, session: false });
    assert.deepEqual(errors, [], `${viewport.name} console errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedResponses, [], `${viewport.name} failed responses: ${JSON.stringify(failedResponses)}`);
    await page.screenshot({ path: path.join(outputRoot, `${viewport.name}-project.png`), fullPage: true });
    results.push({
      viewport: viewport.name,
      dark: true,
      overflow: false,
      accountVisible: true,
      heroVisible: true,
      heroBounds: { y: Math.round(heroBox.y), height: Math.round(heroBox.height) },
      profileSaved: true,
      projectRecovered: true,
      projectReopenedWithKeyboard: true,
      projectDeletionPersisted: true,
    });
    await context.close();
  }

  assert(accountCalls.some(call => call.method === 'PUT' && call.url === '/v1/me/provider-key-profile'));
  console.log(JSON.stringify({ ok: true, results, usedProductionAccount: false, usedPaidProvider: false }, null, 2));
} catch (error) {
  console.error(appOutput.join(''));
  throw error;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (app && !app.killed) app.kill('SIGTERM');
  accountServer.close();
}
