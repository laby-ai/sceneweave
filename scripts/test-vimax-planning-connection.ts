import assert from 'node:assert/strict';

import {
  clearPlanningSessionConnection,
  formatProviderError,
  getBYOKRequestHeaders,
  getPlanningSessionConnectionSummary,
  saveHappyHorseSessionConnection,
  savePlanningSessionConnection,
} from '../src/lib/byok-client';

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
Object.assign(globalThis, { window: { sessionStorage, localStorage } });

assert.deepEqual(getPlanningSessionConnectionSummary('paper-host:planning-default'), {
  configured: false,
  apiBase: '',
  model: 'Qwen3.6-Plus',
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

verifyServerPlanningGate()
  .then(() => process.stdout.write(`${JSON.stringify({
    ok: true,
    path: 'planning readiness -> input-safe retry',
    providerCalls: 0,
    incurredCost: false,
  })}\n`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
