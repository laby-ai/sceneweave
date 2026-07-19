const HAPPYHORSE_SERVICE_PATH = '/services/aigc/video-generation/video-synthesis';

export interface HappyHorseVideoStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'unknown';
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
  rawStatus?: string;
}

export interface HappyHorseVideoRequestOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  prompt: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  watermark?: boolean;
  seed?: number;
}

export interface HappyHorseVideoSubmitRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    input: { prompt: string };
    parameters: {
      resolution: '720P' | '1080P';
      ratio: string;
      duration: number;
      watermark: boolean;
      seed?: number;
    };
  };
}

export interface HappyHorseVideoTaskListItem {
  taskId: string;
  model: string;
  status: string;
  submittedAt?: string;
}

function resolveHappyHorseApiRoot(apiBase: string): string {
  const url = new URL(apiBase.trim());
  const cleanPath = url.pathname.replace(/\/+$/, '');
  if (cleanPath.endsWith(HAPPYHORSE_SERVICE_PATH)) {
    url.pathname = cleanPath.slice(0, -HAPPYHORSE_SERVICE_PATH.length);
  } else if (cleanPath === '' || cleanPath === '/') {
    url.pathname = '/api/v1';
  } else {
    url.pathname = cleanPath;
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

function normalizeHappyHorseResolution(resolution?: string): '720P' | '1080P' {
  return String(resolution || '720P').toUpperCase() === '1080P' ? '1080P' : '720P';
}

function normalizeHappyHorseDuration(duration?: number): number {
  const seconds = Math.floor(Number(duration) || 5);
  return Math.max(1, Math.min(10, seconds));
}

export function buildHappyHorseVideoSubmitRequest(
  options: HappyHorseVideoRequestOptions,
): HappyHorseVideoSubmitRequest {
  const apiRoot = resolveHappyHorseApiRoot(options.apiBase);
  return {
    url: `${apiRoot}${HAPPYHORSE_SERVICE_PATH}`,
    headers: {
      'X-DashScope-Async': 'enable',
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: options.model,
      input: { prompt: options.prompt.trim() },
      parameters: {
        resolution: normalizeHappyHorseResolution(options.resolution),
        ratio: options.ratio || '16:9',
        duration: normalizeHappyHorseDuration(options.duration),
        watermark: options.watermark ?? false,
        ...(Number.isInteger(options.seed) ? { seed: options.seed } : {}),
      },
    },
  };
}

export function buildHappyHorseVideoTaskUrl(apiBase: string, taskId: string): string {
  return `${resolveHappyHorseApiRoot(apiBase)}/tasks/${encodeURIComponent(taskId)}`;
}

export function buildHappyHorseVideoTaskListUrl(
  apiBase: string,
  options: { startTime: string; endTime: string; model: string },
): string {
  const params = new URLSearchParams({
    start_time: options.startTime,
    end_time: options.endTime,
    model_name: options.model,
    status: 'SUCCEEDED',
    page_no: '1',
    page_size: '100',
  });
  return `${resolveHappyHorseApiRoot(apiBase)}/tasks/?${params.toString()}`;
}

function taskListTimestamp(value?: string) {
  if (!value) return Number.NaN;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return Date.parse(normalized);
}

export function parseHappyHorseVideoTaskList(payload: unknown): HappyHorseVideoTaskListItem[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: Array<Record<string, unknown>> }).data
    : [];
  return data.map(item => ({
    taskId: String(item.task_id || ''),
    model: String(item.model_name || ''),
    status: String(item.status || item.task_status || ''),
    submittedAt: typeof item.submit_time === 'string'
      ? item.submit_time
      : typeof item.created_at === 'string'
        ? item.created_at
        : undefined,
  })).filter(item => item.taskId)
    .sort((left, right) => taskListTimestamp(left.submittedAt) - taskListTimestamp(right.submittedAt));
}

export function parseHappyHorseVideoTaskId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as {
    task_id?: unknown;
    output?: { task_id?: unknown };
    data?: { task_id?: unknown };
  };
  return String(record.output?.task_id || record.data?.task_id || record.task_id || '');
}

function findResultUrl(payload: unknown, depth = 0): string | undefined {
  if (!payload || typeof payload !== 'object' || depth > 5) return undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findResultUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  for (const key of ['video_url', 'videoUrl', 'url']) {
    const value = record[key];
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return value;
  }
  for (const child of Object.values(record)) {
    const found = findResultUrl(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function findLastFrameUrl(payload: unknown, depth = 0): string | undefined {
  if (!payload || typeof payload !== 'object' || depth > 5) return undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findLastFrameUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  for (const key of ['last_frame_url', 'lastFrameUrl', 'tail_frame_url', 'tailFrameUrl']) {
    const value = record[key];
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return value;
  }
  for (const child of Object.values(record)) {
    const found = findLastFrameUrl(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function parseHappyHorseVideoStatus(payload: unknown): HappyHorseVideoStatus {
  if (!payload || typeof payload !== 'object') {
    return { status: 'unknown', error: '视频任务查询返回空响应' };
  }
  const record = payload as {
    task_status?: unknown;
    code?: unknown;
    message?: unknown;
    output?: { task_status?: unknown; code?: unknown; message?: unknown };
  };
  const rawStatus = String(record.output?.task_status || record.task_status || '').toUpperCase();
  const status: HappyHorseVideoStatus['status'] =
    rawStatus === 'SUCCEEDED' ? 'succeeded'
      : rawStatus === 'FAILED' || rawStatus === 'CANCELED' || rawStatus === 'CANCELLED' ? 'failed'
        : rawStatus === 'RUNNING' ? 'running'
          : rawStatus === 'PENDING' || rawStatus === 'QUEUED' ? 'queued'
            : 'unknown';
  const message = record.output?.message || record.message;
  return {
    status,
    rawStatus: rawStatus || undefined,
    videoUrl: findResultUrl(payload),
    lastFrameUrl: findLastFrameUrl(payload),
    error: typeof message === 'string' && message.trim() ? message.trim().slice(0, 400) : undefined,
  };
}

export function getHappyHorseProviderErrorMessage(payload: unknown, status: number): string {
  const parsed = parseHappyHorseVideoStatus(payload);
  const code = payload && typeof payload === 'object'
    ? String((payload as { code?: unknown; output?: { code?: unknown } }).output?.code || (payload as { code?: unknown }).code || '')
    : '';
  const detail = `${code} ${parsed.error || ''}`;
  if (/authentication|unauthorized|invalid.*key|10014/i.test(detail) || status === 401 || status === 403) {
    return 'API Key 无效或无权访问当前工作空间，请检查后重试。';
  }
  if (/quota|daily|200100/i.test(detail)) {
    return '当前账号的视频额度已用完，请在额度恢复后重试。';
  }
  if (/rate limit|too many|10011/i.test(detail) || status === 429) {
    return '请求过快，请稍后再试；已停止自动重复提交。';
  }
  if (/invalidparameter|invalid parameter/i.test(detail) || status === 400) {
    return '视频参数与当前模型不兼容，请检查模型、清晰度和时长。';
  }
  return `视频供应商暂时不可用（HTTP ${status}），请稍后重试。`;
}
