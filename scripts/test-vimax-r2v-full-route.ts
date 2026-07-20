import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';

import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import {
  buildVimaxContinuityContract,
  resolveVimaxProviderHandoffMode,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';
import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
  parseVimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';

const execFileAsync = promisify(execFile);
const fixtureRoot = path.join(tmpdir(), `sceneweave-r2v-full-route-${randomUUID()}`);
const taskFile = path.join(fixtureRoot, 'tasks.json');
const finalVideoRoot = path.join(fixtureRoot, 'final-videos');
const fixtureVideoPath = path.join(fixtureRoot, 'five-seconds.mp4');
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.HUIYING_FINAL_VIDEO_STORE_PATH = finalVideoRoot;

async function main() {
  const fixtureFfmpeg = ffmpegPath && existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg';
  await mkdir(fixtureRoot, { recursive: true });
  await execFileAsync(fixtureFfmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=navy:s=320x180:d=5',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    fixtureVideoPath,
  ]);
  const fixtureVideo = await readFile(fixtureVideoPath);
  const providerRequests: Array<{
    taskId: string;
    body: { input?: { media?: Array<{ type: string; url: string }> } };
  }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/v1/services/aigc/video-generation/video-synthesis')) {
      const taskId = `fixture-provider-${providerRequests.length + 1}`;
      providerRequests.push({ taskId, body: JSON.parse(String(init?.body || '{}')) });
      return Response.json({ output: { task_id: taskId, task_status: 'PENDING' } });
    }
    const statusMatch = /\/api\/v1\/tasks\/(fixture-provider-\d+)$/.exec(url);
    if (statusMatch) {
      return Response.json({
        output: {
          task_status: 'SUCCEEDED',
          video_url: `https://fixture.invalid/${statusMatch[1]}.mp4`,
          last_frame_url: `https://fixture.invalid/${statusMatch[1]}-last.jpg`,
        },
      });
    }
    if (/^https:\/\/fixture\.invalid\/fixture-provider-\d+\.mp4$/.test(url)) {
      return new Response(fixtureVideo, { status: 200, headers: { 'content-type': 'video/mp4' } });
    }
    throw new Error(`Unexpected network call: ${url}`);
  }) as typeof fetch;

  try {
    const { NextRequest } = await import('next/server');
    const route = await import('../src/app/api/smart/vimax-agent-step/route');
    const finalVideoRoute = await import('../src/app/api/final-videos/[id]/route');
    const { createTask, getTaskForOwner, updateTask } = await import('../src/lib/task-manager');
    const { buildProductionBackedVimaxPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts');
    const { persistVimaxPlanTask } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-task');

    const workspace = 'guest-creation-r2v-full-route-fixture';
    const owner = {
      tenantId: 'paper-host-guest',
      memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
    };
    const plan: VimaxAgentPlan = {
      title: '雨夜录音笔',
      summary: '同一位米色风衣女记者在雨夜车站追查红色录音笔里的秘密。',
      assets: [
        { kind: 'character', label: '女记者', prompt: '黑短发、米色风衣、红色录音笔' },
        { kind: 'scene', label: '雨夜车站', prompt: '蓝灰雨夜、暖色站灯、同一站台' },
        { kind: 'prop', label: '红色录音笔', prompt: '红色录音笔始终握在右手' },
      ],
      shots: [
        { index: 1, title: '收到留言', duration: 5, camera: '向右跟拍', prompt: '女记者向右走并按下录音笔' },
        { index: 2, title: '穿过站台', duration: 5, camera: '同方向中景', prompt: '承接按键动作继续向右穿过站台' },
        { index: 3, title: '发现真相', duration: 5, camera: '同方向推近', prompt: '承接行走停在灯下听见关键留言' },
      ],
      nextAction: '生成连续短剧',
    };
    const taskId = createTask('storyboard', { prompt: plan.summary, workflow: 'vimax-agent' }, owner);
    const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
      phase: 'plan', skillId: 'short-drama', duration: 15, segmentDuration: 5, segmentCount: 3,
      ratio: '16:9', resolution: '720p', sceneType: 'drama', style: '电影感短剧',
    }, taskId);
    const continuity = buildVimaxContinuityContract({
      productionProject: built.productionProject,
      assemblyPlan: built.assemblyPlan,
      providerHandoff: resolveVimaxProviderHandoffMode({
        provider: 'happyhorse-dashscope',
        model: 'happyhorse-1.1-r2v',
      }),
    });
    const basePlan = buildVimaxProductionPlan({
      title: plan.title,
      ratio: '16:9',
      resolution: '720p',
      planModel: VIMAX_PLAN_MODEL,
      imageModel: 'fixture-image',
      videoModel: 'happyhorse-1.1-r2v',
      providerReadiness: { plan: true, referenceAssets: true, video: true },
      assets: plan.assets,
      shots: plan.shots,
      workflow: resolveVimaxSkillRuntimeBinding({ skillId: 'short-drama' }),
      continuity,
    });
    const approved = approveVimaxProductionPlan(basePlan);
    const productionPlan = {
      ...approved,
      governance: { ...approved.governance, status: 'ready' as const },
      estimatedCost: { ...approved.estimatedCost, amount: 1, status: 'confirmed' as const },
    };
    persistVimaxPlanTask({
      taskId,
      prompt: plan.summary,
      plan: built.plan,
      productionProject: built.productionProject,
      assemblyPlan: built.assemblyPlan,
      productionPlan,
    });
    assert.ok(updateTask(taskId, {
      result: {
        ...(getTaskForOwner(taskId, owner)?.result || {}),
        vimaxReferenceAssets: [
          { kind: 'character', label: '女记者定妆', url: 'https://fixture.invalid/reporter.png' },
          { kind: 'scene', label: '雨夜车站', url: 'https://fixture.invalid/station.png' },
          { kind: 'prop', label: '红色录音笔', url: 'https://fixture.invalid/recorder.png' },
        ],
      },
    }));

    const requestHeaders = {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://workspace.example.com/api/v1',
      'x-yh-api-key': 'fixture-only-key',
      'x-yh-video-model': 'happyhorse-1.1-r2v',
    };
    const response = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ taskId, phase: 'video', confirm: true, background: true }),
    }));
    const accepted = await response.json() as { backgroundTaskId?: string };
    assert.equal(response.status, 202);
    assert.ok(accepted.backgroundTaskId);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && getTaskForOwner(accepted.backgroundTaskId!, owner)?.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const background = getTaskForOwner(accepted.backgroundTaskId!, owner);
    assert.equal(background?.status, 'completed', background?.error || background?.message);
    assert.equal(providerRequests.length, 5, 'three shots and two required transition bridges must run serially');
    assert.deepEqual(
      providerRequests[2]?.body.input?.media?.at(-1),
      { type: 'reference_image', url: 'https://fixture.invalid/fixture-provider-2-last.jpg' },
      'shot 2 must reserve the generated boundary new-camera image in its R2V reference set',
    );
    assert.deepEqual(
      providerRequests[4]?.body.input?.media?.at(-1),
      { type: 'reference_image', url: 'https://fixture.invalid/fixture-provider-4-last.jpg' },
      'shot 3 must reserve the latest generated boundary new-camera image in its R2V reference set',
    );
    const parent = getTaskForOwner(taskId, owner);
    const assemblyPlan = parent?.result?.assemblyPlan as ProductionAssemblyPlan;
    assert.deepEqual(assemblyPlan.segments.map(segment => segment.status), ['completed', 'completed', 'completed']);
    assert.deepEqual(
      assemblyPlan.boundaryBridgePlan?.boundaries.map(boundary => boundary.status),
      ['generated', 'generated'],
    );
    assert.ok(assemblyPlan.boundaryBridgePlan?.boundaries.every(boundary => (
      boundary.bridgeVideoUrl && boundary.newCameraImageUrl
    )));
    const lastSuccessfulResult = parseVimaxProductionPlan(parent?.result?.productionPlan)?.render.lastSuccessfulResult;
    assert.match(lastSuccessfulResult?.videoUrl || '', /^\/api\/final-videos\/[0-9a-f-]{36}$/);
    assert.equal(lastSuccessfulResult?.renderReport?.segmentCount, 3);
    assert.ok(providerRequests.slice(0, 4).every((request, index) => (
      providerRequests[index + 1] && Number(request.taskId.split('-').pop()) < Number(providerRequests[index + 1].taskId.split('-').pop())
    )));
    const finalId = lastSuccessfulResult?.videoUrl.split('/').pop();
    assert.ok(finalId);
    const download = await finalVideoRoute.GET(new NextRequest(`http://localhost/api/final-videos/${finalId}`, {
      headers: requestHeaders,
    }), { params: Promise.resolve({ id: finalId }) });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'video/mp4');
    assert.ok(Number(download.headers.get('content-length')) > fixtureVideo.length);
    console.log(JSON.stringify({
      ok: true,
      route: '/api/smart/vimax-agent-step',
      execution: 'assembly-queue -> segment -> boundary -> segment -> boundary -> segment -> render-lock -> download',
      segmentProviderTasks: 3,
      boundaryProviderTasks: 2,
      realProviderCalls: 0,
      fixtureProviderSubmits: providerRequests.length,
      incurredCost: false,
      finalVideoUrl: lastSuccessfulResult.videoUrl,
    }));
  } finally {
    globalThis.fetch = originalFetch;
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
