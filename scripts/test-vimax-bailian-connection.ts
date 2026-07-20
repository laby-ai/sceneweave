import assert from 'node:assert/strict';

import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_PLANNING_MODEL,
  DEFAULT_VIDEO_MODEL,
  getBYOKRequestHeaders,
  resolveBailianApiBases,
  validateAndSaveBailianSessionConnections,
} from '../src/lib/byok-client';
import { imageWithBYOK } from '../src/lib/byok-provider';

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();
  get length() { return this.entries.size; }
  clear() { this.entries.clear(); }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string) { this.entries.delete(key); }
  setItem(key: string, value: string) { this.entries.set(key, value); }
}

assert.equal(DEFAULT_PLANNING_MODEL, 'qwen3.7-plus');
assert.equal(DEFAULT_IMAGE_MODEL, 'wan2.7-image');
assert.equal(DEFAULT_VIDEO_MODEL, 'happyhorse-1.1-r2v');
assert.deepEqual(resolveBailianApiBases('https://workspace.example.com'), {
  apiHost: 'https://workspace.example.com',
  planningApiBase: 'https://workspace.example.com/compatible-mode/v1',
  videoApiBase: 'https://workspace.example.com/api/v1',
});
assert.deepEqual(resolveBailianApiBases('https://workspace.example.com/api/v1'), {
  apiHost: 'https://workspace.example.com',
  planningApiBase: 'https://workspace.example.com/compatible-mode/v1',
  videoApiBase: 'https://workspace.example.com/api/v1',
});

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    location: { pathname: '/sceneweave/embed/creation-agent' },
  },
});

const originalFetch = globalThis.fetch;
let validationCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  validationCalls += 1;
  assert.match(String(input), /api\/smart\/vimax-agent-step$/);
  const headers = new Headers(init?.headers);
  assert.equal(headers.get('x-yh-api-base'), 'https://workspace.example.com/compatible-mode/v1');
  assert.equal(headers.get('x-yh-model'), DEFAULT_PLANNING_MODEL);
  assert.equal(headers.get('x-yh-image-model'), DEFAULT_IMAGE_MODEL);
  return Response.json({ ready: true });
}) as typeof fetch;

async function main() {
try {
  const result = await validateAndSaveBailianSessionConnections('guest-bailian', {
    apiHost: 'https://workspace.example.com/api/v1',
    apiKey: 'fixture-key',
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(validationCalls, 1);
  const headers = getBYOKRequestHeaders('guest-bailian');
  assert.equal(headers['x-yh-provider'], 'openai-compatible');
  assert.equal(headers['x-yh-api-base'], 'https://workspace.example.com/compatible-mode/v1');
  assert.equal(headers['x-yh-model'], DEFAULT_PLANNING_MODEL);
  assert.equal(headers['x-yh-image-model'], DEFAULT_IMAGE_MODEL);
  assert.equal(headers['x-yh-video-provider'], 'happyhorse-dashscope');
  assert.equal(headers['x-yh-video-api-base'], 'https://workspace.example.com/api/v1');
  assert.equal(headers['x-yh-video-model'], DEFAULT_VIDEO_MODEL);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(
      String(input),
      'https://workspace.example.com/api/v1/services/aigc/multimodal-generation/generation',
    );
    const body = JSON.parse(String(init?.body || '{}')) as {
      model?: string;
      input?: { messages?: Array<{ content?: Array<{ text?: string }> }> };
      parameters?: { size?: string; n?: number; watermark?: boolean };
    };
    assert.equal(body.model, DEFAULT_IMAGE_MODEL);
    assert.deepEqual(body.input?.messages?.[0]?.content, [
      { image: 'https://media.example.com/reference.png' },
      { text: 'fixture image' },
    ]);
    assert.deepEqual(body.parameters, { size: '1696*960', n: 1, watermark: false });
    return Response.json({
      output: {
        choices: [{ message: { content: [{ type: 'image', image: 'https://media.example.com/result.png' }] } }],
      },
    });
  }) as typeof fetch;
  const image = await imageWithBYOK({
    provider: 'openai-compatible',
    apiBase: headers['x-yh-api-base'],
    apiKey: 'fixture-key',
    imageModel: headers['x-yh-image-model'],
  }, {
    prompt: 'fixture image',
    size: '1696x960',
    referenceImages: ['https://media.example.com/reference.png'],
  });
  assert.deepEqual(image, {
    url: 'https://media.example.com/result.png',
    model: DEFAULT_IMAGE_MODEL,
    provider: 'byok',
  });
} finally {
  globalThis.fetch = originalFetch;
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  path: 'one Bailian workspace connection -> planning + image + video headers',
  planningModel: DEFAULT_PLANNING_MODEL,
  imageModel: DEFAULT_IMAGE_MODEL,
  videoModel: DEFAULT_VIDEO_MODEL,
  wanImageAdapterCalls: 1,
  providerVideoCalls: 0,
})}\n`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
