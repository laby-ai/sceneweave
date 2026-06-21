import { getVideoStatusWithBYOK, normalizeVideoPromptForArk } from '../src/lib/byok-provider';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ url: string; body: unknown }> = [];
const payloads = [
  {
    status: 'succeeded',
    content: {
      video_url: 'https://example.invalid/video-a.mp4',
      last_frame_url: 'https://example.invalid/last-a.jpg',
    },
  },
  {
    data: {
      status: 'succeeded',
      output: {
        video_url: 'https://example.invalid/video-b.mp4',
        last_frame_url: 'https://example.invalid/last-b.jpg',
      },
    },
  },
  {
    data: {
      status: 'succeeded',
      content: {
        videoUrl: 'https://example.invalid/video-c.mp4',
        tailFrameUrl: 'https://example.invalid/last-c.jpg',
      },
    },
  },
];

async function main() {
  const originalFetch = globalThis.fetch;
  let index = 0;

  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const body = payloads[index++];
    calls.push({ url: String(url), body });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const connection = {
      provider: 'ark-plan' as const,
      apiBase: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: 'dummy-key',
      videoModel: 'doubao-seedance-1-5-pro-251215',
    };

    const first = await getVideoStatusWithBYOK(connection, 'task-a');
    const second = await getVideoStatusWithBYOK(connection, 'task-b');
    const third = await getVideoStatusWithBYOK(connection, 'task-c');
    const longAuditPrompt = Array.from({ length: 24 }, (_, index) =>
      `【首尾帧合约】第 ${index + 1} 段必须保持同一女孩、红围巾、旧站台和蓝色手提箱连续；【桥接动作】上一段结尾的回头必须成为下一段开头。`
    ).join(' ');
    const normalizedPrompt = normalizeVideoPromptForArk(longAuditPrompt);

    assert(first.videoUrl === 'https://example.invalid/video-a.mp4', 'content.video_url should parse');
    assert(first.lastFrameUrl === 'https://example.invalid/last-a.jpg', 'content.last_frame_url should parse');
    assert(second.videoUrl === 'https://example.invalid/video-b.mp4', 'nested output.video_url should parse');
    assert(second.lastFrameUrl === 'https://example.invalid/last-b.jpg', 'nested output.last_frame_url should parse');
    assert(third.videoUrl === 'https://example.invalid/video-c.mp4', 'camelCase videoUrl should parse');
    assert(third.lastFrameUrl === 'https://example.invalid/last-c.jpg', 'tailFrameUrl should parse');
    assert(calls.every(call => call.url.includes('/contents/generations/tasks/')), 'Ark task status URL mismatch');
    assert(normalizedPrompt.length <= 1205, 'verbose audited prompt should be compacted before Ark submit');
    assert(!normalizedPrompt.includes('【首尾帧合约】'), 'audited prompt labels should be removed before Ark submit');

    console.log(JSON.stringify({
      ok: true,
      usedRealKey: false,
      incurredCost: false,
      checks: [
        'ark-status-content-video-url',
        'ark-status-content-last-frame-url',
        'ark-status-nested-output-last-frame-url',
        'ark-status-camelcase-tail-frame-url',
        'verbose-audited-prompt-compacted-before-ark-submit',
      ],
    }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main();
