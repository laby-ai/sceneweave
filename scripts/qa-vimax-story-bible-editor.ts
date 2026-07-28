import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

import type { ProductionProject } from '../src/lib/production-project';

const port = 5397;
const accountPort = 5396;
const origin = `http://127.0.0.1:${port}`;
const appOrigin = `${origin}/huiying`;
const fixtureToken = 'story-bible-fixture-session';
const otherFixtureToken = 'story-bible-other-member-session';
const taskFile = path.join(tmpdir(), `sceneweave-story-bible-browser-${randomUUID()}.json`);
const attachmentRoot = path.join(tmpdir(), `sceneweave-story-bible-attachments-${randomUUID()}`);
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.HUIYING_PROJECT_ATTACHMENT_STORE_PATH = attachmentRoot;

function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.length,
  });
  response.end(bytes);
}

const accountServer = createServer((request, response) => {
  const token = request.headers.authorization;
  if (![fixtureToken, otherFixtureToken].some(value => token === `Bearer ${value}`)) {
    return json(response, 401, { error: 'not_authenticated' });
  }
  const isOtherMember = token === `Bearer ${otherFixtureToken}`;
  if (request.url === '/v1/auth/me') {
    return json(response, 200, {
      tenant_id: 'tenant-fixture',
      tenant_name: '故事编辑测试团队',
      member: {
        id: isOtherMember ? 'member-other' : 'member-fixture',
        display_name: isOtherMember ? '其他成员' : '故事编辑测试员',
        email: isOtherMember ? 'other@example.test' : 'story-editor@example.test',
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
  const { buildProductionAssemblyPlan } = await import('../src/lib/production-assembly-plan');
  const { createTask, getTaskForOwner, updateTask } = await import('../src/lib/task-manager');
  const { updateVimaxStoryBibleForTask } = await import('../src/lib/skills/vimax-short-drama/vimax-story-bible-editor');
  const { recoverVimaxTaskProject } = await import('../src/lib/skills/vimax-short-drama/vimax-task-project-recovery');
  const { createProjectAttachment } = await import('../src/lib/project-attachments/project-attachment-store');

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
  const privateReference = await createProjectAttachment(attachmentRoot, owner, {
    projectId: taskId,
    name: 'private-shot-reference.jpg',
    kind: 'image',
    mimeType: 'image/jpeg',
    content: readFileSync(path.join(process.cwd(), 'public', 'samples', 'cyber-city.jpg')),
    extension: 'jpg',
  });
  const privateReferenceUrl = `/huiying/api/project-attachments/${privateReference.id}?projectId=${encodeURIComponent(taskId)}`;
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
  const generatedVideoSegmentId = 'video-segment-stale-1';
  const generatedFinalVideoId = 'final-video-stale-1';
  const productionProject = {
    ...built.productionProject,
    assets: [
      ...built.productionProject.assets,
      {
        id: generatedVideoSegmentId,
        kind: 'videoSegment' as const,
        name: '旧镜头 1',
        status: 'completed' as const,
        summary: '旧故事生成的视频片段',
        source: 'task' as const,
      },
      {
        id: generatedFinalVideoId,
        kind: 'finalVideo' as const,
        name: '旧版成片',
        status: 'completed' as const,
        summary: '旧故事生成的完整成片',
        source: 'task' as const,
      },
    ],
    stages: built.productionProject.stages.map(stage =>
      ['assembly', 'delivery'].includes(stage.id)
        ? {
            ...stage,
            status: 'completed' as const,
            assetIds: [...stage.assetIds, generatedVideoSegmentId, generatedFinalVideoId],
          }
        : stage),
    graph: {
      nodes: [
        ...built.productionProject.graph.nodes,
        { id: generatedVideoSegmentId, kind: 'videoSegment' as const, name: '旧镜头 1', status: 'completed' as const },
        { id: generatedFinalVideoId, kind: 'finalVideo' as const, name: '旧版成片', status: 'completed' as const },
      ],
      edges: [
        ...built.productionProject.graph.edges,
        { from: generatedVideoSegmentId, to: generatedFinalVideoId, relation: 'feeds' as const },
      ],
    },
    storyboard: {
      ...built.productionProject.storyboard,
      shots: built.productionProject.storyboard.shots.map(shot => ({ ...shot, status: 'completed' as const })),
    },
    output: {
      ...built.productionProject.output,
      status: 'completed' as const,
      canProceedToVideo: true,
      nextStep: '旧成片已交付',
    },
  };
  updateTask(taskId, {
    status: 'completed',
    progress: 100,
    result: {
      ...built,
      productionProject,
      vimaxPlan: plan,
      productionPlan,
      vimaxReferenceAssets: [
        { shotIndex: 1, url: '/huiying/brand/huiying-logo-icon.png' },
      ],
      vimaxReferenceTaskId: 'old-reference-task',
      vimaxVideoResult: {
        segments: [{ shotIndex: 1, status: 'completed' }],
      },
      vimaxVideoTaskId: 'old-video-task',
      vimaxVideoTaskStatus: 'completed',
      vimaxHappyHorseSegments: [{ shotIndex: 1, status: 'completed' }],
      assemblyQueue: {
        version: 'vimax-assembly-queue-v1',
        sourceTaskId: taskId,
        status: 'completed',
        queuedSegmentCount: 0,
        childTaskIds: ['old-video-task'],
        updatedAt: new Date().toISOString(),
      },
      videoUrl: '',
      imageUrls: ['/huiying/brand/huiying-logo-icon.png'],
      segments: [{ index: 1, status: 'completed' }],
      isPartial: false,
      failedSegments: [],
      failedSegmentsDetails: [],
      successSegmentCount: 1,
      segmentCount: 1,
    },
  });
  const initialInvalidation = updateVimaxStoryBibleForTask({
    taskId,
    owner,
    patch: { premise: '记者必须在末班车离站前找回录音证据。' },
  });
  assert.deepEqual(initialInvalidation.invalidation, {
    referenceAssets: 1,
    videoSegments: 1,
    finalVideos: 1,
    nextStage: 'reference_assets',
  });
  const invalidatedTask = getTaskForOwner(taskId, owner);
  assert(invalidatedTask?.result);
  for (const staleField of [
    'vimaxReferenceAssets',
    'vimaxReferenceTaskId',
    'vimaxVideoResult',
    'vimaxVideoTaskId',
    'vimaxVideoTaskStatus',
    'vimaxHappyHorseSegments',
    'assemblyQueue',
    'videoUrl',
    'imageUrls',
    'segments',
  ]) {
    assert.equal(staleField in invalidatedTask.result, false, `characterization retained ${staleField}`);
  }
  updateTask(taskId, {
    result: {
      ...invalidatedTask.result,
      vimaxReferenceAssets: [
        { shotIndex: 1, url: '/huiying/samples/cyber-city.jpg' },
        { shotIndex: 2, url: '/huiying/samples/red-hood.jpg' },
      ],
    },
  });
  const seededTask = getTaskForOwner(taskId, owner);
  const seededRecovery = recoverVimaxTaskProject(seededTask);
  assert.equal(seededRecovery?.messages[1]?.generationStatus, 'completed');
  assert.equal(seededRecovery?.messages[1]?.vimaxAgent?.phase, 'reference_assets');

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
        HUIYING_PROJECT_ATTACHMENT_STORE_PATH: attachmentRoot,
        HUIYING_OBSERVABILITY_HASH_KEY: 'fixture-observability-hash-key-32-bytes',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    app.stdout?.on('data', chunk => appOutput.push(String(chunk)));
    app.stderr?.on('data', chunk => appOutput.push(String(chunk)));
    await waitForHealth();

    const viewports = [
      { name: 'desktop', width: 1280, height: 900 },
      { name: 'tablet', width: 768, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ];
    const results = [];
    const context = await browser.newContext({ viewport: viewports[0] });
    await context.addCookies([{ name: 'huiying_account_token', value: fixtureToken, url: origin }]);
    await context.addInitScript(token => localStorage.setItem('account_entitlement_token', token), fixtureToken);
    const page = await context.newPage();
    const errors: string[] = [];
    const failedResponses: Array<{ status: number; url: string }> = [];
    let providerRequests = 0;
    let protectedImageRequests = 0;
    let protectedImageRequestsWithAuth = 0;
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    });
    page.on('request', request => {
      if (/\/api\/(?:image\/generate|video\/generate|smart\/vimax-agent-step)/.test(request.url())) providerRequests += 1;
      if (request.url().includes(`/api/project-attachments/${privateReference.id}`)) {
        protectedImageRequests += 1;
        if (request.headers().authorization === `Bearer ${fixtureToken}`) {
          protectedImageRequestsWithAuth += 1;
        }
      }
    });

    const url = `${appOrigin}/embed/creation-agent?taskId=${taskId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const editor = page.getByTestId('creation-project-editor');
    await editor.waitFor({ state: 'visible', timeout: 15_000 });

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const premise = `记者必须在末班车离站前找回录音证据（${viewport.name}）`;
      await page.getByLabel('故事前提').fill(premise);
      await page.getByLabel('连续性规则').fill('蓝色风衣保持不变\n录音笔始终在主角左手');
      const saveResponsePromise = page.waitForResponse(response =>
        response.request().method() === 'POST' && response.url().endsWith(`/api/tasks/${taskId}`));
      await page.getByRole('button', { name: '保存故事', exact: true }).click();
      const saveResponse = await saveResponsePromise;
      if (!saveResponse.ok()) {
        throw new Error(`story_save_${saveResponse.status()}:${await saveResponse.text()}`);
      }
      const notice = page.getByTestId('story-invalidation-notice');
      await notice.waitFor({ state: 'visible', timeout: 10_000 });
      assert.match(await notice.textContent() || '', /故事已更新/);
      assert.equal(await page.getByLabel('故事前提').inputValue(), premise);

      const persistedResponse = await fetch(`${appOrigin}/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${fixtureToken}` },
      });
      assert.equal(persistedResponse.status, 200);
      const persistedPayload = await persistedResponse.json() as {
        task?: { result?: Record<string, unknown> };
      };
      const persistedResult = persistedPayload.task?.result || {};
      for (const staleField of [
        'vimaxReferenceAssets',
        'vimaxReferenceTaskId',
        'vimaxVideoResult',
        'vimaxVideoTaskId',
        'vimaxVideoTaskStatus',
        'vimaxHappyHorseSegments',
        'assemblyQueue',
        'videoUrl',
        'imageUrls',
        'segments',
      ]) {
        assert.equal(staleField in persistedResult, false, `${viewport.name} retained ${staleField}`);
      }
      const persistedProject = persistedResult.productionProject as ProductionProject;
      assert.equal(persistedProject.assets.some(asset => ['videoSegment', 'finalVideo'].includes(asset.kind)), false);
      assert.equal(persistedProject.storyboard.shots.every(shot => shot.status === 'planned'), true);
      assert.equal(persistedProject.stages
        .filter(stage => ['assembly', 'delivery'].includes(stage.id))
        .every(stage => stage.status === 'pending'), true);
      assert.equal(persistedProject.output.status, 'pending');
      assert.equal(persistedProject.output.canProceedToVideo, false);

      await page.screenshot({
        path: path.join(process.cwd(), 'outputs', `story-bible-invalidation-${viewport.name}.png`),
        fullPage: true,
      });
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${viewport.name} horizontal overflow`);
      results.push({
        viewport: viewport.name,
        saved: true,
        staleMediaRemoved: true,
        refreshed: false,
        overflow: false,
      });
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('记者必须在末班车离站前找回录音证据（mobile）', { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({
      path: path.join(process.cwd(), 'outputs', 'story-bible-invalidation-refresh-mobile.png'),
      fullPage: true,
    });
    const refreshedTask = getTaskForOwner(taskId, owner);
    assert(refreshedTask?.result?.productionProject);
    const refreshedProject = refreshedTask.result.productionProject as ProductionProject;
    const firstShotId = refreshedProject.storyboard.shots[0].id;
    const secondShotId = refreshedProject.storyboard.shots[1].id;
    const firstVideoAssetId = 'accepted-video-segment-1';
    const secondVideoAssetId = 'stale-video-segment-2';
    const finalVideoAssetId = 'stale-final-video';
    const acceptedChildTaskId = createTask('video', {
      prompt: '已验收镜头 1',
      parentTaskId: taskId,
      shotId: firstShotId,
      noAutoStart: true,
    }, owner);
    const staleChildTaskId = createTask('video', {
      prompt: '旧镜头 2',
      parentTaskId: taskId,
      shotId: secondShotId,
      noAutoStart: true,
    }, owner);
    updateTask(acceptedChildTaskId, {
      status: 'completed',
      progress: 100,
      result: {
        videoUrl: '/huiying/home/huiying-ark-test-clip.mp4',
        lastFrameUrl: '/huiying/samples/cyber-city.jpg',
      },
    });
    updateTask(staleChildTaskId, {
      status: 'completed',
      progress: 100,
      result: {
        videoUrl: '/huiying/home/huiying-ark-test-clip.mp4',
        lastFrameUrl: '/huiying/samples/red-hood.jpg',
      },
    });
    const shotInvalidationProject: ProductionProject = {
      ...refreshedProject,
      assets: [
        ...refreshedProject.assets,
        {
          id: firstVideoAssetId,
          kind: 'videoSegment',
          name: '已验收镜头 1',
          status: 'completed',
          summary: '必须保留的已验收片段',
          source: 'task',
          relatedShotIds: [firstShotId],
        },
        {
          id: secondVideoAssetId,
          kind: 'videoSegment',
          name: '旧镜头 2',
          status: 'completed',
          summary: '修改后必须失效的片段',
          source: 'task',
          relatedShotIds: [secondShotId],
        },
        {
          id: finalVideoAssetId,
          kind: 'finalVideo',
          name: '旧成片',
          status: 'completed',
          summary: '修改后必须失效的成片',
          source: 'task',
        },
      ],
      stages: refreshedProject.stages.map(stage =>
        ['assembly', 'delivery'].includes(stage.id)
          ? {
              ...stage,
              status: 'completed',
              assetIds: [
                ...stage.assetIds,
                ...(stage.id === 'assembly' ? [firstVideoAssetId, secondVideoAssetId] : [finalVideoAssetId]),
              ],
            }
          : stage),
      graph: {
        nodes: [
          ...refreshedProject.graph.nodes,
          { id: firstVideoAssetId, kind: 'videoSegment', name: '已验收镜头 1', status: 'completed' },
          { id: secondVideoAssetId, kind: 'videoSegment', name: '旧镜头 2', status: 'completed' },
          { id: finalVideoAssetId, kind: 'finalVideo', name: '旧成片', status: 'completed' },
        ],
        edges: [
          ...refreshedProject.graph.edges,
          { from: firstVideoAssetId, to: finalVideoAssetId, relation: 'feeds' },
          { from: secondVideoAssetId, to: finalVideoAssetId, relation: 'feeds' },
        ],
      },
      storyboard: {
        ...refreshedProject.storyboard,
        shots: refreshedProject.storyboard.shots.map(shot => ({ ...shot, status: 'completed' })),
      },
      output: {
        ...refreshedProject.output,
        status: 'completed',
        canProceedToVideo: true,
        nextStep: '旧成片已交付',
      },
    };
    const baseAssemblyPlan = buildProductionAssemblyPlan({
      productionProject: shotInvalidationProject,
      sourceTaskId: taskId,
    });
    const completedAssemblyPlan = {
      ...baseAssemblyPlan,
      status: 'completed' as const,
      segments: baseAssemblyPlan.segments.map(segment => ({
        ...segment,
        status: 'completed' as const,
        expectedInputs: {
          ...segment.expectedInputs,
          firstFrameUrl: segment.index === 0
            ? '/huiying/samples/cyber-city.jpg'
            : '/huiying/samples/cyber-city.jpg',
          previousLastFrameUrl: segment.index === 0 ? null : '/huiying/samples/cyber-city.jpg',
        },
        expectedOutputs: {
          ...segment.expectedOutputs,
          taskId: segment.index === 0 ? acceptedChildTaskId : staleChildTaskId,
          videoUrl: '/huiying/home/huiying-ark-test-clip.mp4',
          lastFrameUrl: segment.index === 0
            ? '/huiying/samples/cyber-city.jpg'
            : '/huiying/samples/red-hood.jpg',
        },
      })),
    };
    updateTask(taskId, {
      result: {
        ...refreshedTask.result,
        productionProject: shotInvalidationProject,
        assemblyPlan: completedAssemblyPlan,
        vimaxReferenceAssets: [
          { kind: 'shot', shotIndex: 1, url: '/huiying/samples/cyber-city.jpg' },
          { kind: 'shot', shotIndex: 2, url: '/huiying/samples/red-hood.jpg' },
        ],
        vimaxReferenceTaskId: 'reference-task-completed',
        vimaxHappyHorseSegments: [
          { shotIndex: 1, status: 'succeeded', videoUrl: '/huiying/home/huiying-ark-test-clip.mp4', lastFrameUrl: '/huiying/samples/cyber-city.jpg' },
          { shotIndex: 2, status: 'succeeded', videoUrl: '/huiying/home/huiying-ark-test-clip.mp4', lastFrameUrl: '/huiying/samples/red-hood.jpg' },
        ],
        vimaxVideoResult: {
          videoUrl: '/huiying/home/huiying-ark-test-clip.mp4',
          segments: [
            { shotIndex: 1, status: 'succeeded', videoUrl: '/huiying/home/huiying-ark-test-clip.mp4' },
            { shotIndex: 2, status: 'succeeded', videoUrl: '/huiying/home/huiying-ark-test-clip.mp4' },
          ],
        },
        vimaxVideoTaskId: 'video-task-completed',
        vimaxVideoTaskStatus: 'completed',
        assemblyQueue: {
          version: 'yh-assembly-queue-v1',
          sourceTaskId: taskId,
          status: 'completed',
          queuedSegmentCount: 0,
          childTaskIds: [acceptedChildTaskId, staleChildTaskId],
          updatedAt: new Date().toISOString(),
        },
        videoUrl: '/huiying/home/huiying-ark-test-clip.mp4',
        imageUrls: ['/huiying/samples/cyber-city.jpg', '/huiying/samples/red-hood.jpg'],
        segments: [
          { index: 0, status: 'completed', videoUrl: '/huiying/home/huiying-ark-test-clip.mp4', lastFrameUrl: '/huiying/samples/cyber-city.jpg' },
          { index: 1, status: 'completed', videoUrl: '/huiying/home/huiying-ark-test-clip.mp4', lastFrameUrl: '/huiying/samples/red-hood.jpg' },
        ],
        isPartial: false,
        successSegmentCount: 2,
        segmentCount: 2,
      },
    });
    await new Promise(resolve => setTimeout(resolve, 1200));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    const shotSelect = page.locator(`select[id="shot-${taskId}"]`);
    await shotSelect.selectOption(secondShotId);
    const updatedShotPrompt = '记者拾起录音笔，屏幕亮起失踪者留下的最后一句话。';
    await page.getByLabel('分镜提示词').fill(updatedShotPrompt);
    const shotSavePromise = page.waitForResponse(response =>
      response.request().method() === 'PATCH'
      && response.url().endsWith(`/api/production/projects/${taskId}/storyboard/${secondShotId}`));
    await page.getByRole('button', { name: '保存分镜', exact: true }).click();
    const shotSaveResponse = await shotSavePromise;
    assert.equal(shotSaveResponse.status(), 200);
    const shotSavePayload = await shotSaveResponse.json() as {
      invalidation?: {
        fromShotIndex: number;
        retainedAcceptedSegments: number;
        invalidatedShots: number;
      };
    };
    assert.deepEqual(shotSavePayload.invalidation, {
      fromShotIndex: 2,
      retainedAcceptedSegments: 1,
      invalidatedShots: 1,
      removedReferenceAssets: 1,
      removedVideoSegments: 1,
      removedFinalVideos: 1,
    });
    const shotNotice = page.getByTestId('shot-invalidation-notice');
    await shotNotice.waitFor({ state: 'visible', timeout: 10_000 });
    assert.match(await shotNotice.textContent() || '', /已保留前 1 个完成镜头/);
    await page.getByTestId('vimax-segment-2').getByText('等待制作', { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(
      await page.getByTestId('vimax-segment-2').getByText('正在同步任务阶段', { exact: true }).count(),
      0,
      'an invalidated segment without a child task must not pretend that a provider task is syncing',
    );
    const shotPersisted = getTaskForOwner(taskId, owner);
    assert(shotPersisted?.result);
    const shotPersistedProject = shotPersisted.result.productionProject as ProductionProject;
    assert.equal(shotPersistedProject.assets.some(asset => asset.id === firstVideoAssetId), true);
    assert.equal(shotPersistedProject.assets.some(asset => asset.id === secondVideoAssetId), false);
    assert.equal(shotPersistedProject.assets.some(asset => asset.kind === 'finalVideo'), false);
    assert.equal(shotPersistedProject.storyboard.shots[0].status, 'completed');
    assert.equal(shotPersistedProject.storyboard.shots[1].status, 'planned');
    assert.deepEqual(
      (shotPersisted.result.vimaxReferenceAssets as Array<{ shotIndex: number }>).map(asset => asset.shotIndex),
      [1],
    );
    assert.deepEqual(
      (shotPersisted.result.vimaxHappyHorseSegments as Array<{ shotIndex: number }>).map(segment => segment.shotIndex),
      [1],
    );
    assert.deepEqual(
      (shotPersisted.result.segments || []).map(segment => segment.index),
      [0],
    );
    assert.equal('videoUrl' in shotPersisted.result, false);
    assert.equal('vimaxVideoResult' in shotPersisted.result, false);
    assert.equal('assemblyQueue' in shotPersisted.result, false);
    assert.equal(shotPersisted.result.assemblyPlan?.segments[0].expectedOutputs?.videoUrl, '/huiying/home/huiying-ark-test-clip.mp4');
    assert.equal(shotPersisted.result.assemblyPlan?.segments[1].expectedOutputs?.videoUrl, null);
    assert.equal(shotPersisted.result.assemblyPlan?.segments[1].expectedOutputs?.taskId, null);
    updateTask(taskId, {
      result: {
        ...shotPersisted.result,
        vimaxReferenceAssets: (shotPersisted.result.vimaxReferenceAssets as Array<{
          kind?: string;
          shotIndex?: number;
          url?: string;
        }>).map(asset => asset.shotIndex === 1
          ? { ...asset, kind: 'shot', url: privateReferenceUrl }
          : asset),
      },
    });
    await page.screenshot({
      path: path.join(process.cwd(), 'outputs', 'storyboard-shot-invalidation-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('creation-project-editor').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator(`select[id="shot-${taskId}"]`).selectOption(secondShotId);
    assert.equal(await page.getByLabel('分镜提示词').inputValue(), updatedShotPrompt);
    await page.screenshot({
      path: path.join(process.cwd(), 'outputs', 'storyboard-shot-invalidation-refresh-mobile.png'),
      fullPage: true,
    });
    const shotDimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert(shotDimensions.scrollWidth <= shotDimensions.clientWidth + 1, 'shot invalidation mobile overflow');
    const useAsNextReference = page.getByTestId('use-shot-1-as-next-reference');
    await useAsNextReference.waitFor({ state: 'visible', timeout: 10_000 });
    const referenceActionPromise = page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().endsWith(`/api/production/projects/${taskId}/references/use-next-shot`));
    await useAsNextReference.click();
    const referenceActionResponse = await referenceActionPromise;
    assert.equal(referenceActionResponse.status(), 200);
    await page.getByText('已用于镜头 2，刷新后仍会保留。', { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });
    const contextActionPersisted = getTaskForOwner(taskId, owner);
    assert(contextActionPersisted?.result);
    const contextReferences = contextActionPersisted.result.vimaxReferenceAssets as Array<{
      shotIndex?: number;
      sourceShotIndex?: number;
      url?: string;
    }>;
    assert.equal(contextReferences.find(asset => asset.shotIndex === 1)?.url, privateReferenceUrl);
    assert.equal(contextReferences.find(asset => asset.shotIndex === 2)?.url, privateReferenceUrl);
    assert.equal(contextReferences.find(asset => asset.shotIndex === 2)?.sourceShotIndex, 1);
    assert(protectedImageRequests > 0, 'private reference image was not requested');
    assert.equal(protectedImageRequestsWithAuth, protectedImageRequests);
    const crossMemberResponse = await fetch(`${origin}${privateReferenceUrl}`, {
      headers: { Authorization: `Bearer ${otherFixtureToken}` },
    });
    assert.equal(crossMemberResponse.status, 404);
    await page.getByTestId('vimax-shot-reference-grid').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(process.cwd(), 'outputs', 'image-context-next-shot-390.png'),
      fullPage: true,
    });
    for (const viewport of [
      { name: '768', width: 768, height: 900 },
      { name: '1280', width: 1280, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload({ waitUntil: 'domcontentloaded' });
      const targetCard = page.getByTestId('vimax-shot-card-2');
      await targetCard.waitFor({ state: 'visible', timeout: 15_000 });
      const recoveredImage = targetCard.locator('img');
      await recoveredImage.waitFor({ state: 'visible', timeout: 10_000 });
      assert.match(await recoveredImage.getAttribute('src') || '', /^blob:/);
      await page.getByTestId('vimax-shot-reference-grid').scrollIntoViewIfNeeded();
      const contextDimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(
        contextDimensions.scrollWidth <= contextDimensions.clientWidth + 1,
        `${viewport.name} image context action overflow`,
      );
      await page.screenshot({
        path: path.join(process.cwd(), 'outputs', `image-context-next-shot-${viewport.name}.png`),
        fullPage: true,
      });
    }
    assert.equal(providerRequests, 0, 'story edit called a provider');
    assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedResponses, [], `failed responses: ${JSON.stringify(failedResponses)}`);
    results[results.length - 1].refreshed = true;
    await context.close();

    console.log(JSON.stringify({
      ok: true,
      path: 'story Bible click -> invalidate stale media -> save -> refresh recovery',
      results,
      shotEdit: {
        saved: true,
        retainedAcceptedSegments: 1,
        invalidatedShots: 1,
        refreshed: true,
        overflow: false,
      },
      imageContextAction: {
        action: 'use current shot as next shot reference',
        persisted: true,
        refreshedViewports: [390, 768, 1280],
        overflow: false,
      },
      privateReferencePreview: {
        authenticatedRequests: protectedImageRequestsWithAuth,
        totalRequests: protectedImageRequests,
        crossMemberStatus: 404,
        refreshed: true,
      },
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
    rmSync(attachmentRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
