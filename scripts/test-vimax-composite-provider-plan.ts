import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-composite-provider-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;
delete process.env.HUIYING_AGENTPLAN_ARK_API_KEY_PRIMARY;
delete process.env.HUIYING_AGENTPLAN_ARK_API_KEY_SECONDARY;
delete process.env.HUIYING_REAL_ARK_API_KEY;
delete process.env.ARK_API_KEY;

const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
  calls.push({ url, body });
  const planContent = JSON.stringify({
    title: '雨夜来电',
    summary: '女记者在旧车站追查神秘电话。',
    assets: [{ kind: 'character', label: '女记者', prompt: '黑色短发，米色风衣，红色录音笔' }],
    shots: [
      { index: 1, title: '走出车站', duration: 5, camera: '向右跟拍', prompt: '女记者向画面右侧走出车站' },
      { index: 2, title: '接到电话', duration: 5, camera: '中景推进', prompt: '女记者停下并举起红色录音笔' },
    ],
    nextAction: '确认计划',
  });
  if (body.stream === true) {
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: '内部推理' } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: { content: planContent } }] })}\n\ndata: [DONE]\n\n`, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }
  return new Response(JSON.stringify({
    model: 'Kimi-K3',
    choices: [{
      finish_reason: 'stop',
      message: {
        content: planContent,
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

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
      'x-paper-host-guest-workspace': 'guest-creation-composite-provider-plan',
      'x-yh-provider': 'openai-compatible',
      'x-yh-api-base': 'https://api.scnet.example/api/llm/v1',
      'x-yh-api-key': 'scnet-fixture-key',
      'x-yh-model': 'Kimi-K3',
      'x-yh-video-provider': 'happyhorse-dashscope',
      'x-yh-video-api-base': 'https://happyhorse.example/api/v1',
      'x-yh-video-api-key': 'happyhorse-fixture-key',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    },
    body: JSON.stringify({
      phase: 'plan',
      prompt: '30 秒雨夜悬疑短剧，6 个 5 秒镜头。',
      skillId: 'short-drama',
      model: 'stale-ui-default',
      duration: 30,
      segmentDuration: 5,
      segmentCount: 6,
      stream: false,
    }),
  }));
  const payload = await response.json() as {
    success?: boolean;
    model?: string;
    taskId?: string;
    productionPlan?: {
      checkpoints?: Array<{ id?: string; status?: string }>;
      providerRoutes?: Array<{ stage?: string; model?: string; ready?: boolean }>;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.model, 'Kimi-K3');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://api.scnet.example/api/llm/v1/chat/completions');
  assert.equal(calls[0]?.body.model, 'Kimi-K3', 'trusted SCNet connection model must override stale UI default');
  assert.ok(Number(calls[0]?.body.max_tokens) >= 512, 'reasoning model must have enough output budget');
  assert.equal(
    payload.productionPlan?.providerRoutes?.find(route => route.stage === 'plan')?.ready,
    true,
  );
  assert.equal(
    payload.productionPlan?.providerRoutes?.find(route => route.stage === 'video')?.model,
    'happyhorse-1.1-t2v',
  );
  assert.equal(
    payload.productionPlan?.checkpoints?.find(checkpoint => checkpoint.id === 'reference_assets')?.status,
    'skipped',
    'T2V-only HappyHorse must not block the flow on an unusable reference-image checkpoint',
  );
  assert.ok(!JSON.stringify(payload).includes('fixture-key'), 'provider keys must never enter persisted payloads');

  const taskRoute = await import('../src/app/api/tasks/[taskId]/route');
  const taskHeaders = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': 'guest-creation-composite-provider-plan',
  };
  const approve = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${payload.taskId}`, {
    method: 'POST', headers: taskHeaders, body: JSON.stringify({ action: 'approve-production-plan' }),
  }), { params: Promise.resolve({ taskId: payload.taskId || '' }) });
  assert.equal(approve.status, 200, 'T2V-only plan must be approvable when the video route is ready');
  const confirm = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${payload.taskId}`, {
    method: 'POST', headers: taskHeaders, body: JSON.stringify({ action: 'confirm-production-external' }),
  }), { params: Promise.resolve({ taskId: payload.taskId || '' }) });
  const confirmed = await confirm.json() as { productionPlan?: { governance?: { status?: string }; estimatedCost?: { status?: string } } };
  assert.equal(confirm.status, 200);
  assert.equal(confirmed.productionPlan?.governance?.status, 'ready');
  assert.equal(confirmed.productionPlan?.estimatedCost?.status, 'confirmed');

  const streamed = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      ...taskHeaders,
      'x-yh-provider': 'openai-compatible',
      'x-yh-api-base': 'https://api.scnet.example/api/llm/v1',
      'x-yh-api-key': 'scnet-fixture-key',
      'x-yh-model': 'Kimi-K3',
      'x-yh-video-provider': 'happyhorse-dashscope',
      'x-yh-video-api-base': 'https://happyhorse.example/api/v1',
      'x-yh-video-api-key': 'happyhorse-fixture-key',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    },
    body: JSON.stringify({ phase: 'plan', prompt: '流式短剧规划测试', skillId: 'short-drama', stream: true }),
  }));
  const streamText = await streamed.text();
  assert.equal(streamed.status, 200);
  assert.match(streamText, /event: plan\.complete/);
  assert.doesNotMatch(streamText, /内部推理/, 'reasoning_content must not leak into the user stream');

  console.log(JSON.stringify({ ok: true, route: '/api/smart/vimax-agent-step', providers: ['Kimi-K3', 'happyhorse-1.1-t2v'] }));
}

main().finally(() => {
  globalThis.fetch = originalFetch;
  rmSync(taskFile, { force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
