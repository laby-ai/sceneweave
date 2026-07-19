import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';
import { resolveVimaxSkillPresetForRuntime } from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';
import { callHappyHorseVimaxVideo } from '../src/lib/skills/vimax-short-drama/happyhorse-vimax-video';
import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import {
  buildVimaxContinuityContract,
  resolveVimaxProviderHandoffMode,
  type VimaxContinuityContract,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

const taskFile = path.join(tmpdir(), `sceneweave-happyhorse-route-${randomUUID()}.json`);
const finalVideoRoot = path.join(tmpdir(), `sceneweave-happyhorse-final-${randomUUID()}`);
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.HUIYING_FINAL_VIDEO_STORE_PATH = finalVideoRoot;

const calls: Array<{ url: string; init?: RequestInit }> = [];
const originalFetch = globalThis.fetch;
let workspaceListRejected = false;
let releaseFirstVideoPoll = () => {};
const firstVideoPollGate = new Promise<void>(resolve => { releaseFirstVideoPoll = resolve; });
let holdFirstVideoPoll = true;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, init });
  if (url.endsWith('/api/v1/services/aigc/video-generation/video-synthesis')) {
    return new Response(JSON.stringify({ output: { task_id: 'happyhorse-task-a', task_status: 'PENDING' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.endsWith('/api/v1/tasks/happyhorse-task-a')) {
    if (holdFirstVideoPoll) {
      holdFirstVideoPoll = false;
      await firstVideoPollGate;
    }
    return new Response(JSON.stringify({
      output: {
        task_status: 'SUCCEEDED',
        video_url: 'https://fixture.invalid/happyhorse-a.mp4',
        last_frame_url: 'https://fixture.invalid/happyhorse-a-last.jpg',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/api/v1/tasks/?')) {
    if (url.startsWith('https://workspace.example.com/')) {
      workspaceListRejected = true;
      return new Response(JSON.stringify({ code: 'InvalidApiKey', message: 'Authentication Failed' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    assert.equal(
      url.startsWith('https://dashscope.aliyuncs.com/api/v1/tasks/?'),
      true,
      'workspace task-list authentication failures must fall back to the official DashScope task-list endpoint',
    );
    return new Response(JSON.stringify({
      data: [{
        task_id: 'happyhorse-task-recovered',
        status: 'SUCCEEDED',
        model_name: 'happyhorse-1.1-t2v',
        submit_time: '2026-07-19 12:30:00',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.endsWith('/api/v1/tasks/happyhorse-task-recovered')) {
    return new Response(JSON.stringify({
      output: {
        task_status: 'SUCCEEDED',
        video_url: 'https://fixture.invalid/happyhorse-recovered.mp4',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.startsWith('https://fixture.invalid/') && url.endsWith('.mp4')) {
    const mp4 = Buffer.alloc(2048);
    mp4.writeUInt32BE(24, 0);
    mp4.write('ftyp', 4, 'ascii');
    mp4.write('isom', 8, 'ascii');
    return new Response(mp4, { status: 200, headers: { 'content-type': 'video/mp4' } });
  }
  throw new Error(`Unexpected network call: ${url}`);
}) as typeof fetch;

function readyProductionPlan(continuity: VimaxContinuityContract, videoModel = 'happyhorse-1.1-t2v') {
  const base = buildVimaxProductionPlan({
    title: '快乐马短剧夹具',
    ratio: '16:9',
    resolution: '720p',
    planModel: VIMAX_PLAN_MODEL,
    imageModel: 'doubao-seedream-5-0-260128',
    videoModel,
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [{ kind: 'character', label: '女记者', prompt: '米色风衣，红色录音笔' }],
    shots: [{ index: 1, title: '走出车站', duration: 5, camera: '向右跟拍', prompt: '女记者走出车站' }],
    workflow: resolveVimaxSkillRuntimeBinding({ skillId: 'short-drama' }),
    continuity,
  });
  const approved = approveVimaxProductionPlan(base);
  return {
    ...approved,
    governance: { ...approved.governance, status: 'ready' as const },
    estimatedCost: { ...approved.estimatedCost, amount: 1, status: 'confirmed' as const },
  };
}

async function main() {
  const { createTask, getTaskForOwner, updateTask } = await import('../src/lib/task-manager');
  const { persistVimaxPlanTask } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-task');
  const { buildProductionBackedVimaxPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts');
  const [{ NextRequest }, route] = await Promise.all([
    import('next/server'),
    import('../src/app/api/smart/vimax-agent-step/route'),
  ]);
  const workspace = 'guest-creation-happyhorse-route-fixture';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const plan: VimaxAgentPlan = {
    title: '雨夜来电',
    summary: '同一位穿米色风衣的女记者在雨夜车站握着红色录音笔，向画面右侧走出车站并追查神秘电话。',
    assets: [{ kind: 'character', label: '女记者', prompt: '米色风衣，红色录音笔' }],
    shots: [{ index: 1, title: '走出车站', duration: 5, camera: '向右跟拍', prompt: '女记者走出车站' }],
    nextAction: '生成视频',
  };
  const taskId = createTask('storyboard', { prompt: plan.summary, workflow: 'vimax-agent' }, owner);
  const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
    phase: 'plan', skillId: 'short-drama', duration: 5, segmentDuration: 5, segmentCount: 1,
    ratio: '16:9', resolution: '720p', sceneType: 'drama', style: '电影感短剧',
  }, taskId);
  const productionPlan = readyProductionPlan(buildVimaxContinuityContract({
    productionProject: built.productionProject,
    assemblyPlan: built.assemblyPlan,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'happyhorse-dashscope',
      model: 'happyhorse-1.1-t2v',
    }),
  }));
  persistVimaxPlanTask({
    taskId,
    prompt: plan.summary,
    plan: built.plan,
    productionProject: built.productionProject,
    assemblyPlan: built.assemblyPlan,
    productionPlan,
  });

  const responsePromise = route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://workspace.example.com/api/v1',
      'x-yh-api-key': 'dummy-key',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    },
    body: JSON.stringify({
      taskId,
      phase: 'video',
      confirm: true,
      background: true,
      skillId: 'commerce-video',
      ratio: '16:9',
      resolution: '720p',
      productionPlan,
      plan,
    }),
  }));
  const response = await Promise.race([
    responsePromise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('video phase must return before provider polling completes')), 250)),
  ]);
  const payload = await response.json() as {
    success?: boolean;
    accepted?: boolean;
    backgroundTaskId?: string;
    taskId?: string;
  };
  assert.equal(response.status, 202);
  assert.equal(payload.success, true);
  assert.equal(payload.accepted, true);
  assert.equal(payload.taskId, taskId);
  assert.equal(typeof payload.backgroundTaskId, 'string');
  const backgroundTaskId = payload.backgroundTaskId as string;
  assert.equal(getTaskForOwner(backgroundTaskId, owner)?.config.parentTaskId, taskId);
  assert.equal(getTaskForOwner(backgroundTaskId, owner)?.status, 'running');
  releaseFirstVideoPoll();
  const waitUntil = async (predicate: () => boolean, message: string) => {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(message);
  };
  await waitUntil(
    () => getTaskForOwner(backgroundTaskId, owner)?.status === 'completed',
    'background video task did not complete',
  );
  assert.equal(
    (getTaskForOwner(backgroundTaskId, owner)?.result?.vimaxVideoResult as { model?: string } | undefined)?.model,
    'happyhorse-1.1-t2v',
  );
  assert.match(
    String((getTaskForOwner(backgroundTaskId, owner)?.result?.vimaxVideoResult as { videoUrl?: string } | undefined)?.videoUrl || ''),
    /^\/api\/final-videos\/[0-9a-f-]{36}$/,
    'the original video runtime must return an owner-isolated durable final URL',
  );
  assert.deepEqual(
    getTaskForOwner(taskId, owner)?.result?.vimaxHappyHorseSegments,
    [{
      shotIndex: 1,
      shotTitle: '走出车站',
      duration: 5,
      taskId: 'happyhorse-task-a',
      status: 'succeeded',
      videoUrl: 'https://fixture.invalid/happyhorse-a.mp4',
      lastFrameUrl: 'https://fixture.invalid/happyhorse-a-last.jpg',
    }],
    'each provider task id and last successful result must persist before the long request returns',
  );
  assert.equal(
    calls.filter(call => call.url.includes('/video-synthesis') || call.url.includes('/api/v1/tasks/happyhorse-task-a')).length,
    2,
    'one shot must submit once and poll once',
  );
  const submitBody = JSON.parse(String(calls[0]?.init?.body || '{}'));
  assert.equal(submitBody.parameters.resolution, '720P');
  assert.equal(submitBody.parameters.duration, 5);
  assert.match(submitBody.input.prompt, /女记者/);
  assert.match(submitBody.input.prompt, /红色录音笔/);
  assert.match(submitBody.input.prompt, /【供应商交接】仅文本锚点/);
  assert.doesNotMatch(submitBody.input.prompt, /已绑定上一段尾帧/);
  assert.doesNotMatch(submitBody.input.prompt, /客户端伪造/);
  assert.ok(calls.every(call => !call.url.includes('contents/generations/tasks')), 'must not fall back to Ark video route');

  const recoveryResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://workspace.example.com/api/v1',
      'x-yh-api-key': 'dummy-key',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    },
    body: JSON.stringify({ taskId, phase: 'video', recover: true }),
  }));
  const recoveryPayload = await recoveryResponse.json() as {
    success?: boolean;
    recovered?: boolean;
    incurredCost?: boolean;
    segments?: Array<{ taskId?: string }>;
  };
  assert.equal(recoveryResponse.status, 200, JSON.stringify(recoveryPayload));
  assert.equal(recoveryPayload.success, true);
  assert.equal(recoveryPayload.recovered, true);
  assert.equal(recoveryPayload.incurredCost, false);
  assert.equal(recoveryPayload.segments?.[0]?.taskId, 'happyhorse-task-a');
  assert.equal(workspaceListRejected, false, 'known provider task ids must bypass unsupported task enumeration');
  assert.equal(calls.filter(call => call.init?.method === 'POST').length, 1, 'recovery must never submit another provider job');
  assert.equal(getTaskForOwner(taskId, owner)?.result?.assemblyPlan?.status, 'completed');
  assert.equal(getTaskForOwner(taskId, owner)?.result?.assemblyPlan?.segments?.[0]?.expectedOutputs?.videoUrl, 'https://fixture.invalid/happyhorse-a.mp4');

  const { createVimaxVideoTaskRuntime } = await import('../src/lib/skills/vimax-short-drama/vimax-video-task-runtime');
  const durableVideoUrl = '/api/final-videos/11111111-1111-4111-8111-111111111111';
  await createVimaxVideoTaskRuntime({
    owner,
    parentTaskId: taskId,
    totalShots: 1,
    prompt: plan.title,
    ratio: '16:9',
    resolution: '720p',
    modelId: 'happyhorse-1.1-t2v',
    execute: async persistSegment => {
      persistSegment({
        shotIndex: 1,
        status: 'succeeded',
        taskId: 'happyhorse-task-a',
        videoUrl: 'https://fixture.invalid/happyhorse-a.mp4',
        lastFrameUrl: 'https://fixture.invalid/happyhorse-a-last.jpg',
      });
      return {
        videoUrl: durableVideoUrl,
        merge: {
          renderReport: {
            version: 'sceneweave-render-report-v1' as const,
            status: 'passed' as const,
            runtime: 'sceneweave-segmented-ffmpeg-v1' as const,
            checkedAt: new Date().toISOString(),
            segmentCount: 1,
            expectedDurationSeconds: 5,
            actualDurationSeconds: 5.04,
            outputBytes: 2048,
          },
        },
      };
    },
  }).execute();
  assert.equal(
    (getTaskForOwner(taskId, owner)?.result?.productionPlan as {
      render?: { lastSuccessfulResult?: { videoUrl?: string } };
    } | undefined)?.render?.lastSuccessfulResult?.videoUrl,
    durableVideoUrl,
    'render QA must promote only the durable current-version video to lastSuccessfulResult',
  );

  const recoveryAfterRestart = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://workspace.example.com/api/v1',
      'x-yh-api-key': 'dummy-key',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    },
    body: JSON.stringify({
      taskId: 'task-removed-by-release-restart',
      phase: 'video',
      recover: true,
      recoverCreatedAfter: Date.parse('2026-07-19T12:20:00+08:00'),
      productionPlan,
      plan,
    }),
  }));
  const restartedPayload = await recoveryAfterRestart.json() as {
    success?: boolean;
    recovered?: boolean;
    taskId?: string;
    segments?: Array<{ taskId?: string }>;
  };
  assert.equal(recoveryAfterRestart.status, 200, 'release restart recovery must rebuild the owned task from the saved project snapshot');
  assert.equal(restartedPayload.success, true);
  assert.equal(restartedPayload.recovered, true);
  assert.notEqual(restartedPayload.taskId, 'task-removed-by-release-restart');
  assert.equal(restartedPayload.segments?.[0]?.taskId, 'happyhorse-task-recovered');
  assert.equal(workspaceListRejected, true, 'missing task ids must exercise the workspace task-list fallback');
  assert.equal(calls.filter(call => call.init?.method === 'POST').length, 1, 'restart recovery must never resubmit provider work');

  const r2vTaskId = createTask('storyboard', { prompt: plan.summary, workflow: 'vimax-agent' }, owner);
  const r2vBuilt = buildProductionBackedVimaxPlan(plan.summary, plan, {
    phase: 'plan', skillId: 'short-drama', duration: 5, segmentDuration: 5, segmentCount: 1,
    ratio: '16:9', resolution: '720p', sceneType: 'drama', style: '电影感短剧',
  }, r2vTaskId);
  const r2vProductionPlan = readyProductionPlan(buildVimaxContinuityContract({
    productionProject: r2vBuilt.productionProject,
    assemblyPlan: r2vBuilt.assemblyPlan,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'happyhorse-dashscope',
      model: 'happyhorse-1.1-r2v',
    }),
  }), 'happyhorse-1.1-r2v');
  persistVimaxPlanTask({
    taskId: r2vTaskId,
    prompt: plan.summary,
    plan: r2vBuilt.plan,
    productionProject: r2vBuilt.productionProject,
    assemblyPlan: r2vBuilt.assemblyPlan,
    productionPlan: r2vProductionPlan,
  });
  assert.ok(updateTask(r2vTaskId, {
    result: {
      ...(getTaskForOwner(r2vTaskId, owner)?.result || {}),
      vimaxReferenceAssets: [
        { kind: 'character', label: '女记者正面定妆', url: 'https://fixture.invalid/reporter-front.png' },
        { kind: 'scene', label: '雨夜车站', url: 'https://fixture.invalid/rain-station.png' },
      ],
    },
  }));
  const r2vCallStart = calls.length;
  const r2vResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://workspace.example.com/api/v1',
      'x-yh-api-key': 'dummy-key',
      'x-yh-video-model': 'happyhorse-1.1-r2v',
    },
    body: JSON.stringify({
      taskId: r2vTaskId,
      phase: 'video',
      confirm: true,
      background: true,
      skillId: 'short-drama',
      productionPlan: r2vProductionPlan,
      plan,
    }),
  }));
  const r2vPayload = await r2vResponse.json() as { backgroundTaskId?: string };
  assert.equal(r2vResponse.status, 202);
  assert.equal(typeof r2vPayload.backgroundTaskId, 'string');
  await waitUntil(
    () => getTaskForOwner(r2vPayload.backgroundTaskId as string, owner)?.status === 'completed',
    'R2V background video task did not complete',
  );
  const r2vSubmit = calls.slice(r2vCallStart).find(call => call.init?.method === 'POST');
  const r2vSubmitBody = JSON.parse(String(r2vSubmit?.init?.body || '{}'));
  assert.equal(r2vSubmitBody.model, 'happyhorse-1.1-r2v');
  assert.deepEqual(r2vSubmitBody.input.media, [
    { type: 'reference_image', url: 'https://fixture.invalid/reporter-front.png' },
    { type: 'reference_image', url: 'https://fixture.invalid/rain-station.png' },
  ], 'R2V route must use the persisted approved project assets');
  assert.match(r2vSubmitBody.input.prompt, /\[Image 1\].*女记者正面定妆.*角色参考/);
  assert.match(r2vSubmitBody.input.prompt, /\[Image 2\].*雨夜车站.*场景参考/);
  assert.match(r2vSubmitBody.input.prompt, /【供应商交接】参考驱动交接/);
  const r2vSegments = getTaskForOwner(r2vTaskId, owner)?.result?.vimaxHappyHorseSegments as Array<{
    referenceManifest?: {
      version?: string;
      artifactRevision?: string;
      sha256?: string;
      entries?: Array<{ token?: string; role?: string; label?: string; url?: string }>;
    };
  }> | undefined;
  assert.equal(r2vSegments?.[0]?.referenceManifest?.version, 'sceneweave-happyhorse-r2v-reference-manifest-v1');
  assert.equal(r2vSegments?.[0]?.referenceManifest?.artifactRevision, r2vProductionPlan.continuity?.artifactRevision);
  assert.match(r2vSegments?.[0]?.referenceManifest?.sha256 || '', /^[a-f0-9]{64}$/);
  assert.deepEqual(r2vSegments?.[0]?.referenceManifest?.entries, [
    {
      token: '[Image 1]',
      role: 'subject',
      label: '女记者正面定妆',
      url: 'https://fixture.invalid/reporter-front.png',
    },
    {
      token: '[Image 2]',
      role: 'scene',
      label: '雨夜车站',
      url: 'https://fixture.invalid/rain-station.png',
    },
  ]);

  const partialPlan: VimaxAgentPlan = {
    ...plan,
    shots: [plan.shots[0]],
  };
  const partialTaskId = createTask('storyboard', { prompt: partialPlan.summary, workflow: 'vimax-agent' }, owner);
  const partialBuilt = buildProductionBackedVimaxPlan(partialPlan.summary, partialPlan, {
    phase: 'plan', skillId: 'short-drama', duration: 5, segmentDuration: 5, segmentCount: 1,
    ratio: '16:9', resolution: '720p', sceneType: 'drama', style: '电影感短剧',
  }, partialTaskId);
  const partialContinuity = buildVimaxContinuityContract({
    productionProject: partialBuilt.productionProject,
    assemblyPlan: partialBuilt.assemblyPlan,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: 'happyhorse-dashscope',
      model: 'happyhorse-1.1-r2v',
    }),
  });
  const partialCallStart = calls.length;
  const partialResult = await callHappyHorseVimaxVideo(
    partialPlan,
    resolveVimaxSkillPresetForRuntime('short-drama'),
    {
      provider: 'happyhorse-dashscope',
      apiBase: 'https://workspace.example.com/api/v1',
      apiKey: 'dummy-key',
      videoModel: 'happyhorse-1.1-r2v',
    },
    { ratio: '16:9', resolution: '720p' },
    partialContinuity,
    [
      { kind: 'character', label: '女记者正面定妆', url: 'https://fixture.invalid/reporter-front.png' },
      { kind: 'scene', label: '雨夜车站', url: 'https://fixture.invalid/rain-station.png' },
    ],
    undefined,
    [{
      shotIndex: 1,
      shotTitle: '走出车站',
      duration: 5,
      taskId: 'already-paid-shot-a',
      status: 'succeeded',
      videoUrl: 'https://fixture.invalid/already-paid-a.mp4',
      lastFrameUrl: 'https://fixture.invalid/already-paid-a-last.jpg',
    }],
  );
  assert.equal(partialResult.segmentCount, 1);
  assert.equal(partialResult.segments[0]?.taskId, 'already-paid-shot-a');
  assert.equal(
    calls.slice(partialCallStart).filter(call => call.init?.method === 'POST').length,
    0,
    'continuation must not resubmit an already paid successful shot',
  );

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    route: '/api/smart/vimax-agent-step',
    providerSubmits: 2,
    providerPolls: 3,
    providerRecoveries: 1,
    r2vPersistedReferences: 2,
  }));
}

main().finally(() => {
  globalThis.fetch = originalFetch;
  rmSync(taskFile, { force: true });
  rmSync(finalVideoRoot, { force: true, recursive: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
