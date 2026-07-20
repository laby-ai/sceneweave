import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  clearPlanningSessionConnection,
  formatProviderError,
  getBYOKRequestHeaders,
  getPlanningSessionConnectionSummary,
  saveHappyHorseSessionConnection,
  savePlanningSessionConnection,
  validateAndSavePlanningSessionConnection,
} from '../src/lib/byok-client';

const taskFile = path.join(tmpdir(), `sceneweave-planning-connection-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;
delete process.env.HUIYING_AGENTPLAN_ARK_API_KEY_PRIMARY;
delete process.env.HUIYING_AGENTPLAN_ARK_API_KEY_SECONDARY;
delete process.env.HUIYING_REAL_ARK_API_KEY;
delete process.env.ARK_API_KEY;

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const sessionStorage = createStorage();
const localStorage = createStorage();
Object.assign(globalThis, {
  window: {
    sessionStorage,
    localStorage,
    location: { pathname: '/sceneweave/embed/creation-agent', search: '', hash: '' },
  },
});

assert.deepEqual(getPlanningSessionConnectionSummary('paper-host:planning-default'), {
  configured: false,
  apiBase: '',
  model: 'Kimi-K3',
});

const scope = 'paper-host:planning-test';
savePlanningSessionConnection(scope, {
  apiBase: 'https://api.scnet.cn/api/llm/v1',
  apiKey: 'planning-secret',
  model: 'Kimi-K3',
});
saveHappyHorseSessionConnection(scope, {
  apiBase: 'https://video.example.com/api/v1',
  apiKey: 'video-secret',
  videoModel: 'happyhorse-1.1-t2v',
});

assert.deepEqual(getPlanningSessionConnectionSummary(scope), {
  configured: true,
  apiBase: 'https://api.scnet.cn/api/llm/v1',
  model: 'Kimi-K3',
});

const headers = getBYOKRequestHeaders(scope);
assert.equal(headers['x-yh-provider'], 'openai-compatible');
assert.equal(headers['x-yh-model'], 'Kimi-K3');
assert.equal(headers['x-yh-image-model'], 'Qwen-Image-2.0');
assert.equal(headers['x-yh-video-provider'], 'happyhorse-dashscope');
assert.equal(headers['x-yh-video-model'], 'happyhorse-1.1-t2v');
assert.equal(JSON.stringify(headers).includes('planning-secret'), true);
assert.equal(JSON.stringify(headers).includes('video-secret'), true);

clearPlanningSessionConnection(scope);
const fallbackHeaders = getBYOKRequestHeaders(scope);
assert.equal(fallbackHeaders['x-yh-provider'], undefined, 'video credentials must never become the planning connection');
assert.equal(fallbackHeaders['x-yh-api-key'], undefined, 'video credentials must not be sent in planning headers');
assert.equal(fallbackHeaders['x-yh-video-provider'], 'happyhorse-dashscope');
assert.equal(fallbackHeaders['x-yh-video-model'], 'happyhorse-1.1-t2v');
assert.equal(
  formatProviderError({
    provider: 'planning',
    code: 'planning_provider_auth_failed',
    error: 'upstream request_id=private-detail',
  }, '规划失败'),
  '规划模型连接不可用，请检查 API Base、API Key 和模型名后重试。',
  'planning errors must not expose upstream details',
);

async function verifyTransactionalClientSave() {
  const originalFetch = globalThis.fetch;
  const existingScope = 'paper-host:planning-transaction';
  savePlanningSessionConnection(existingScope, {
    apiBase: 'https://valid.example.com/v1',
    apiKey: 'existing-secret',
    model: 'existing-model',
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(input, '/sceneweave/api/smart/vimax-agent-step');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-yh-api-key'), 'invalid-secret');
    assert.equal(headers.get('x-yh-video-api-key'), null, 'connection validation must never send video credentials');
    return Response.json({
      success: false,
      ready: false,
      provider: 'planning',
      code: 'planning_provider_auth_failed',
      error: 'upstream request_id=private-detail',
    });
  }) as typeof fetch;
  try {
    const failed = await validateAndSavePlanningSessionConnection(existingScope, {
      apiBase: 'https://invalid.example.com/v1',
      apiKey: 'invalid-secret',
      model: 'invalid-model',
    }, { 'x-paper-host-guest-workspace': 'guest-planning-transaction' });
    assert.equal(failed.ok, false);
    assert.equal(failed.error, '规划模型连接不可用，请检查 API Base、API Key 和模型名后重试。');
    assert.deepEqual(getPlanningSessionConnectionSummary(existingScope), {
      configured: true,
      apiBase: 'https://valid.example.com/v1',
      model: 'existing-model',
    }, 'an invalid candidate must not overwrite the last valid connection');

    globalThis.fetch = (async () => Response.json({ success: true, ready: true, provider: 'planning' })) as typeof fetch;
    const saved = await validateAndSavePlanningSessionConnection(existingScope, {
      apiBase: 'https://next.example.com/v1',
      apiKey: 'next-secret',
      model: 'next-model',
    });
    assert.equal(saved.ok, true);
    assert.deepEqual(getPlanningSessionConnectionSummary(existingScope), {
      configured: true,
      apiBase: 'https://next.example.com/v1',
      model: 'next-model',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function verifyServerPlanningGate() {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = (async () => {
    providerCalls += 1;
    throw new Error('planning readiness must stop before provider fetch');
  }) as typeof fetch;

  try {
    const { NextRequest } = await import('next/server');
    const route = await import('../src/app/api/smart/vimax-agent-step/route');
    const headers = {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': 'guest-creation-planning-readiness-001',
      'x-yh-provider': 'happyhorse-dashscope',
      'x-yh-api-base': 'https://video.example.com/api/v1',
      'x-yh-api-key': 'video-secret',
      'x-yh-video-model': 'happyhorse-1.1-t2v',
    };
    const readinessResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers,
      body: JSON.stringify({ phase: 'planning_readiness' }),
    }));
    const readinessPayload = await readinessResponse.json() as { ready?: boolean; code?: string; error?: string };
    assert.equal(readinessResponse.status, 200);
    assert.equal(readinessPayload.ready, false);
    assert.equal(readinessPayload.code, 'planning_provider_unavailable');
    assert.doesNotMatch(readinessPayload.error || '', /video-secret|request_id|happyhorse/i);
    const response = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phase: 'plan',
        stream: true,
        prompt: '记者在雨夜车站寻找失踪的录音笔。',
        skillId: 'short-drama',
      }),
    }));
    const payload = await response.json() as { code?: string; error?: string; incurredCost?: boolean };
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'planning_provider_unavailable');
    assert.notEqual(payload.incurredCost, true);
    assert.doesNotMatch(payload.error || '', /video-secret|request_id|happyhorse/i);
    assert.equal(providerCalls, 0, 'planning readiness failure must not call text or video providers');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function verifyValidatedConnectionCanRetryPlan() {
  const originalFetch = globalThis.fetch;
  let modelDirectoryCalls = 0;
  let planningCalls = 0;
  let videoCalls = 0;
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
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/models')) {
      modelDirectoryCalls += 1;
      assert.equal(init?.method, 'GET');
      if (url.startsWith('https://auth-failed.example.com/')) {
        return Response.json({ error: 'request_id=private-upstream-detail' }, { status: 401 });
      }
      return Response.json({ data: [{ id: 'Qwen3.6-Plus' }, { id: 'Kimi-K3' }] });
    }
    if (url.endsWith('/chat/completions')) {
      planningCalls += 1;
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string };
      assert.equal(body.model, 'Qwen3.6-Plus');
      return Response.json({
        model: 'Qwen3.6-Plus',
        choices: [{ message: { content: planContent } }],
      });
    }
    videoCalls += 1;
    throw new Error(`unexpected provider call: ${url}`);
  }) as typeof fetch;

  try {
    const { NextRequest } = await import('next/server');
    const route = await import('../src/app/api/smart/vimax-agent-step/route');
    const headers = {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': 'guest-creation-planning-validation-001',
      'x-yh-provider': 'openai-compatible',
      'x-yh-api-base': 'https://planning.example.com/v1',
      'x-yh-api-key': 'fixture-planning-secret',
      'x-yh-model': 'Qwen3.6-Plus',
    };
    const validation = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers,
      body: JSON.stringify({ phase: 'planning_connection_validate' }),
    }));
    const validationPayload = await validation.json() as { ready?: boolean; error?: string };
    assert.equal(validation.status, 200);
    assert.equal(validationPayload.ready, true);

    const rejected = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers: { ...headers, 'x-yh-api-base': 'https://auth-failed.example.com/v1' },
      body: JSON.stringify({ phase: 'planning_connection_validate' }),
    }));
    const rejectedPayload = await rejected.json() as { ready?: boolean; code?: string; error?: string };
    assert.equal(rejected.status, 200, 'business validation failures must not create a failed browser request');
    assert.equal(rejectedPayload.ready, false);
    assert.equal(rejectedPayload.code, 'planning_provider_auth_failed');
    assert.doesNotMatch(rejectedPayload.error || '', /request_id|private-upstream-detail|fixture-planning-secret/);

    const plan = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phase: 'plan',
        prompt: '记者在雨夜车站寻找失踪的录音笔。',
        skillId: 'short-drama',
        stream: false,
      }),
    }));
    const planPayload = await plan.json() as {
      success?: boolean;
      taskId?: string;
      productionPlan?: { workflow?: { presetId?: string } };
    };
    assert.equal(plan.status, 200);
    assert.equal(planPayload.success, true);
    assert.ok(planPayload.taskId, 'the retried prompt must establish the authoritative production plan');
    assert.equal(planPayload.productionPlan?.workflow?.presetId, 'short-drama');
    assert.equal(modelDirectoryCalls, 2);
    assert.equal(planningCalls, 1);
    assert.equal(videoCalls, 0, 'planning validation and retry must never call the video provider');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

verifyTransactionalClientSave()
  .then(verifyServerPlanningGate)
  .then(verifyValidatedConnectionCanRetryPlan)
  .then(() => process.stdout.write(`${JSON.stringify({
    ok: true,
    path: 'validate candidate -> preserve last valid connection -> retry original plan',
    planningFixtureCalls: 1,
    videoProviderCalls: 0,
    incurredCost: false,
  })}\n`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(taskFile, { force: true });
  });
