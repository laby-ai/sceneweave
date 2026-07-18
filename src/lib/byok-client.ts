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
  error?: unknown;
  provider?: unknown;
}

const BYOK_STORAGE_KEY = 'dreambox-api-connection';
const HAPPYHORSE_SESSION_STORAGE_KEY = 'dreambox-happyhorse-connection';

function isStoredProvider(value: unknown): value is StoredApiProvider {
  return value === 'openai-compatible' || value === 'ark-plan' || value === 'happyhorse-dashscope';
}

function scopedHappyHorseStorageKey(storageScope = ''): string {
  return `${HAPPYHORSE_SESSION_STORAGE_KEY}:${storageScope || 'default'}`;
}

function loadConnection(storageScope = ''): StoredApiConnection | undefined {
  const sessionRaw = window.sessionStorage.getItem(scopedHappyHorseStorageKey(storageScope));
  const raw = sessionRaw || window.localStorage.getItem(BYOK_STORAGE_KEY);
  if (!raw) return undefined;
  const config = JSON.parse(raw) as StoredApiConnection;
  if (!isStoredProvider(config.provider) || !config.apiBase || !config.apiKey) return undefined;
  return config;
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
    const config = loadConnection(storageScope);
    if (!config?.provider || !config.apiBase || !config.apiKey) return {};

    const headers: Record<string, string> = {
      'x-yh-provider': config.provider,
      'x-yh-api-base': config.apiBase,
      'x-yh-api-key': config.apiKey,
    };

    if (config.model) {
      headers['x-yh-model'] = config.model;
    }
    if (config.imageModel) {
      headers['x-yh-image-model'] = config.imageModel;
    }
    if (config.videoModel) {
      headers['x-yh-video-model'] = config.videoModel;
    }

    return headers;
  } catch {
    return {};
  }
}

export function hasBYOKConnectionConfigured(storageScope = ''): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return Boolean(loadConnection(storageScope));
  } catch {
    return false;
  }
}

export function formatProviderError(payload: unknown, fallback: string): string {
  const data = payload as ProviderErrorPayload | null;
  const errorText = typeof data?.error === 'string' ? data.error : fallback;

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
