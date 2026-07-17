export interface SCNetVideoSubmitInput {
  apiBase: string;
  apiKey: string;
  model: string;
  prompt: string;
  duration: number;
  ratio: string;
  resolution: string;
  watermark: boolean;
}

export interface SCNetVideoSubmitRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    input: { prompt: string };
    parameters: {
      resolution: string;
      ratio: string;
      duration: number;
      watermark: boolean;
    };
  };
}

export interface SCNetVideoStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'unknown';
  rawStatus?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
}

function trimApiBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/, '');
}

export function isSCNetVideoApiBase(apiBase: string): boolean {
  try {
    const url = new URL(trimApiBase(apiBase));
    return url.hostname.toLowerCase() === 'api.scnet.cn' && /\/api\/llm\/v1$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function buildSCNetVideoSubmitRequest(input: SCNetVideoSubmitInput): SCNetVideoSubmitRequest {
  const resolution = input.resolution.trim();
  if (resolution !== '720p' && resolution !== '1080p') {
    throw new Error('SCNet 视频分辨率仅支持 720p 或 1080p');
  }
  if (!Number.isFinite(input.duration) || input.duration < 4 || input.duration > 15) {
    throw new Error('SCNet 视频时长必须在 4 到 15 秒之间');
  }

  return {
    url: `${trimApiBase(input.apiBase)}/videos/generations`,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'X-MultiModal-Async': 'true',
    },
    body: {
      model: input.model,
      input: { prompt: input.prompt.trim() },
      parameters: {
        resolution,
        ratio: input.ratio,
        duration: input.duration,
        watermark: input.watermark,
      },
    },
  };
}

export function buildSCNetVideoTaskUrl(apiBase: string, taskId: string): string {
  return `${trimApiBase(apiBase)}/tasks/${encodeURIComponent(taskId)}`;
}

export function parseSCNetVideoTaskId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as {
    task_id?: unknown;
    id?: unknown;
    data?: { task_id?: unknown; id?: unknown };
    output?: { task_id?: unknown; id?: unknown };
  };
  return String(
    record.task_id
    || record.id
    || record.data?.task_id
    || record.data?.id
    || record.output?.task_id
    || record.output?.id
    || '',
  );
}

function normalizeStatus(value: unknown): SCNetVideoStatus['status'] {
  const status = String(value || '').toLowerCase();
  if (['pending', 'queued', 'submitted', 'created'].includes(status)) return 'queued';
  if (['running', 'processing', 'in_progress'].includes(status)) return 'running';
  if (['succeeded', 'success', 'completed', 'done'].includes(status)) return 'succeeded';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return 'unknown';
}

function findString(value: unknown, keys: ReadonlySet<string>, depth = 0): string | undefined {
  if (!value || typeof value !== 'object' || depth > 6) return undefined;
  const record = value as Record<string, unknown>;
  for (const [key, direct] of Object.entries(record)) {
    if (keys.has(key) && typeof direct === 'string' && direct.trim()) return direct.trim();
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') {
      const found = findString(child, keys, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

export function parseSCNetVideoStatus(payload: unknown): SCNetVideoStatus {
  if (!payload || typeof payload !== 'object') {
    return { status: 'unknown', error: 'SCNet 视频任务查询返回空响应' };
  }
  const record = payload as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : undefined;
  const output = record.output && typeof record.output === 'object'
    ? record.output as Record<string, unknown>
    : undefined;
  const rawStatus = record.status || nested?.status || output?.task_status || output?.status;
  const error = findString(payload, new Set(['error_message', 'error', 'message', 'detail']));
  const firstResult = Array.isArray(output?.results)
    ? output.results.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : undefined;

  return {
    status: normalizeStatus(rawStatus),
    rawStatus: rawStatus ? String(rawStatus) : undefined,
    videoUrl: firstResult || findString(payload, new Set(['video_url', 'videoUrl', 'url'])),
    lastFrameUrl: findString(payload, new Set([
      'last_frame_url',
      'lastFrameUrl',
      'tail_frame_url',
      'tailFrameUrl',
    ])),
    error,
  };
}

export function getSCNetProviderErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `HTTP ${status}`;
  const record = payload as Record<string, unknown>;
  const message = [record.msg, record.message, record.error_message, record.error]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const code = typeof record.code === 'string' || typeof record.code === 'number'
    ? String(record.code)
    : '';
  if (message && code) return `${message.trim()} (code ${code})`;
  return message?.trim() || `HTTP ${status}`;
}

export function sanitizeSCNetProviderError(message: string, apiKey?: string): string {
  let sanitized = String(message || 'SCNet 视频服务返回未知错误');
  if (apiKey) sanitized = sanitized.split(apiKey).join('[REDACTED]');
  return sanitized
    .replace(/Bearer\s+[A-Za-z0-9._=\-]+/gi, 'Bearer [REDACTED]')
    .replace(/request[_ -]?id\s*[=:]\s*[^\s;,]+/gi, 'request_id=[REDACTED]')
    .slice(0, 500);
}
