import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, expect } from '@playwright/test';
import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
  confirmVimaxProductionExternalCost,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';

const appPort = 5412;
const appOrigin = `http://127.0.0.1:${appPort}/huiying`;
const workspaceKey = 'guest-reference-recovery-20260727';
const taskFile = path.join(tmpdir(), `sceneweave-reference-recovery-${Date.now()}.json`);
const screenshotPath = path.join(process.cwd(), 'outputs', 'reference-recovery-browser.png');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const fixturePlan = JSON.stringify({
  title: '雨夜天台的胶片',
  summary: '记者在同一雨夜天台拾起发光胶片，并沿蓝光继续追踪。',
  story: {
    premise: '发光胶片指向被掩盖的记录。',
    protagonist: '穿深蓝风衣的年轻记者',
    desire: '在天亮前找到记录源头',
    obstacle: '暴雨和逐渐熄灭的胶片',
    conflict: '她必须在保全证据和继续追踪之间选择',
    turningPoint: '胶片投出通往楼梯间的蓝光',
    endingHook: '门后传来旧放映机转动声',
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
    description: '冷蓝霓虹、湿地反光和右侧铁门',
    timeOfDay: 'night',
    continuityAnchors: ['冷蓝主光', '雨势连续', '铁门在右侧'],
  }],
  props: [{
    id: 'film',
    label: '发光胶片',
    description: '掌心大小，边缘发蓝光',
    state: '持续发光',
  }],
  assets: [
    { kind: 'character', label: '年轻记者', prompt: '湿发、深蓝风衣、右手握发光胶片' },
    { kind: 'scene', label: '雨夜天台', prompt: '冷蓝霓虹、湿地反光、右侧铁门' },
    { kind: 'prop', label: '发光胶片', prompt: '掌心大小、透明、边缘蓝光' },
  ],
  shots: [
    {
      index: 1,
      title: '拾起胶片',
      duration: 5,
      camera: '中景缓慢推进',
      prompt: '记者在雨夜天台弯腰拾起发光胶片。',
      sceneId: 'rooftop',
      characterIds: ['reporter'],
      propIds: ['film'],
      actionStart: '记者弯腰伸手',
      actionEnd: '记者站直看向右侧铁门',
      firstFrameDescription: '胶片位于积水中',
      lastFrameDescription: '记者右手持胶片，视线朝右',
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
      prompt: '延续上一镜尾帧，记者握着胶片向右侧铁门快步走去。',
      sceneId: 'rooftop',
      characterIds: ['reporter'],
      propIds: ['film'],
      actionStart: '记者站直看向右侧',
      actionEnd: '记者抵达铁门并抬起左手',
      firstFrameDescription: '复用上一镜尾帧',
      lastFrameDescription: '记者左手停在门把前',
      motionDescription: '向右快步行走',
      spatialRelation: 'same-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      conflictFlags: [],
    },
  ],
  nextAction: '确认分镜后生成参考图。',
});
const fixtureBasePlan = JSON.parse(fixturePlan) as VimaxAgentPlan;
const fixtureArtifacts = buildProductionBackedVimaxPlan(
  '10秒短剧：记者在雨夜天台拾起发光胶片，两个连续镜头。',
  fixtureBasePlan,
  {
    duration: 10,
    segmentDuration: 5,
    segmentCount: 2,
    ratio: '16:9',
    resolution: '720p',
    style: '电影感短剧',
    skillId: 'short-drama',
  },
  'fixture-parent-plan',
);
const fixturePlanObject = fixtureArtifacts.plan;
let fixtureProductionPlan = buildVimaxProductionPlan({
  title: fixturePlanObject.title,
  ratio: '16:9',
  resolution: '720p',
  planModel: 'qwen3.7-plus-fixture',
  imageModel: 'wan2.7-image-pro-fixture',
  videoModel: 'happyhorse-1.1-i2v',
  providerReadiness: { plan: true, referenceAssets: true, video: true },
  referenceAssetsRequired: true,
  assets: fixturePlanObject.assets,
  shots: fixturePlanObject.shots,
});

async function stop(process: ChildProcess | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!process.killed) process.kill('SIGKILL');
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${appOrigin}/api/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('reference_recovery_fixture_health_timeout');
}

async function main() {
  let app: ChildProcess | undefined;
  const appOutput: string[] = [];
  const browser = await chromium.launch({ headless: true });
  let page: import('@playwright/test').Page | undefined;
  let planningSubmits = 0;
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
      localStorage.setItem('account_entitlement_token', 'reference-recovery-fixture-token');
    });
    page = await context.newPage();
    await page.route('**/api/account/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenant_id: 'paper-host-guest',
        tenant_name: '参考图恢复测试空间',
        member: {
          id: 'reference-recovery-fixture',
          display_name: '参考图恢复测试员',
          email: 'reference@example.test',
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
    await page.route('**/api/project-attachments**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, attachments: [] }),
    }));

    let referenceSubmits = 0;
    let cancelRequests = 0;
    let secondTaskCompleted = false;
    const referenceStatus = new Map<string, 'running' | 'cancelled' | 'completed'>();
    const referenceResult = {
      model: 'wan2.7-image-pro-fixture',
      assets: [
        { kind: 'shot', label: 'Clip 1 · 拾起胶片', prompt: '拾起胶片', url: pixel, shotIndex: 1, status: 'generated' },
        { kind: 'shot', label: 'Clip 2 · 追随蓝光', prompt: '追随蓝光', url: pixel, shotIndex: 2, status: 'generated' },
      ],
      subjectRegistry: { version: 'sceneweave-subject-reference-registry-v1', subjects: [] },
      complete: true,
      failedShotIndices: [],
    };

    await page.route('**/api/smart/vimax-agent-step', async route => {
      const body = route.request().postDataJSON() as { phase?: string } | null;
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      if (body?.phase === 'planning_readiness') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ready: true }),
        });
        return;
      }
      if (body?.phase === 'plan') {
        planningSubmits += 1;
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: [
            `event: plan.accepted\ndata: ${JSON.stringify({ taskId: 'fixture-parent-plan' })}`,
            `event: plan.complete\ndata: ${JSON.stringify({
              success: true,
              phase: 'plan',
              model: 'qwen3.7-plus-fixture',
              taskId: 'fixture-parent-plan',
              plan: fixturePlanObject,
              productionPlan: fixtureProductionPlan,
            })}`,
            '',
          ].join('\n\n'),
        });
        return;
      }
      if (body?.phase !== 'reference_assets') {
        await route.continue();
        return;
      }
      referenceSubmits += 1;
      const taskId = `reference-child-${referenceSubmits}`;
      referenceStatus.set(taskId, 'running');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accepted: true,
          phase: 'reference_assets',
          taskId: 'parent-plan-task',
          backgroundTaskId: taskId,
          usedRealKey: true,
          incurredCost: true,
        }),
      });
    });

    await page.route('**/api/tasks/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/tasks/fixture-parent-plan')) {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON() as { action?: string } | null;
          fixtureProductionPlan = body?.action === 'approve-production-plan'
            ? approveVimaxProductionPlan(fixtureProductionPlan)
            : body?.action === 'confirm-production-external'
              ? confirmVimaxProductionExternalCost(fixtureProductionPlan)
              : fixtureProductionPlan;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, productionPlan: fixtureProductionPlan }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            task: {
              id: 'fixture-parent-plan',
              status: 'completed',
              config: { prompt: '雨夜天台的胶片' },
              result: {
                vimaxPlan: fixturePlanObject,
                productionPlan: fixtureProductionPlan,
                productionProject: fixtureArtifacts.productionProject,
                assemblyPlan: fixtureArtifacts.assemblyPlan,
                ...(referenceSubmits >= 2 ? { vimaxReferenceTaskId: 'reference-child-2' } : {}),
              },
            },
          }),
        });
        return;
      }
      const match = url.pathname.match(/\/api\/tasks\/(reference-child-\d+)(?:\/events)?$/);
      if (!match) {
        await route.continue();
        return;
      }
      const taskId = match[1];
      if (route.request().method() === 'DELETE') {
        cancelRequests += 1;
        referenceStatus.set(taskId, 'cancelled');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, task: { id: taskId, status: 'cancelled' } }),
        });
        return;
      }
      const completed = taskId === 'reference-child-2' && secondTaskCompleted;
      if (url.pathname.endsWith('/events')) {
        await new Promise(resolve => setTimeout(resolve, completed ? 20 : 250));
        const status = completed ? 'completed' : referenceStatus.get(taskId) || 'running';
        const event = completed ? 'done' : 'task';
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `id: 1\nevent: ${event}\ndata: ${JSON.stringify({
            task: {
              id: taskId,
              status,
              progress: completed ? 100 : 35,
              stage: completed ? '已完成' : '参考图生成中',
              message: completed ? '参考图可用' : '已完成的参考图会保留',
            },
          })}\n\n`,
        }).catch(() => undefined);
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          task: completed
            ? { id: taskId, status: 'completed', progress: 100, result: { vimaxReferenceResult: referenceResult } }
            : { id: taskId, status: referenceStatus.get(taskId) || 'running', progress: 35 },
        }),
      });
    });

    const errors: string[] = [];
    const failedResponses: Array<{ status: number; url: string }> = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    });

    await page.goto(`${appOrigin}/embed/creation-agent?embed=creation-agent&workspaceKey=${workspaceKey}`, {
      waitUntil: 'domcontentloaded',
    });
    const input = page.getByPlaceholder(/写下故事、粘贴剧本，或上传参考素材/);
    await input.fill('10秒短剧：记者在雨夜天台拾起发光胶片，两个连续镜头。');
    await input.press('Enter');
    await page.getByRole('button', { name: '确认制作计划' }).click();
    await page.getByRole('button', { name: '确认按供应商账单生成' }).click();
    await page.getByRole('button', { name: '确认分镜，生成参考图' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: '确认分镜，生成参考图' }).click();
    await expect.poll(() => referenceSubmits).toBe(1);
    await page.getByText(/已完成的参考图会保留/).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: '停止生成' }).click();
    await page.getByText(/已取消本次参考图生成/).waitFor({ timeout: 10_000 });
    await expect.poll(() => cancelRequests).toBe(1);

    await page.getByRole('button', { name: '仅重试缺失参考图' }).click();
    await expect.poll(() => referenceSubmits).toBe(2);
    await page.getByText(/已完成的参考图会保留/).waitFor({ timeout: 10_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '继续查看参考图' }).waitFor({ timeout: 15_000 });
    secondTaskCompleted = true;
    await page.getByRole('button', { name: '继续查看参考图' }).click();
    await page.getByText(/已生成 0 张角色定妆参考和 2 张分镜参考图/).waitFor({ timeout: 15_000 });

    assert.equal(referenceSubmits, 2, 'refresh recovery must poll the same task without a third submit');
    assert.equal(cancelRequests, 1, 'one cancel click must issue one server cancellation');
    assert.equal(errors.length, 0, `browser errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedResponses, [], `failed responses: ${JSON.stringify(failedResponses)}`);

    mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(JSON.stringify({
      ok: true,
      referenceSubmits,
      cancelRequests,
      recoveredSameTask: true,
      providerCalls: 0,
      incurredCost: false,
      screenshotPath,
    }));
    await context.close();
  } catch (error) {
    if (appOutput.length) console.error(appOutput.join(''));
    if (page) {
      console.error(JSON.stringify({
        planningSubmits,
        url: page.url(),
        body: (await page.locator('body').innerText().catch(() => '')).slice(0, 4_000),
      }));
    }
    throw error;
  } finally {
    await browser.close();
    await stop(app);
    rmSync(taskFile, { force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
