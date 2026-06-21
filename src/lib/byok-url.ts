const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fc[0-9a-f]{2}:/i,
  /^\[?fd[0-9a-f]{2}:/i,
];

export class BYOKApiBaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BYOKApiBaseError';
  }
}

export function normalizeBYOKApiBase(apiBase: string): string {
  const trimmed = apiBase.trim().replace(/\/+$/, '');
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BYOKApiBaseError('API Base 不是有效 URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BYOKApiBaseError('API Base 只支持 http 或 https 地址');
  }

  const allowPrivateApiBase = process.env.YH_BYOK_ALLOW_PRIVATE_API_BASE === 'true';
  if (!allowPrivateApiBase) {
    const host = parsed.hostname.toLowerCase();
    if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
      throw new BYOKApiBaseError('API Base 不允许指向 localhost、内网或链路本地地址');
    }
  }

  return parsed.toString().replace(/\/+$/, '');
}
