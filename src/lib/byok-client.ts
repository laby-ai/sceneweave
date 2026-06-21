type StoredApiProvider = 'openai-compatible' | 'ark-plan';

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

export function getBYOKRequestHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return {};

    const config = JSON.parse(raw) as StoredApiConnection;
    if (
      (config.provider !== 'openai-compatible' && config.provider !== 'ark-plan') ||
      !config.apiBase ||
      !config.apiKey
    ) {
      return {};
    }

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

export function hasBYOKConnectionConfigured(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return false;

    const config = JSON.parse(raw) as StoredApiConnection;
    return (
      (config.provider === 'openai-compatible' || config.provider === 'ark-plan') &&
      Boolean(config.apiBase) &&
      Boolean(config.apiKey)
    );
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
