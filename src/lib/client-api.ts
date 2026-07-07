'use client';

const ACCOUNT_TOKEN_KEYS = ['account_entitlement_token', 'huiying_account_token'];
const DEFAULT_TIMEOUT_MS = 20_000;
const FALLBACK_LOGIN_URL = '/account-login.html?next=%2Fhuiying';

type ClientApiOptions = RequestInit & {
  timeoutMs?: number;
  redirectOnUnauthorized?: boolean;
  skipAuth?: boolean;
};

export function detectClientBasePath(): string {
  const configured = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/huiying')) return '/huiying';
  return '';
}

export function clientApiPath(path: string): string {
  const basePath = detectClientBasePath();
  if (!basePath) return path;
  if (path.startsWith('/api') && !path.startsWith(`${basePath}/`)) return `${basePath}${path}`;
  return path;
}

export function getStoredAccountToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of ACCOUNT_TOKEN_KEYS) {
        const token = storage.getItem(key)?.trim();
        if (token) return token;
      }
    }
  } catch {
    return '';
  }
  return '';
}

export function hasStoredAccountToken(): boolean {
  return Boolean(getStoredAccountToken());
}

export function accountAuthHeaders(): Record<string, string> {
  const token = getStoredAccountToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearStoredAccountTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of ACCOUNT_TOKEN_KEYS) storage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable or blocked.
  }
}

export function accountLoginUrl(): string {
  if (typeof window === 'undefined') return FALLBACK_LOGIN_URL;
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/huiying';
  return `/account-login.html?next=${encodeURIComponent(next)}`;
}

function unauthorizedError(): Error {
  const error = new Error('unauthorized') as Error & { status?: number };
  error.status = 401;
  return error;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => '');
}

export async function clientApiRequest(path: string, options: ClientApiOptions = {}): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    redirectOnUnauthorized = true,
    skipAuth = false,
    headers,
    ...init
  } = options;
  const requestHeaders = new Headers(headers);
  const token = skipAuth ? '' : getStoredAccountToken();
  if (token && !requestHeaders.has('Authorization')) requestHeaders.set('Authorization', `Bearer ${token}`);
  if (init.body && typeof init.body === 'string' && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(clientApiPath(path), {
    ...init,
    credentials: init.credentials ?? 'same-origin',
    cache: init.cache ?? 'no-store',
    headers: requestHeaders,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 401) {
    clearStoredAccountTokens();
    if (redirectOnUnauthorized) window.location.replace(accountLoginUrl());
    throw unauthorizedError();
  }

  return response;
}

export async function clientApiFetch<T>(path: string, options: ClientApiOptions = {}): Promise<T> {
  const response = await clientApiRequest(path, options);
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : `request_failed_${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
