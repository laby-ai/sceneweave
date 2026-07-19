import assert from 'node:assert/strict';

import {
  clearPlanningSessionConnection,
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
assert.equal(fallbackHeaders['x-yh-provider'], 'happyhorse-dashscope');
assert.equal(fallbackHeaders['x-yh-video-model'], 'happyhorse-1.1-t2v');

console.log('PASS planning and video connections share the existing SceneWeave request chain');
