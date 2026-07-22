import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ResolveFfmpegBinaryOptions {
  configuredPath?: string;
  cwd?: string;
  platform?: NodeJS.Platform;
  staticPath?: string | null;
  exists?: (candidate: string) => boolean;
}

export function resolveFfmpegBinaryPath(options: ResolveFfmpegBinaryOptions = {}) {
  const configuredPath = options.configuredPath?.trim();
  if (configuredPath) return configuredPath;

  const platform = options.platform || process.platform;
  const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const exists = options.exists || existsSync;
  const packagedPath = path.resolve(
    options.cwd || process.cwd(),
    'node_modules',
    'ffmpeg-static',
    binaryName,
  );

  // Runtime package paths must win over the build host's ffmpeg-static path.
  if (exists(packagedPath)) return packagedPath;
  if (options.staticPath && exists(options.staticPath)) return options.staticPath;
  return binaryName;
}
