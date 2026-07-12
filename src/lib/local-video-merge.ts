import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegStaticPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

export interface LocalVideoMergeResult {
  videoUrl: string;
  outputPath: string;
  bytes: number;
  segmentCount: number;
}

export interface LocalVideoMergeOptions {
  outputDirectory?: string;
  outputFileName?: string;
}

function toPublicVideoUrl(fileName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  const publicPath = `${basePath}/generated/videos/${fileName}`;
  return baseUrl ? `${baseUrl.replace(/\/+$/, '')}${publicPath}` : publicPath;
}

async function downloadVideoSegment(url: string, targetPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载片段失败：HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error('下载片段失败：文件过小');
  }

  await fs.writeFile(targetPath, buffer);
  return buffer.length;
}

async function runConcat(concatListPath: string, outputPath: string) {
  const ffmpegPath = resolveFfmpegPath();
  try {
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 180000 });
  } catch {
      await execFileAsync(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 300000 });
  }
}

function resolveFfmpegPath() {
  const configuredPath = process.env.FFMPEG_BIN?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  if (ffmpegStaticPath && existsSync(ffmpegStaticPath)) {
    return ffmpegStaticPath;
  }

  const platformBinary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const cwdFallback = path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', platformBinary);
  if (existsSync(cwdFallback)) {
    return cwdFallback;
  }

  throw new Error('本地 FFmpeg 不可用');
}

export async function mergeVideosWithLocalFfmpeg(
  segmentUrls: string[],
  options: LocalVideoMergeOptions = {},
): Promise<LocalVideoMergeResult> {
  if (segmentUrls.length < 2) {
    throw new Error('至少需要 2 个视频片段才能合成');
  }

  const runId = `huiying-merge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tempDir = path.join(os.tmpdir(), runId);
  const outputDir = options.outputDirectory ? path.resolve(options.outputDirectory) : path.resolve('public', 'generated', 'videos');
  const outputFileName = options.outputFileName || `${runId}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);

  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const segmentFiles: string[] = [];
    for (let index = 0; index < segmentUrls.length; index += 1) {
      const segmentPath = path.join(tempDir, `segment-${index}.mp4`);
      await downloadVideoSegment(segmentUrls[index], segmentPath);
      segmentFiles.push(segmentPath);
    }

    const concatListPath = path.join(tempDir, 'concat.txt');
    await fs.writeFile(
      concatListPath,
      segmentFiles.map(filePath => `file '${filePath.replace(/\\/g, '/')}'`).join('\n'),
      'utf8',
    );

    await runConcat(concatListPath, outputPath);

    const stat = await fs.stat(outputPath);
    if (stat.size < 1024) {
      throw new Error('本地 FFmpeg 合成结果文件过小');
    }

    return {
      videoUrl: options.outputDirectory ? '' : toPublicVideoUrl(outputFileName),
      outputPath,
      bytes: stat.size,
      segmentCount: segmentUrls.length,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
