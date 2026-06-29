import { normalizeBYOKApiBase } from '@/lib/byok-url';

export type BYOKProviderType = 'openai-compatible' | 'ark-plan';

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

  if (provider && apiBase && apiKey && (provider === 'openai-compatible' || provider === 'ark-plan')) {
    return { provider, apiBase: normalizeBYOKApiBase(apiBase), apiKey, model, imageModel, videoModel };
  }

  // 服务端默认连接：统一走 Agent Plan 端点（套餐内，避免 /api/v3 套餐外后付费）+ Agent Plan key + 套餐内模型。
  const envKey = (process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '').trim();
  const envBase = (process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/plan/v3').trim();
  const planBase = envBase.includes('/plan/') ? envBase : 'https://ark.cn-beijing.volces.com/api/plan/v3';
  if (envKey) {
    return {
      provider: 'ark-plan',
      apiBase: planBase,
      apiKey: envKey,
      model: (process.env.ARK_AGENT_MODEL || 'minimax-m3').trim(),
      imageModel: (process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5.0-lite').trim(),
      videoModel: (process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1.5-pro').trim(),
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

// Seedream 5.0 要求图像 >= 3,686,400 像素，1024x1024 等小尺寸会直接 400。
// 这里在保持宽高比的前提下把过小尺寸放大到达标尺寸；非 seedream 模型保持原样，避免影响其它 BYOK 渠道。
const SEEDREAM_MIN_PIXELS = 3_686_400;
const SEEDREAM_RATIO_SIZE: Record<string, string> = {
  '1:1': '2048x2048',
  '16:9': '2560x1440',
  '9:16': '1440x2560',
  '4:3': '2304x1728',
  '3:4': '1728x2304',
  '3:2': '2496x1664',
  '2:3': '1664x2496',
  '21:9': '3024x1296',
};

function ensureSeedreamImageSize(size: string | undefined, model: string): string {
  if (!/seedream/i.test(model)) return size || '1024x1024';
  const raw = (size || '').trim();
  const wh = /^(\d+)x(\d+)$/.exec(raw);
  if (wh) {
    const w = Number(wh[1]);
    const h = Number(wh[2]);
    if (w * h >= SEEDREAM_MIN_PIXELS) return `${w}x${h}`;
    const scale = Math.sqrt(SEEDREAM_MIN_PIXELS / (w * h));
    return `${Math.round(w * scale)}x${Math.round(h * scale)}`;
  }
  return SEEDREAM_RATIO_SIZE[raw] || '2048x2048';
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
      size: ensureSeedreamImageSize(params.size, model),
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

// Seedance 文本提示词安全上限（保守取值，避免超长触发 ARK Invalid content.text）。
const ARK_VIDEO_PROMPT_MAX = 800;

export function normalizeVideoPromptForArk(prompt: string): string {
  const raw = String(prompt || '')
    // 去除控制字符与零宽字符，ARK 对这类字符会判定 content.text 非法。
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let compact = raw
    .replace(/【[^】]{1,28}】/g, ' ')
    // Seedance 会把 "--xxx" 当成命令参数解析，分镜文案里出现会导致 Invalid content.text；
    // 把连续短横线降级为破折号，避免被误解析为参数。
    .replace(/-{2,}/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
  // 去掉方括号标签后可能为空（例如某段分镜只剩「【镜头3】」之类标签），
  // 此时回退到原始文案；仍为空再给安全默认，避免 ARK 报 Invalid content.text 导致整段失败。
  if (!compact) compact = raw;
  if (!compact) compact = '电影感画面，自然光影，连贯运镜。';
  if (compact.length <= ARK_VIDEO_PROMPT_MAX) return compact;

  const opening = compact.slice(0, ARK_VIDEO_PROMPT_MAX - 300);
  const ending = compact.slice(-280);
  return `${opening} … ${ending}`;
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
  if (connection.provider !== 'ark-plan') {
    throw new Error('当前 BYOK 视频生成仅支持 Ark Plan，请在设置页选择 Ark Plan 并填写视频模型');
  }

  const model = params.model || connection.videoModel || connection.model;
  if (!model) {
    throw new Error('BYOK 视频调用缺少视频模型');
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
  if (connection.provider !== 'ark-plan') {
    throw new Error('当前 BYOK 视频查询仅支持 Ark Plan');
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
