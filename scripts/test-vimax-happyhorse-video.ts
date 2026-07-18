import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';

const taskFile = path.join(tmpdir(), `sceneweave-happyhorse-route-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

const calls: Array<{ url: string; init?: RequestInit }> = [];
const originalFetch = globalThis.fetch;
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
    return new Response(JSON.stringify({
      output: {
        task_status: 'SUCCEEDED',
        video_url: 'https://fixture.invalid/happyhorse-a.mp4',
        last_frame_url: 'https://fixture.invalid/happyhorse-a-last.jpg',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`Unexpected network call: ${url}`);
}) as typeof fetch;

function readyProductionPlan() {
  const base = buildVimaxProductionPlan({
    title: '快乐马短剧夹具',
    ratio: '16:9',
    resolution: '720p',
    planModel: VIMAX_PLAN_MODEL,
    imageModel: 'doubao-seedream-5-0-260128',
    videoModel: 'happyhorse-1.1-t2v',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [{ kind: 'character', label: '女记者', prompt: '米色风衣，红色录音笔' }],
    shots: [{ index: 1, title: '走出车站', duration: 5, camera: '向右跟拍', prompt: '女记者走出车站' }],
    workflow: resolveVimaxSkillRuntimeBinding({ skillId: 'short-drama' }),
  });
  const approved = approveVimaxProductionPlan(base);
  return {
    ...approved,
    governance: { ...approved.governance, status: 'ready' as const },
    estimatedCost: { ...approved.estimatedCost, amount: 1, status: 'confirmed' as const },
  };
}

async function main() {
  const [{ NextRequest }, route] = await Promise.all([
    import('next/server'),
    import('../src/app/api/smart/vimax-agent-step/route'),
  ]);
  const response = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': 'guest-creation-happyhorse-route-fixture',
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://workspace.example.com/api/v1',
      'x-yh-api-key': 'dummy-key',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    },
    body: JSON.stringify({
      phase: 'video',
      confirm: true,
      skillId: 'commerce-video',
      ratio: '16:9',
      resolution: '720p',
      productionPlan: readyProductionPlan(),
      plan: {
        title: '雨夜来电',
        summary: '记者追查一通神秘电话',
        assets: [{ kind: 'character', label: '女记者', prompt: '米色风衣，红色录音笔' }],
        shots: [{ index: 1, title: '走出车站', duration: 5, camera: '向右跟拍', prompt: '女记者走出车站' }],
      },
    }),
  }));
  const payload = await response.json() as { success?: boolean; model?: string; segments?: Array<{ taskId?: string }> };
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.model, 'happyhorse-1.1-t2v');
  assert.equal(payload.segments?.[0]?.taskId, 'happyhorse-task-a');
  assert.equal(calls.length, 2, 'one shot must submit once and poll once');
  const submitBody = JSON.parse(String(calls[0]?.init?.body || '{}'));
  assert.equal(submitBody.parameters.resolution, '720P');
  assert.equal(submitBody.parameters.duration, 5);
  assert.match(submitBody.input.prompt, /女记者走出车站/);
  assert.ok(calls.every(call => !call.url.includes('contents/generations/tasks')), 'must not fall back to Ark video route');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    route: '/api/smart/vimax-agent-step',
    providerSubmits: 1,
    providerPolls: 1,
  }));
}

main().finally(() => {
  globalThis.fetch = originalFetch;
  rmSync(taskFile, { force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
