import { isTransientBYOKVideoError, runWithBYOKVideoRetry } from '../src/lib/byok-retry';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const retryEvents: Array<{ attempt: number; delayMs: number; label?: string; transient: boolean }> = [];
let attempts = 0;

async function main() {
  const result = await runWithBYOKVideoRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('BYOK 视频提交失败：{"code":"QuotaExceeded","message":"The request has exceeded the quota"}');
      }
      return { videoUrl: 'https://example.invalid/video.mp4' };
    },
    {
      label: 'segment-qa',
      policy: { maxRetries: 2, baseDelayMs: 5, maxDelayMs: 10 },
      onRetry: event => retryEvents.push({
        attempt: event.attempt,
        delayMs: event.delayMs,
        label: event.label,
        transient: isTransientBYOKVideoError(event.error),
      }),
      sleep: async () => {},
    },
  );

  assert(result.videoUrl === 'https://example.invalid/video.mp4', 'retry result mismatch');
  assert(attempts === 2, `expected 2 attempts, got ${attempts}`);
  assert(retryEvents.length === 1, `expected 1 retry event, got ${retryEvents.length}`);
  assert(retryEvents[0].transient === true, 'retry event should be transient');
  assert(isTransientBYOKVideoError(new Error('HTTP 429 Too Many Requests')) === true, '429 should be transient');
  assert(isTransientBYOKVideoError(new Error('invalid api key')) === false, 'invalid key should not be transient');

  console.log(JSON.stringify({
    ok: true,
    attempts,
    retryEvents,
    usedRealKey: false,
    incurredCost: false,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
