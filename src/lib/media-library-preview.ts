import path from 'node:path';

export interface PublicMediaCandidate {
  filePath: string;
  url: string;
}

export function buildPublicMediaCandidate(
  sourcePath: string,
  publicRoot: string,
  basePath = '',
): PublicMediaCandidate | undefined {
  const normalizedSource = sourcePath.replace(/\\/g, '/');
  const marker = '/public/';
  const markerIndex = normalizedSource.toLowerCase().lastIndexOf(marker);
  if (markerIndex < 0) return undefined;

  const relativeParts = normalizedSource
    .slice(markerIndex + marker.length)
    .split('/')
    .filter(Boolean);
  if (relativeParts.length === 0 || relativeParts.some(part => part === '.' || part === '..')) {
    return undefined;
  }

  const normalizedBasePath = basePath.replace(/\/$/, '');
  return {
    filePath: path.join(publicRoot, ...relativeParts),
    url: `${normalizedBasePath}/${relativeParts.map(encodeURIComponent).join('/')}`,
  };
}
