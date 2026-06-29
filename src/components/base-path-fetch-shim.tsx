'use client';

/**
 * 子路径部署垫片。
 *
 * 应用里有约 200 处写死的 `fetch('/api/...')` 与少量 `new EventSource('/api/...')`，
 * Next 的 basePath 不会自动给这些运行时调用加前缀。这里在客户端一次性包裹
 * window.fetch / window.EventSource，把同源、以 `/api` 开头且尚未带 basePath 的
 * 请求统一改写到 `${basePath}/api/...`，从而无需改动数百处调用点。
 *
 * basePath 为空（根路径部署 / 本地开发）时本垫片不做任何事。
 */

function detectBasePath(): string {
  const configured = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.pathname === '/huiying') return '/huiying';
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/huiying/')) return '/huiying';
  return '';
}

function withBasePath(url: string): string {
  const BASE_PATH = detectBasePath();
  if (!BASE_PATH) return url;
  // 仅改写同源、以 /api 开头、且还没带 basePath 前缀的绝对路径。
  if (url.startsWith('/api') && !url.startsWith(`${BASE_PATH}/`)) {
    return `${BASE_PATH}${url}`;
  }
  return url;
}

declare global {
  interface Window {
    __huiyingBasePathShimInstalled?: boolean;
  }
}

if (typeof window !== 'undefined' && detectBasePath() && !window.__huiyingBasePathShimInstalled) {
  window.__huiyingBasePathShimInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(withBasePath(input), init);
    }
    if (input instanceof Request && input.url.startsWith(window.location.origin)) {
      const path = input.url.slice(window.location.origin.length);
      const rewritten = withBasePath(path);
      if (rewritten !== path) {
        return originalFetch(new Request(`${window.location.origin}${rewritten}`, input), init);
      }
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof window.fetch;

  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) {
    const PatchedEventSource = function (this: EventSource, url: string | URL, init?: EventSourceInit) {
      const finalUrl = typeof url === 'string' ? withBasePath(url) : url;
      return new OriginalEventSource(finalUrl, init);
    } as unknown as typeof EventSource;
    PatchedEventSource.prototype = OriginalEventSource.prototype;
    // CONNECTING/OPEN/CLOSED 是构造器上的只读静态常量，不能直接赋值；
    // 用 Object.assign 复制一份，保持与原生 EventSource 的兼容。
    Object.assign(PatchedEventSource, {
      CONNECTING: OriginalEventSource.CONNECTING,
      OPEN: OriginalEventSource.OPEN,
      CLOSED: OriginalEventSource.CLOSED,
    });
    window.EventSource = PatchedEventSource;
  }
}

export function BasePathFetchShim() {
  return null;
}
