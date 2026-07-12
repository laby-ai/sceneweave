import fs from 'node:fs/promises';
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

export async function resolvePackagedVideoPoster(
  videoPath: string,
  publicRoot: string,
  basePath: string,
): Promise<string> {
  const extension = path.extname(videoPath);
  const baseName = path.basename(videoPath, extension);
  const directory = path.dirname(videoPath);
  const stemCandidates = [
    baseName,
    baseName.replace(/-clip(?:-preview)?$/i, ''),
    baseName.replace(/-preview$/i, ''),
  ];

  for (const stem of [...new Set(stemCandidates)]) {
    for (const posterExtension of ['.jpg', '.png', '.webp']) {
      const candidatePath = path.join(directory, `${stem}-poster${posterExtension}`);
      try {
        if ((await fs.stat(candidatePath)).isFile()) {
          const candidate = buildPublicMediaCandidate(candidatePath, publicRoot, basePath);
          if (candidate) return candidate.url;
        }
      } catch {
        // Try the next packaged poster candidate.
      }
    }
  }

  return `${basePath}/home/huiying-story-aware-10s-poster.jpg`;
}
