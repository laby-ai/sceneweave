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
import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import {
  buildVimaxContinuityContract,
  resolveVimaxProviderHandoffMode,
  type VimaxContinuityContract,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

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

function readyProductionPlan(continuity: VimaxContinuityContract) {
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
  const { createTask } = await import('../src/lib/task-manager');
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

  const response = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
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
      skillId: 'commerce-video',
      ratio: '16:9',
      resolution: '720p',
      productionPlan,
      plan,
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
  assert.match(submitBody.input.prompt, /女记者/);
  assert.match(submitBody.input.prompt, /红色录音笔/);
  assert.match(submitBody.input.prompt, /【供应商交接】仅文本锚点/);
  assert.doesNotMatch(submitBody.input.prompt, /已绑定上一段尾帧/);
  assert.doesNotMatch(submitBody.input.prompt, /客户端伪造/);
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
