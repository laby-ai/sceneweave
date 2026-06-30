export function clientApiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  const runtimeBasePath =
    configuredBasePath ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/huiying') ? '/huiying' : '');

  if (!runtimeBasePath || normalized.startsWith(`${runtimeBasePath}/`)) {
    return normalized;
  }

  return normalized.startsWith('/api') ? `${runtimeBasePath}${normalized}` : normalized;
}
