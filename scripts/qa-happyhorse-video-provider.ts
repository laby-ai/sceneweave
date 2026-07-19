import {
  buildHappyHorsePublicTaskListUrl,
  buildHappyHorseVideoSubmitRequest,
  buildHappyHorseVideoTaskListUrl,
  buildHappyHorseVideoTaskUrl,
  getHappyHorseProviderErrorMessage,
  parseHappyHorseVideoStatus,
  parseHappyHorseVideoTaskList,
  parseHappyHorseVideoTaskId,
} from '../src/lib/happyhorse-video-provider';
import { getVideoStatusWithBYOK, submitVideoWithBYOK } from '../src/lib/byok-provider';
import { resolveVimaxProviderHandoffMode } from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';
import { selectHappyHorseR2VReferenceImages } from '../src/lib/skills/vimax-short-drama/happyhorse-vimax-video';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const connection = {
  apiBase: 'https://workspace.example.com/api/v1',
  apiKey: 'dummy-key',
};

const request = buildHappyHorseVideoSubmitRequest({
  ...connection,
  model: 'happyhorse-1.1-t2v',
  prompt: '同一演员走过雨夜街道，镜头保持向右运动。',
  duration: 5,
  ratio: '16:9',
  resolution: '720p',
  seed: 271828,
});

assert(
  request.url === 'https://workspace.example.com/api/v1/services/aigc/video-generation/video-synthesis',
  'HappyHorse submit URL mismatch',
);
assert(request.headers['X-DashScope-Async'] === 'enable', 'async header missing');
assert(request.headers.Authorization === 'Bearer dummy-key', 'authorization header mismatch');
assert(request.body.parameters.resolution === '720P', 'resolution must be normalized to 720P');
assert(request.body.parameters.duration === 5, 'duration mismatch');
assert(request.body.parameters.ratio === '16:9', 'ratio mismatch');
assert(request.body.parameters.seed === 271828, 'seed mismatch');
assert(
  buildHappyHorseVideoTaskUrl(connection.apiBase, 'task id') ===
    'https://workspace.example.com/api/v1/tasks/task%20id',
  'HappyHorse task URL mismatch',
);
assert(
  buildHappyHorseVideoTaskListUrl(connection.apiBase, {
    startTime: '20260719122000',
    endTime: '20260719124500',
    model: 'happyhorse-1.1-t2v',
  }) === 'https://workspace.example.com/api/v1/tasks/?start_time=20260719122000&end_time=20260719124500&model_name=happyhorse-1.1-t2v&status=SUCCEEDED&page_no=1&page_size=100',
  'HappyHorse task list URL mismatch',
);
assert(
  buildHappyHorsePublicTaskListUrl('https://workspace.example.com/api/v1/tasks/?status=SUCCEEDED') ===
    'https://dashscope.aliyuncs.com/api/v1/tasks/?status=SUCCEEDED',
  'HappyHorse public task list fallback URL mismatch',
);
const listed = parseHappyHorseVideoTaskList({
  data: [
    { task_id: 'task-b', status: 'SUCCEEDED', model_name: 'happyhorse-1.1-t2v', submit_time: '2026-07-19 12:32:00' },
    { task_id: 'task-a', status: 'SUCCEEDED', model_name: 'happyhorse-1.1-t2v', submit_time: '2026-07-19 12:30:00' },
  ],
});
assert(listed.length === 2, 'HappyHorse task list parse failed');
assert(listed[0]?.taskId === 'task-a' && listed[1]?.taskId === 'task-b', 'HappyHorse task list must be chronological');
assert(parseHappyHorseVideoTaskId({ output: { task_id: 'task-a' } }) === 'task-a', 'task id parse failed');

const running = parseHappyHorseVideoStatus({ output: { task_status: 'RUNNING' } });
assert(running.status === 'running', 'RUNNING status mismatch');

const succeeded = parseHappyHorseVideoStatus({
  output: {
    task_status: 'SUCCEEDED',
    results: [{ url: 'https://media.example.com/clip.mp4' }],
  },
});
assert(succeeded.status === 'succeeded', 'SUCCEEDED status mismatch');
assert(succeeded.videoUrl === 'https://media.example.com/clip.mp4', 'video URL parse failed');

const failed = parseHappyHorseVideoStatus({
  output: { task_status: 'FAILED', code: 'InvalidParameter', message: 'bad request' },
});
assert(failed.status === 'failed', 'FAILED status mismatch');
assert(failed.error === 'bad request', 'safe provider error mismatch');
assert(
  getHappyHorseProviderErrorMessage({ output: { code: 'InvalidParameter', message: 'request_id=secret-internal' } }, 400) ===
    '视频参数与当前模型不兼容，请检查模型、清晰度和时长。',
  'raw provider error must be mapped to a safe message',
);

const selectedReferences = selectHappyHorseR2VReferenceImages([
  {
    kind: 'shot-reference',
    shotIndex: 2,
    url: 'https://media.example.com/shot-2.png',
    selectedSubjectViews: [{
      subjectId: 'subject-1',
      label: '女记者正面',
      view: 'front',
      viewId: 'subject-1-front',
      url: 'https://media.example.com/character-front.png',
    }],
  },
  { kind: 'scene', url: 'https://media.example.com/scene.png' },
  { kind: 'shot-reference', shotIndex: 1, url: 'https://media.example.com/other-shot.png' },
], 2, 'https://media.example.com/previous-tail.png');
assert(
  JSON.stringify(selectedReferences) === JSON.stringify([
    'https://media.example.com/character-front.png',
    'https://media.example.com/shot-2.png',
    'https://media.example.com/scene.png',
    'https://media.example.com/previous-tail.png',
  ]),
  'R2V must select current-shot assets, global assets, then the previous tail without cross-shot leakage',
);

const saturatedReferences = selectHappyHorseR2VReferenceImages(
  Array.from({ length: 10 }, (_, index) => ({
    kind: index === 0 ? 'character' : 'reference',
    url: `https://media.example.com/reference-${index + 1}.png`,
  })),
  2,
  'https://media.example.com/previous-tail-priority.png',
);
assert(saturatedReferences.length === 9, 'R2V reference list must respect the provider limit');
assert(
  saturatedReferences.includes('https://media.example.com/previous-tail-priority.png'),
  'R2V must reserve a reference slot for the previous shot tail at the provider limit',
);

async function verifyProviderDispatch() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const payloads = [
    { output: { task_id: 'task-provider-a', task_status: 'PENDING' } },
    { output: { task_id: 'task-provider-a', task_status: 'SUCCEEDED', video_url: 'https://media.example.com/provider-a.mp4' } },
  ];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(payloads.shift()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const byokConnection = {
      provider: 'happyhorse-dashscope' as const,
      apiBase: connection.apiBase,
      apiKey: connection.apiKey,
      videoModel: 'happyhorse-1.1-t2v',
    };
    const task = await submitVideoWithBYOK(byokConnection, {
      prompt: '短剧镜头 A',
      duration: 5,
      ratio: '16:9',
      resolution: '高清',
      seed: 7,
    });
    const status = await getVideoStatusWithBYOK(byokConnection, task.taskId);
    const submitBody = JSON.parse(String(calls[0]?.init?.body || '{}'));
    assert(task.taskId === 'task-provider-a', 'BYOK HappyHorse task id mismatch');
    assert(submitBody.parameters.resolution === '720P', 'BYOK HappyHorse resolution mismatch');
    assert(calls[1]?.url.endsWith('/api/v1/tasks/task-provider-a'), 'BYOK HappyHorse poll route mismatch');
    assert(status.status === 'succeeded', 'BYOK HappyHorse final status mismatch');
    assert(status.videoUrl === 'https://media.example.com/provider-a.mp4', 'BYOK HappyHorse result mismatch');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function verifyR2VProviderDispatch() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ output: { task_id: 'task-r2v-a', task_status: 'PENDING' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const task = await submitVideoWithBYOK({
      provider: 'happyhorse-dashscope',
      apiBase: connection.apiBase,
      apiKey: connection.apiKey,
      videoModel: 'happyhorse-1.1-r2v',
    }, {
      prompt: '[Image 1] 沿用同一角色和服饰，承接上一镜动作继续向右行走。',
      duration: 5,
      ratio: '16:9',
      resolution: '720P',
      seed: 7,
      referenceImages: [
        'https://media.example.com/character-front.png',
        'https://media.example.com/scene.png',
      ],
      lastFrameImage: 'https://media.example.com/previous-tail.png',
    });
    const submitBody = JSON.parse(String(calls[0]?.init?.body || '{}'));
    assert(task.taskId === 'task-r2v-a', 'BYOK HappyHorse R2V task id mismatch');
    assert(submitBody.model === 'happyhorse-1.1-r2v', 'R2V model mismatch');
    assert(Array.isArray(submitBody.input?.media), 'R2V media array missing');
    assert(submitBody.input.media.length === 3, 'R2V reference image count mismatch');
    assert(submitBody.input.media.every((item: { type?: string }) => item.type === 'reference_image'), 'R2V media type mismatch');
    assert(submitBody.input.media[2]?.url === 'https://media.example.com/previous-tail.png', 'previous tail reference missing');

    const handoff = resolveVimaxProviderHandoffMode({
      provider: 'happyhorse-dashscope',
      model: 'happyhorse-1.1-r2v',
    });
    assert(handoff.mode === 'reference-handoff', 'R2V must use reference handoff mode');
    assert(handoff.supportsFirstFrame === false, 'R2V must not claim forced first-frame support');
    assert(handoff.supportsReferenceImages === true, 'R2V reference capability missing');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

verifyProviderDispatch().then(verifyR2VProviderDispatch).then(() => {
  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'dashscope-workspace-submit-contract',
      'resolution-normalization',
      'task-poll-url',
      'task-status-and-result-parsing',
      'safe-provider-error-mapping',
      'byok-provider-submit-and-poll-dispatch',
      'r2v-reference-media-dispatch',
      'r2v-reference-handoff-capability',
      'r2v-persisted-asset-and-tail-selection',
    ],
  }, null, 2));
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
