import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegStaticPath from 'ffmpeg-static';
import { resolveFfmpegBinaryPath } from './ffmpeg-binary';

const execFileAsync = promisify(execFile);

export interface LocalVideoMergeResult {
  videoUrl: string;
  outputPath: string;
  bytes: number;
  segmentCount: number;
  renderReport: LocalVideoMergeRenderReport;
}

export interface LocalVideoMergeOptions {
  outputDirectory?: string;
  outputFileName?: string;
  expectedDurationSeconds?: number;
  segmentDurationsSeconds?: number[];
  boundaryBridgeUrls?: string[];
  boundaryEffectiveDurationSeconds?: number;
  boundaryTransitionSeconds?: number;
}

export interface LocalVideoMergeRenderReport {
  version: 'sceneweave-render-report-v1';
  status: 'passed';
  runtime: 'sceneweave-segmented-ffmpeg-v1';
  checkedAt: string;
  segmentCount: number;
  expectedDurationSeconds: number;
  actualDurationSeconds: number;
  outputBytes: number;
}

export function buildBoundaryBridgeTimeline(
  segmentUrls: string[],
  bridgeUrls: string[],
  segmentDurations: number[],
  effectiveBridgeDuration = 2,
  transitionDuration = 1,
) {
  if (segmentUrls.length < 2 || bridgeUrls.length !== segmentUrls.length - 1) {
    throw new Error('桥接片段数量与镜头边界不一致');
  }
  if (segmentDurations.length !== segmentUrls.length) {
    throw new Error('桥接剪辑缺少完整镜头时长');
  }
  if (effectiveBridgeDuration <= 0 || transitionDuration <= 0
    || transitionDuration * 2 !== effectiveBridgeDuration) {
    throw new Error('桥接剪辑必须用等长入出过渡抵消桥接时长');
  }
  const sources: Array<{ kind: 'segment' | 'bridge'; url: string; duration: number }> = [];
  for (let index = 0; index < segmentUrls.length; index += 1) {
    sources.push({ kind: 'segment', url: segmentUrls[index], duration: segmentDurations[index] });
    if (index < bridgeUrls.length) {
      sources.push({ kind: 'bridge', url: bridgeUrls[index], duration: effectiveBridgeDuration });
    }
  }
  return {
    sources,
    transitionDuration,
    expectedDurationSeconds: sources.reduce((sum, source) => sum + source.duration, 0)
      - transitionDuration * (sources.length - 1),
  };
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

async function probeVideoDuration(filePath: string) {
  const ffmpegPath = resolveFfmpegPath();
  try {
    await execFileAsync(ffmpegPath, ['-hide_banner', '-i', filePath], { timeout: 30_000 });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr || '';
    return parseFfmpegDuration(stderr);
  }
  throw new Error('本地 FFmpeg 无法读取桥接片段时长');
}

async function runBoundaryBridgeEdit(
  segmentFiles: string[],
  bridgeFiles: string[],
  segmentDurations: number[],
  outputPath: string,
  effectiveBridgeDuration: number,
  transitionDuration: number,
) {
  const timeline = buildBoundaryBridgeTimeline(
    segmentFiles,
    bridgeFiles,
    segmentDurations,
    effectiveBridgeDuration,
    transitionDuration,
  );
  const orderedFiles = timeline.sources.map(source => source.url);
  const orderedDurations = timeline.sources.map(source => source.duration);
  const filters: string[] = [];
  for (let index = 0; index < orderedFiles.length; index += 1) {
    const duration = orderedDurations[index];
    const isBridge = index % 2 === 1;
    if (isBridge) {
      const sourceDuration = await probeVideoDuration(orderedFiles[index]);
      const speed = sourceDuration / duration;
      filters.push(`[${index}:v]settb=AVTB,setpts=${(duration / sourceDuration).toFixed(8)}*(PTS-STARTPTS),fps=30,format=yuv420p[v${index}]`);
      filters.push(`[${index}:a]aresample=async=1:first_pts=0,atempo=${speed.toFixed(8)}[a${index}]`);
    } else {
      filters.push(`[${index}:v]trim=duration=${duration},settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v${index}]`);
      filters.push(`[${index}:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a${index}]`);
    }
  }
  let videoLabel = 'v0';
  let audioLabel = 'a0';
  let currentDuration = orderedDurations[0];
  for (let index = 1; index < orderedFiles.length; index += 1) {
    const nextVideo = `vx${index}`;
    const nextAudio = `ax${index}`;
    const offset = currentDuration - transitionDuration;
    filters.push(`[${videoLabel}][v${index}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(6)}[${nextVideo}]`);
    filters.push(`[${audioLabel}][a${index}]acrossfade=d=${transitionDuration}[${nextAudio}]`);
    videoLabel = nextVideo;
    audioLabel = nextAudio;
    currentDuration += orderedDurations[index] - transitionDuration;
  }
  const ffmpegPath = resolveFfmpegPath();
  await execFileAsync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...orderedFiles.flatMap(filePath => ['-i', filePath]),
    '-filter_complex', filters.join(';'),
    '-map', `[${videoLabel}]`, '-map', `[${audioLabel}]`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    '-movflags', '+faststart', outputPath,
  ], { timeout: 300_000 });
}

function parseFfmpegDuration(stderr: string) {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) throw new Error('本地 FFmpeg 无法读取合成结果时长');
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function verifyMergedVideo(
  outputPath: string,
  bytes: number,
  segmentCount: number,
  expectedDurationSeconds?: number,
): Promise<LocalVideoMergeRenderReport> {
  const ffmpegPath = resolveFfmpegPath();
  const nullTarget = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const { stderr } = await execFileAsync(ffmpegPath, [
    '-hide_banner',
    '-i', outputPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c', 'copy',
    '-f', 'null',
    nullTarget,
  ], { timeout: 180000 });
  const actualDurationSeconds = parseFfmpegDuration(stderr);
  const expected = expectedDurationSeconds && expectedDurationSeconds > 0
    ? expectedDurationSeconds
    : actualDurationSeconds;
  const tolerance = Math.max(1, expected * 0.1);
  if (Math.abs(actualDurationSeconds - expected) > tolerance) {
    throw new Error(`合成结果时长 ${actualDurationSeconds.toFixed(2)} 秒与计划 ${expected.toFixed(2)} 秒不一致`);
  }
  return {
    version: 'sceneweave-render-report-v1',
    status: 'passed',
    runtime: 'sceneweave-segmented-ffmpeg-v1',
    checkedAt: new Date().toISOString(),
    segmentCount,
    expectedDurationSeconds: expected,
    actualDurationSeconds,
    outputBytes: bytes,
  };
}

function resolveFfmpegPath() {
  return resolveFfmpegBinaryPath({
    configuredPath: process.env.FFMPEG_BIN,
    staticPath: ffmpegStaticPath,
  });
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

    const boundaryBridgeUrls = options.boundaryBridgeUrls || [];
    if (boundaryBridgeUrls.length > 0) {
      const segmentDurations = options.segmentDurationsSeconds || [];
      if (segmentDurations.length !== segmentFiles.length) {
        throw new Error('桥接剪辑缺少完整镜头时长');
      }
      const bridgeFiles: string[] = [];
      for (let index = 0; index < boundaryBridgeUrls.length; index += 1) {
        const bridgePath = path.join(tempDir, `boundary-${index}.mp4`);
        await downloadVideoSegment(boundaryBridgeUrls[index], bridgePath);
        bridgeFiles.push(bridgePath);
      }
      await runBoundaryBridgeEdit(
        segmentFiles,
        bridgeFiles,
        segmentDurations,
        outputPath,
        options.boundaryEffectiveDurationSeconds || 2,
        options.boundaryTransitionSeconds || 1,
      );
    } else {

      const concatListPath = path.join(tempDir, 'concat.txt');
      await fs.writeFile(
        concatListPath,
        segmentFiles.map(filePath => `file '${filePath.replace(/\\/g, '/')}'`).join('\n'),
        'utf8',
      );

      await runConcat(concatListPath, outputPath);
    }

    const stat = await fs.stat(outputPath);
    if (stat.size < 1024) {
      throw new Error('本地 FFmpeg 合成结果文件过小');
    }

    const renderReport = await verifyMergedVideo(
      outputPath,
      stat.size,
      segmentUrls.length,
      options.expectedDurationSeconds,
    );

    return {
      videoUrl: options.outputDirectory ? '' : toPublicVideoUrl(outputFileName),
      outputPath,
      bytes: stat.size,
      segmentCount: segmentUrls.length,
      renderReport,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
