export interface BYOKVideoRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface BYOKVideoRetryEvent {
  attempt: number;
  delayMs: number;
  error: Error;
  label?: string;
}

function toBoundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.round(numberValue), min), max);
}

export function getBYOKVideoRetryPolicy(): BYOKVideoRetryPolicy {
  return {
    maxRetries: toBoundedInteger(process.env.HUIYING_BYOK_VIDEO_RETRY_ATTEMPTS, 2, 0, 5),
    baseDelayMs: toBoundedInteger(process.env.HUIYING_BYOK_VIDEO_RETRY_BASE_MS, 45_000, 1_000, 300_000),
    maxDelayMs: toBoundedInteger(process.env.HUIYING_BYOK_VIDEO_RETRY_MAX_MS, 180_000, 1_000, 600_000),
  };
}

export function isTransientBYOKVideoError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /QuotaExceeded|TooManyRequests|rate.?limit|too many requests|HTTP\s*429|exceeded the quota/i.test(message);
}

function retryDelayMs(policy: BYOKVideoRetryPolicy, attempt: number) {
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * attempt);
}

export async function runWithBYOKVideoRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    label?: string;
    policy?: BYOKVideoRetryPolicy;
    onRetry?: (event: BYOKVideoRetryEvent) => void;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const policy = options.policy || getBYOKVideoRetryPolicy();
  const sleep = options.sleep || ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxRetries + 1; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isTransientBYOKVideoError(error) || attempt > policy.maxRetries) {
        throw error;
      }
      const delayMs = retryDelayMs(policy, attempt);
      options.onRetry?.({
        attempt,
        delayMs,
        error: error instanceof Error ? error : new Error(String(error || '未知 BYOK 视频错误')),
        label: options.label,
      });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
