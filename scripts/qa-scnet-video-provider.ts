import assert from 'node:assert/strict';

import {
  buildSCNetVideoSubmitRequest,
  getSCNetProviderErrorMessage,
  parseSCNetVideoStatus,
  parseSCNetVideoTaskId,
  sanitizeSCNetProviderError,
} from '../src/lib/scnet-video-provider';
import { extractBYOKConnection } from '../src/lib/byok-provider';

const apiKey = 'fixture-secret';
const request = buildSCNetVideoSubmitRequest({
  apiBase: 'https://api.scnet.cn/api/llm/v1',
  apiKey,
  model: 'Seedance2.0',
  prompt: 'A cobalt glass sphere rotates in a silver studio.',
  duration: 5,
  ratio: '16:9',
  resolution: '720p',
  watermark: false,
});

assert.equal(request.url, 'https://api.scnet.cn/api/llm/v1/videos/generations');
assert.equal(request.headers.Authorization, `Bearer ${apiKey}`);
assert.equal(request.headers['X-MultiModal-Async'], 'true');
assert.deepEqual(request.body, {
  model: 'Seedance2.0',
  input: {
    prompt: 'A cobalt glass sphere rotates in a silver studio.',
  },
  parameters: {
    resolution: '720p',
    ratio: '16:9',
    duration: 5,
    watermark: false,
  },
});

assert.throws(
  () => buildSCNetVideoSubmitRequest({
    apiBase: 'https://api.scnet.cn/api/llm/v1',
    apiKey,
    model: 'Seedance2.0',
    prompt: 'too short',
    duration: 3,
    ratio: '16:9',
    resolution: '720p',
    watermark: false,
  }),
  /4 到 15 秒/,
);

assert.equal(
  parseSCNetVideoTaskId({ task_id: 'task-a', status: 'pending' }),
  'task-a',
);

const previousSCNetKey = process.env.SCNET_API_KEY;
const previousSCNetEnabled = process.env.SCNET_VIDEO_ENABLED;
process.env.SCNET_API_KEY = apiKey;
delete process.env.SCNET_VIDEO_ENABLED;
assert.notEqual(
  extractBYOKConnection(new Headers())?.apiBase,
  'https://api.scnet.cn/api/llm/v1',
  'SCNet must remain opt-in for the production fallback',
);
process.env.SCNET_VIDEO_ENABLED = 'true';
assert.equal(
  extractBYOKConnection(new Headers())?.apiBase,
  'https://api.scnet.cn/api/llm/v1',
);
if (previousSCNetKey === undefined) delete process.env.SCNET_API_KEY;
else process.env.SCNET_API_KEY = previousSCNetKey;
if (previousSCNetEnabled === undefined) delete process.env.SCNET_VIDEO_ENABLED;
else process.env.SCNET_VIDEO_ENABLED = previousSCNetEnabled;
assert.equal(
  parseSCNetVideoTaskId({ data: { task_id: 'task-b' } }),
  'task-b',
);
assert.equal(
  parseSCNetVideoTaskId({ output: { task_id: 'task-c', task_status: 'pending' } }),
  'task-c',
);

assert.deepEqual(
  parseSCNetVideoStatus({
    task_id: 'task-a',
    output: {
      task_status: 'succeeded',
      results: ['https://example.invalid/segment-a.mp4'],
    },
  }),
  {
    status: 'succeeded',
    rawStatus: 'succeeded',
    videoUrl: 'https://example.invalid/segment-a.mp4',
    lastFrameUrl: undefined,
    error: undefined,
  },
);

const sanitized = sanitizeSCNetProviderError(
  `upstream rejected Authorization: Bearer ${apiKey}; request_id=req-internal`,
  apiKey,
);
assert(!sanitized.includes(apiKey), 'SCNet error leaked the API key');
assert(!sanitized.includes('req-internal'), 'SCNet error leaked the upstream request id');
assert.equal(
  getSCNetProviderErrorMessage({ code: '10007', msg: 'Concurrency conflict for request' }, 433),
  'Concurrency conflict for request (code 10007)',
);

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'scnet-async-video-submit-shape',
    'five-second-duration',
    '720p-production-resolution',
    'task-id-shapes',
    'task-success-video-url',
    'provider-error-secret-redaction',
  ],
}, null, 2));
