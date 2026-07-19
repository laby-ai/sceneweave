type StoredApiProvider = 'openai-compatible' | 'ark-plan' | 'happyhorse-dashscope';

interface StoredApiConnection {
  provider?: StoredApiProvider;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  imageModel?: string;
  videoModel?: string;
}

interface ProviderErrorPayload {
  code?: unknown;
  error?: unknown;
  provider?: unknown;
}

const BYOK_STORAGE_KEY = 'dreambox-api-connection';
const PLANNING_SESSION_STORAGE_KEY = 'dreambox-planning-connection';
const HAPPYHORSE_SESSION_STORAGE_KEY = 'dreambox-happyhorse-connection';
export const DEFAULT_PLANNING_MODEL = 'Qwen3.6-Plus';

function isStoredProvider(value: unknown): value is StoredApiProvider {
  return value === 'openai-compatible' || value === 'ark-plan' || value === 'happyhorse-dashscope';
}

function scopedHappyHorseStorageKey(storageScope = ''): string {
  return `${HAPPYHORSE_SESSION_STORAGE_KEY}:${storageScope || 'default'}`;
}

function scopedPlanningStorageKey(storageScope = ''): string {
  return `${PLANNING_SESSION_STORAGE_KEY}:${storageScope || 'default'}`;
}

function parseConnection(raw: string | null): StoredApiConnection | undefined {
  if (!raw) return undefined;
  const config = JSON.parse(raw) as StoredApiConnection;
  if (!isStoredProvider(config.provider) || !config.apiBase || !config.apiKey) return undefined;
  return config;
}

function loadPrimaryConnection(storageScope = ''): StoredApiConnection | undefined {
  return parseConnection(window.sessionStorage.getItem(scopedPlanningStorageKey(storageScope)))
    || parseConnection(window.localStorage.getItem(BYOK_STORAGE_KEY));
}

function loadHappyHorseConnection(storageScope = ''): StoredApiConnection | undefined {
  return parseConnection(window.sessionStorage.getItem(scopedHappyHorseStorageKey(storageScope)));
}

export function saveHappyHorseSessionConnection(
  storageScope: string,
  config: { apiBase: string; apiKey: string; videoModel?: string },
): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(scopedHappyHorseStorageKey(storageScope), JSON.stringify({
    provider: 'happyhorse-dashscope',
    apiBase: config.apiBase.trim(),
    apiKey: config.apiKey.trim(),
    videoModel: config.videoModel?.trim() || 'happyhorse-1.1-t2v',
  } satisfies StoredApiConnection));
}

export function savePlanningSessionConnection(
  storageScope: string,
  config: { apiBase: string; apiKey: string; model?: string },
): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(scopedPlanningStorageKey(storageScope), JSON.stringify({
    provider: 'openai-compatible',
    apiBase: config.apiBase.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model?.trim() || DEFAULT_PLANNING_MODEL,
  } satisfies StoredApiConnection));
}

export async function validateAndSavePlanningSessionConnection(
  storageScope: string,
  config: { apiBase: string; apiKey: string; model?: string },
  requestHeaders: Record<string, string> = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const safeRequestHeaders = Object.fromEntries(
    Object.entries(requestHeaders).filter(([name]) => !name.toLowerCase().startsWith('x-yh-')),
  );
  try {
    const response = await fetch('/api/smart/vimax-agent-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...safeRequestHeaders,
        'x-yh-provider': 'openai-compatible',
        'x-yh-api-base': config.apiBase.trim(),
        'x-yh-api-key': config.apiKey.trim(),
        'x-yh-model': config.model?.trim() || DEFAULT_PLANNING_MODEL,
      },
      body: JSON.stringify({ phase: 'planning_connection_validate' }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => null) as (ProviderErrorPayload & { ready?: unknown }) | null;
    if (!response.ok || payload?.ready !== true) {
      return { ok: false, error: formatProviderError(payload, '规划模型连接验证失败，请检查后重试。') };
    }
    savePlanningSessionConnection(storageScope, config);
    return { ok: true };
  } catch {
    return { ok: false, error: '规划模型连接验证失败，请检查网络、API Base、API Key 和模型名后重试。' };
  }
}

export function clearPlanningSessionConnection(storageScope: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(scopedPlanningStorageKey(storageScope));
}

export function getPlanningSessionConnectionSummary(storageScope: string): {
  configured: boolean;
  apiBase: string;
  model: string;
} {
  if (typeof window === 'undefined') return { configured: false, apiBase: '', model: DEFAULT_PLANNING_MODEL };
  try {
    const config = parseConnection(window.sessionStorage.getItem(scopedPlanningStorageKey(storageScope)));
    return {
      configured: config?.provider === 'openai-compatible',
      apiBase: config?.apiBase || '',
      model: config?.model || DEFAULT_PLANNING_MODEL,
    };
  } catch {
    return { configured: false, apiBase: '', model: DEFAULT_PLANNING_MODEL };
  }
}

export function clearHappyHorseSessionConnection(storageScope: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(scopedHappyHorseStorageKey(storageScope));
}

export function getHappyHorseSessionConnectionSummary(storageScope: string): {
  configured: boolean;
  apiBase: string;
  videoModel: string;
} {
  if (typeof window === 'undefined') return { configured: false, apiBase: '', videoModel: 'happyhorse-1.1-t2v' };
  try {
    const raw = window.sessionStorage.getItem(scopedHappyHorseStorageKey(storageScope));
    if (!raw) return { configured: false, apiBase: '', videoModel: 'happyhorse-1.1-t2v' };
    const config = JSON.parse(raw) as StoredApiConnection;
    return {
      configured: config.provider === 'happyhorse-dashscope' && Boolean(config.apiBase) && Boolean(config.apiKey),
      apiBase: config.apiBase || '',
      videoModel: config.videoModel || 'happyhorse-1.1-t2v',
    };
  } catch {
    return { configured: false, apiBase: '', videoModel: 'happyhorse-1.1-t2v' };
  }
}

export function getBYOKRequestHeaders(storageScope = ''): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const primary = loadPrimaryConnection(storageScope);
    const video = loadHappyHorseConnection(storageScope);
    const headers: Record<string, string> = {};

    if (primary?.provider && primary.apiBase && primary.apiKey) {
      headers['x-yh-provider'] = primary.provider;
      headers['x-yh-api-base'] = primary.apiBase;
      headers['x-yh-api-key'] = primary.apiKey;
      if (primary.model) headers['x-yh-model'] = primary.model;
      if (primary.imageModel) headers['x-yh-image-model'] = primary.imageModel;
      if (primary.videoModel) headers['x-yh-video-model'] = primary.videoModel;
    }

    if (video?.provider === 'happyhorse-dashscope' && video.apiBase && video.apiKey) {
      headers['x-yh-video-provider'] = video.provider;
      headers['x-yh-video-api-base'] = video.apiBase;
      headers['x-yh-video-api-key'] = video.apiKey;
      headers['x-yh-video-model'] = video.videoModel || 'happyhorse-1.1-t2v';
    }

    return headers;
  } catch {
    return {};
  }
}

export function hasBYOKConnectionConfigured(storageScope = ''): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return Boolean(loadPrimaryConnection(storageScope) || loadHappyHorseConnection(storageScope));
  } catch {
    return false;
  }
}

export function formatProviderError(payload: unknown, fallback: string): string {
  const data = payload as ProviderErrorPayload | null;
  const errorText = typeof data?.error === 'string' ? data.error : fallback;

  if (data?.provider === 'planning') {
    if (data.code === 'planning_provider_auth_failed') {
      return '规划模型连接不可用，请检查 API Base、API Key 和模型名后重试。';
    }
    if (data.code === 'planning_provider_unavailable') {
      return '规划模型暂不可用，请先连接可用的规划模型后重试。';
    }
    if (data.code === 'planning_model_unavailable') {
      return '连接已通过，但未找到所选规划模型，请检查模型名后重试。';
    }
    return '规划暂时失败，输入和项目已保留，请稍后重试或更换规划模型。';
  }

  if (data?.provider !== 'byok') {
    return errorText || fallback;
  }

  if (/API key|AuthenticationError|Unauthorized|认证|密钥/i.test(errorText)) {
    return '用户供应商配置失败：API Key 无效或格式不正确，请在设置里检查 API Key、API Base 和模型名。';
  }

  if (/缺少默认模型|model|模型/i.test(errorText)) {
    return '用户供应商配置失败：缺少可用模型名，请在设置里填写对应的文本、图片或视频模型。';
  }

  return `用户供应商配置失败：${errorText || fallback}`;
}
