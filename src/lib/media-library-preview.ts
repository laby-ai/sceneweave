import path from 'node:path';

export interface PublicMediaCandidate {
  filePath: string;
  url: string;
}

export function resolvePackagedFfmpegPath(
  applicationRoot: string,
  platform: NodeJS.Platform,
): string {
  return path.join(
    applicationRoot,
    'node_modules',
    'ffmpeg-static',
    platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  );
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
