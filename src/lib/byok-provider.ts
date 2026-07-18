import { normalizeBYOKApiBase } from '@/lib/byok-url';
import {
  buildSCNetVideoSubmitRequest,
  buildSCNetVideoTaskUrl,
  getSCNetProviderErrorMessage,
  isSCNetVideoApiBase,
  parseSCNetVideoStatus,
  parseSCNetVideoTaskId,
  sanitizeSCNetProviderError,
} from '@/lib/scnet-video-provider';
import {
  buildHappyHorseVideoSubmitRequest,
  buildHappyHorseVideoTaskUrl,
  getHappyHorseProviderErrorMessage,
  parseHappyHorseVideoStatus,
  parseHappyHorseVideoTaskId,
} from '@/lib/happyhorse-video-provider';

export type BYOKProviderType = 'openai-compatible' | 'ark-plan' | 'happyhorse-dashscope';

export interface BYOKConnection {
  provider: BYOKProviderType;
  apiBase: string;
  apiKey: string;
  model?: string;
  imageModel?: string;
  videoModel?: string;
}

export interface BYOKChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BYOKChatParams {
  messages: BYOKChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface BYOKImageParams {
  prompt: string;
  model?: string;
  size?: string;
  n?: number;
}

export interface BYOKVideoParams {
  prompt: string;
  model?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  cameraFixed?: boolean;
  firstFrameImage?: string;
  lastFrameImage?: string;
  referenceImages?: string[];
  seed?: number;
}

export interface BYOKVideoTask {
  taskId: string;
  model: string;
  provider: 'byok';
  statusUrl: string;
}

export interface BYOKVideoStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'unknown';
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
  rawStatus?: string;
}

function apiBaseHasVersionPath(apiBase: string): boolean {
  const pathname = new URL(apiBase).pathname.replace(/\/+$/, '');
  return /\/v\d+(?:\/.*)?$/.test(pathname) || pathname.endsWith('/v1') || pathname.endsWith('/v3');
}

function buildChatCompletionsUrl(apiBase: string): string {
  return apiBaseHasVersionPath(apiBase) ? `${apiBase}/chat/completions` : `${apiBase}/v1/chat/completions`;
}

function buildImageGenerationsUrl(apiBase: string): string {
  return apiBaseHasVersionPath(apiBase) ? `${apiBase}/images/generations` : `${apiBase}/v1/images/generations`;
}

function buildArkVideoTasksUrl(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  if (/\/contents\/generations\/tasks$/.test(base)) return base;
  if (/\/api\/plan\/v3$/.test(base) || /\/v3$/.test(base)) {
    return `${base}/contents/generations/tasks`;
  }
  return `${base}/api/v3/contents/generations/tasks`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text.slice(0, 200);
  }
}

function payloadError(payload: unknown, status: number): string {
  return typeof payload === 'object' && payload && 'error' in payload
    ? JSON.stringify((payload as { error: unknown }).error)
    : `HTTP ${status}`;
}

export function extractBYOKConnection(headers: Headers): BYOKConnection | undefined {
  const provider = headers.get('x-yh-provider')?.trim();
  const apiBase = headers.get('x-yh-api-base')?.trim();
  const apiKey = headers.get('x-yh-api-key')?.trim();
  const model = headers.get('x-yh-model')?.trim() || undefined;
  const imageModel = headers.get('x-yh-image-model')?.trim() || undefined;
  const videoModel = headers.get('x-yh-video-model')?.trim() || undefined;

  if (
    provider && apiBase && apiKey &&
    (provider === 'openai-compatible' || provider === 'ark-plan' || provider === 'happyhorse-dashscope')
  ) {
    return { provider, apiBase: normalizeBYOKApiBase(apiBase), apiKey, model, imageModel, videoModel };
  }

  const scnetKey = (process.env.SCNET_API_KEY || '').trim();
  const scnetEnabled = (process.env.SCNET_VIDEO_ENABLED || '').trim().toLowerCase() === 'true';
  if (scnetEnabled && scnetKey) {
    return {
      provider: 'ark-plan',
      apiBase: (process.env.SCNET_API_BASE || 'https://api.scnet.cn/api/llm/v1').trim(),
      apiKey: scnetKey,
      videoModel: (process.env.SCNET_VIDEO_MODEL || 'Seedance2.0').trim(),
    };
  }

  // Server-side default ARK fallback: use env-configured ARK key for direct Volcano access.
  const envKey = (process.env.ARK_IMAGE_API_KEY || process.env.ARK_API_KEY || '').trim();
  const envBase = (process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3').trim();
  // Use direct /api/v3 instead of /api/plan/v3 for direct Volcano access (not agentplan).
  const directBase = envBase.replace('/api/plan/v3', '/api/v3');
  if (envKey) {
    return {
      provider: 'ark-plan',
      apiBase: directBase,
      apiKey: envKey,
      model: (process.env.ARK_AGENT_MODEL || 'doubao-seed-1-6-250615').trim(),
      imageModel: (process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-0-260128').trim(),
      videoModel: (process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215').trim(),
    };
  }

  return undefined;
}

export async function chatWithBYOK(
  connection: BYOKConnection,
  params: BYOKChatParams
): Promise<{ content: string; model: string; provider: 'byok' }> {
  const model = params.model || connection.model;
  if (!model) {
    throw new Error('BYOK 文本调用缺少默认模型');
  }

  const url = buildChatCompletionsUrl(connection.apiBase);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
    }),
  });

  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(`BYOK 文本调用失败：${payloadError(payload, response.status)}`);
  }

  const content =
    typeof payload === 'object' &&
    payload &&
    'choices' in payload &&
    Array.isArray((payload as { choices: unknown }).choices)
      ? ((payload as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content || '')
      : '';

  if (!content) {
    throw new Error('BYOK 文本调用未返回内容');
  }

  return { content, model, provider: 'byok' };
}

export async function imageWithBYOK(
  connection: BYOKConnection,
  params: BYOKImageParams
): Promise<{ url: string; model: string; provider: 'byok' }> {
  const model = params.model || connection.imageModel || connection.model;
  if (!model) {
    throw new Error('BYOK 图片调用缺少默认模型');
  }

  const url = buildImageGenerationsUrl(connection.apiBase);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: params.prompt,
      size: params.size || '1024x1024',
      n: params.n ?? 1,
    }),
  });

  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(`BYOK 图片调用失败：${payloadError(payload, response.status)}`);
  }

  const firstImage =
    typeof payload === 'object' &&
    payload &&
    'data' in payload &&
    Array.isArray((payload as { data: unknown }).data)
      ? (payload as { data: Array<{ url?: string; b64_json?: string }> }).data[0]
      : undefined;

  const imageUrl = firstImage?.url || (firstImage?.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : '');
  if (!imageUrl) {
    throw new Error('BYOK 图片调用未返回图像');
  }

  return { url: imageUrl, model, provider: 'byok' };
}

function extractTaskId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as {
    id?: unknown;
    task_id?: unknown;
    data?: { id?: unknown; task_id?: unknown };
  };
  return String(data.id || data.task_id || data.data?.id || data.data?.task_id || '');
}

function normalizeTaskStatus(status: unknown): BYOKVideoStatus['status'] {
  const value = String(status || '').toLowerCase();
  if (['queued', 'pending', 'submitted', 'created'].includes(value)) return 'queued';
  if (['running', 'processing', 'in_progress'].includes(value)) return 'running';
  if (['succeeded', 'success', 'completed', 'done'].includes(value)) return 'succeeded';
  if (['failed', 'fail', 'error', 'cancelled', 'canceled'].includes(value)) return 'failed';
  return 'unknown';
}

function findStringByKeys(value: unknown, keys: string[], depth = 0): string | undefined {
  if (!value || typeof value !== 'object' || depth > 5) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
  }
  for (const child of Object.values(record)) {
    if (!child || typeof child !== 'object') continue;
    const found = findStringByKeys(child, keys, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function normalizeVideoPromptForArk(prompt: string): string {
  const compact = String(prompt || '')
    .replace(/【[^】]{1,28}】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (compact.length <= 1200) return compact;

  const opening = compact.slice(0, 850);
  const ending = compact.slice(-280);
  return `${opening} ... ${ending}`;
}

function extractVideoStatus(payload: unknown): BYOKVideoStatus {
  if (!payload || typeof payload !== 'object') {
    return { status: 'unknown', error: '视频任务查询返回空响应' };
  }

  const data = payload as {
    status?: unknown;
    error?: unknown;
    error_message?: unknown;
    message?: unknown;
    content?: { video_url?: unknown; last_frame_url?: unknown };
    output?: { video_url?: unknown; url?: unknown };
    data?: {
      status?: unknown;
      error?: unknown;
      error_message?: unknown;
      message?: unknown;
      content?: { video_url?: unknown; last_frame_url?: unknown };
      output?: { video_url?: unknown; url?: unknown };
    };
  };

  const rawStatus = data.status || data.data?.status;
  const status = normalizeTaskStatus(rawStatus);
  const videoUrl = findStringByKeys(payload, [
    'video_url',
    'videoUrl',
    'url',
  ]);
  const lastFrameUrl = findStringByKeys(payload, [
    'last_frame_url',
    'lastFrameUrl',
    'last_frame',
    'tail_frame_url',
    'tailFrameUrl',
    'end_frame_url',
    'endFrameUrl',
    'last_image_url',
    'lastImageUrl',
  ]);
  const error = data.error_message || data.data?.error_message || data.error || data.data?.error || data.message || data.data?.message;

  return {
    status,
    rawStatus: rawStatus ? String(rawStatus) : undefined,
    videoUrl: videoUrl ? String(videoUrl) : undefined,
    lastFrameUrl: lastFrameUrl ? String(lastFrameUrl) : undefined,
    error: error ? (typeof error === 'string' ? error : JSON.stringify(error)) : undefined,
  };
}

export async function submitVideoWithBYOK(
  connection: BYOKConnection,
  params: BYOKVideoParams
): Promise<BYOKVideoTask> {
  const model = params.model || connection.videoModel || connection.model;
  if (!model) {
    throw new Error('BYOK 视频调用缺少视频模型');
  }

  if (connection.provider === 'happyhorse-dashscope') {
    if (params.firstFrameImage || params.lastFrameImage || params.referenceImages?.length) {
      throw new Error('快乐马 1.1 当前文本生成视频契约不支持首尾帧或参考图，已停止而非静默忽略');
    }
    const request = buildHappyHorseVideoSubmitRequest({
      apiBase: connection.apiBase,
      apiKey: connection.apiKey,
      model,
      prompt: params.prompt,
      duration: params.duration,
      ratio: params.ratio,
      resolution: params.resolution,
      watermark: params.watermark,
      seed: params.seed,
    });
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    });
    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(`快乐马视频提交失败：${getHappyHorseProviderErrorMessage(payload, response.status)}`);
    }
    const taskId = parseHappyHorseVideoTaskId(payload);
    if (!taskId) throw new Error('快乐马视频提交未返回任务 ID');
    return {
      taskId,
      model,
      provider: 'byok',
      statusUrl: buildHappyHorseVideoTaskUrl(connection.apiBase, taskId),
    };
  }

  if (connection.provider !== 'ark-plan') {
    throw new Error('当前 BYOK 视频生成仅支持 Ark Plan 或快乐马工作空间');
  }

  if (isSCNetVideoApiBase(connection.apiBase)) {
    if (params.firstFrameImage || params.lastFrameImage || params.referenceImages?.length) {
      throw new Error('SCNet 当前接入仅支持文本生成视频，暂不静默忽略首尾帧或参考图');
    }
    const request = buildSCNetVideoSubmitRequest({
      apiBase: connection.apiBase,
      apiKey: connection.apiKey,
      model,
      prompt: params.prompt,
      duration: params.duration ?? 5,
      ratio: params.ratio || '16:9',
      resolution: params.resolution || '720p',
      watermark: params.watermark ?? false,
    });
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    });
    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(`SCNet 视频提交失败：${sanitizeSCNetProviderError(getSCNetProviderErrorMessage(payload, response.status), connection.apiKey)}`);
    }
    const taskId = parseSCNetVideoTaskId(payload);
    if (!taskId) throw new Error('SCNet 视频提交未返回任务 ID');
    return {
      taskId,
      model,
      provider: 'byok',
      statusUrl: buildSCNetVideoTaskUrl(connection.apiBase, taskId),
    };
  }

  const taskUrl = buildArkVideoTasksUrl(connection.apiBase);
  const content: Array<{ type: string; text?: string; image_url?: { url: string }; role?: string }> = [];
  content.push({ type: 'text', text: normalizeVideoPromptForArk(params.prompt) });
  if (params.firstFrameImage) {
    content.push({ type: 'image_url', image_url: { url: params.firstFrameImage }, role: 'first_frame' });
  }
  if (params.lastFrameImage) {
    content.push({ type: 'image_url', image_url: { url: params.lastFrameImage }, role: 'last_frame' });
  }
  for (const refUrl of params.referenceImages?.slice(0, 3) || []) {
    content.push({ type: 'image_url', image_url: { url: refUrl }, role: 'reference_image' });
  }

  const response = await fetch(taskUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      content,
      ratio: params.ratio || '16:9',
      duration: params.duration,
      ...(params.resolution ? { resolution: params.resolution } : {}),
      generate_audio: params.generateAudio ?? false,
      watermark: params.watermark ?? false,
      ...(typeof params.cameraFixed === 'boolean' ? { camera_fixed: params.cameraFixed } : {}),
    }),
  });

  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(`BYOK 视频提交失败：${payloadError(payload, response.status)}`);
  }

  const taskId = extractTaskId(payload);
  if (!taskId) {
    throw new Error('BYOK 视频提交未返回任务 ID');
  }

  return {
    taskId,
    model,
    provider: 'byok',
    statusUrl: `${taskUrl}/${encodeURIComponent(taskId)}`,
  };
}

export async function getVideoStatusWithBYOK(
  connection: BYOKConnection,
  taskId: string
): Promise<BYOKVideoStatus> {
  if (connection.provider === 'happyhorse-dashscope') {
    const response = await fetch(buildHappyHorseVideoTaskUrl(connection.apiBase, taskId), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(`快乐马视频查询失败：${getHappyHorseProviderErrorMessage(payload, response.status)}`);
    }
    const status = parseHappyHorseVideoStatus(payload);
    return status.status === 'failed'
      ? { ...status, error: getHappyHorseProviderErrorMessage(payload, response.status) }
      : status;
  }

  if (connection.provider !== 'ark-plan') {
    throw new Error('当前 BYOK 视频查询仅支持 Ark Plan 或快乐马工作空间');
  }

  if (isSCNetVideoApiBase(connection.apiBase)) {
    const response = await fetch(buildSCNetVideoTaskUrl(connection.apiBase, taskId), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(`SCNet 视频查询失败：${sanitizeSCNetProviderError(getSCNetProviderErrorMessage(payload, response.status), connection.apiKey)}`);
    }
    return parseSCNetVideoStatus(payload);
  }

  const taskUrl = `${buildArkVideoTasksUrl(connection.apiBase)}/${encodeURIComponent(taskId)}`;
  const response = await fetch(taskUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${connection.apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(`BYOK 视频查询失败：${payloadError(payload, response.status)}`);
  }

  return extractVideoStatus(payload);
}

export async function waitForVideoWithBYOK(
  connection: BYOKConnection,
  taskId: string,
  onProgress?: (status: BYOKVideoStatus, attempt: number) => void,
  options: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  const maxAttempts = options.maxAttempts ?? 180;
  const intervalMs = options.intervalMs ?? 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await getVideoStatusWithBYOK(connection, taskId);
    onProgress?.(status, attempt);

    if (status.status === 'succeeded' && status.videoUrl) {
      return { videoUrl: status.videoUrl, lastFrameUrl: status.lastFrameUrl };
    }

    if (status.status === 'failed') {
      throw new Error(status.error || `BYOK 视频任务失败：${status.rawStatus || 'failed'}`);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('BYOK 视频生成超时，请稍后在任务中心查看供应商任务状态');
}
