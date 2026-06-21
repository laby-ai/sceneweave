import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegStaticPath from 'ffmpeg-static';
import { createHuiyingObjectStorage, getHuiyingObjectStorageEnv } from './huiying-object-storage';
import {
  getPublicFrameHandoffReadiness,
  savePublicFrameForHandoff,
} from './public-frame-handoff';

const execFileAsync = promisify(execFile);
const VIDEO_DOWNLOAD_RETRY_COUNT = 4;
const VIDEO_DOWNLOAD_RETRY_DELAY_MS = 750;

export type ExtractedFrameUploadSource = 'object-storage' | 'public-frame-handoff' | 'base64-data-url';

export interface LastFrameExtractionResult {
  ok: boolean;
  lastFrameUrl?: string;
  source?: ExtractedFrameUploadSource;
  diagnostics: {
    version: 'yh-last-frame-extraction-v1';
    downloaded: boolean;
    downloadBytes: number;
    extracted: boolean;
    extractedBytes: number;
    uploaded: boolean;
    uploadSource: ExtractedFrameUploadSource | null;
    objectStorageReady: boolean;
    publicFrameHandoffReady: boolean;
    base64FrameHandoffReady: boolean;
    blockers: string[];
    error?: string;
  };
}

function redactExtractionError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || '未知错误'))
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]');
}

function baseDiagnostics(): LastFrameExtractionResult['diagnostics'] {
  const storageEnv = getHuiyingObjectStorageEnv();
  const storageBlockers = storageEnv.requirements
    .filter(item => !item.configured)
    .map(item => item.name);
  const publicReadiness = getPublicFrameHandoffReadiness();
  return {
    version: 'yh-last-frame-extraction-v1',
    downloaded: false,
    downloadBytes: 0,
    extracted: false,
    extractedBytes: 0,
    uploaded: false,
    uploadSource: null,
    objectStorageReady: storageBlockers.length === 0,
    publicFrameHandoffReady: publicReadiness.ready,
    base64FrameHandoffReady: readEnvFlag('HUIYING_DISABLE_BASE64_FRAME_HANDOFF') !== 'true',
    blockers: [
      ...storageBlockers,
      ...publicReadiness.blockers.filter(item => !storageBlockers.includes(item)),
    ],
  };
}

function readEnvFlag(name: string) {
  return process.env[name]?.trim().toLowerCase();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function describeFetchError(error: unknown) {
  const cause = error instanceof Error && 'cause' in error
    ? (error as Error & { cause?: unknown }).cause
    : undefined;
  const causeCode = cause && typeof cause === 'object' && 'code' in cause
    ? ` ${(cause as { code?: unknown }).code}`
    : '';
  const causeMessage = cause instanceof Error && cause.message ? ` ${cause.message}` : '';
  return `${error instanceof Error ? error.message : String(error || 'fetch failed')}${causeCode}${causeMessage}`.trim();
}

function resolveFfmpegPath() {
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

async function downloadVideo(videoUrl: string, targetPath: string) {
  let lastError = '';
  for (let attempt = 1; attempt <= VIDEO_DOWNLOAD_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(videoUrl, {
        headers: {
          Accept: 'video/mp4,video/*,*/*',
          'User-Agent': 'HuiyingFrameExtractor/1.0',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024) {
        throw new Error('文件过小');
      }
      await fs.writeFile(targetPath, buffer);
      return buffer.length;
    } catch (error) {
      lastError = describeFetchError(error);
      if (attempt < VIDEO_DOWNLOAD_RETRY_COUNT) {
        await sleep(VIDEO_DOWNLOAD_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw new Error(`下载视频失败：${lastError}`);
}

async function extractFrame(videoPath: string, framePath: string) {
  const ffmpegPath = resolveFfmpegPath();
  try {
    await execFileAsync(ffmpegPath, [
      '-y',
      '-sseof', '-0.2',
      '-i', videoPath,
      '-frames:v', '1',
      '-q:v', '2',
      framePath,
    ], { timeout: 120000 });
  } catch {
    await execFileAsync(ffmpegPath, [
      '-y',
      '-i', videoPath,
      '-vf', 'select=eq(n\\,0)',
      '-frames:v', '1',
      '-q:v', '2',
      framePath,
    ], { timeout: 120000 });
  }
}

async function uploadFrame(framePath: string): Promise<{ url?: string; source?: ExtractedFrameUploadSource }> {
  const storageEnv = getHuiyingObjectStorageEnv();
  const storageReady = storageEnv.requirements.every(item => item.configured);
  try {
    if (storageReady) {
      const storage = createHuiyingObjectStorage();
      const fileContent = await fs.readFile(framePath);
      const key = await storage.uploadFile({
        fileContent,
        fileName: `frames/${Date.now()}_${Math.random().toString(16).slice(2)}_last-frame.jpg`,
        contentType: 'image/jpeg',
      });
      return {
        url: await storage.generatePresignedUrl({
          key,
          expireTime: 86400 * 7,
        }),
        source: 'object-storage',
      };
    }
  } catch (error) {
    console.warn('[VideoFrameExtraction] 对象存储上传不可用，尝试 public frame handoff:', error);
  }

  const publicUrl = await savePublicFrameForHandoff(framePath);
  if (publicUrl) {
    return { url: publicUrl, source: 'public-frame-handoff' };
  }

  if (readEnvFlag('HUIYING_DISABLE_BASE64_FRAME_HANDOFF') !== 'true') {
    const fileContent = await fs.readFile(framePath);
    return {
      url: `data:image/jpeg;base64,${fileContent.toString('base64')}`,
      source: 'base64-data-url',
    };
  }

  return {};
}

export async function extractLastFrameForHandoff(videoUrl: string): Promise<LastFrameExtractionResult> {
  const tempDir = path.join(os.tmpdir(), `huiying-frame-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const videoPath = path.join(tempDir, 'segment.mp4');
  const framePath = path.join(tempDir, 'last-frame.jpg');
  const diagnostics = baseDiagnostics();
  await fs.mkdir(tempDir, { recursive: true });
  try {
    diagnostics.downloadBytes = await downloadVideo(videoUrl, videoPath);
    diagnostics.downloaded = true;
    await extractFrame(videoPath, framePath);
    const stat = await fs.stat(framePath);
    diagnostics.extractedBytes = stat.size;
    diagnostics.extracted = true;
    if (stat.size < 512) {
      throw new Error('抽帧结果文件过小');
    }
    const upload = await uploadFrame(framePath);
    if (!upload.url) {
      throw new Error('尾帧已抽出，但缺少可被 Ark 读取的公网上传通道');
    }
    diagnostics.uploaded = true;
    diagnostics.uploadSource = upload.source || null;
    diagnostics.blockers = [];
    return {
      ok: true,
      lastFrameUrl: upload.url,
      source: upload.source,
      diagnostics,
    };
  } catch (error) {
    console.warn('[VideoFrameExtraction] 本地抽帧并上传失败:', error);
    return {
      ok: false,
      diagnostics: {
        ...diagnostics,
        error: redactExtractionError(error),
      },
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractLastFrameWithLocalUpload(videoUrl: string): Promise<string | undefined> {
  const result = await extractLastFrameForHandoff(videoUrl);
  return result.lastFrameUrl;
}

export async function extractLastFrameUrl(videoUrl: string): Promise<string | undefined> {
  try {
    const baseUrl = process.env.HUIYING_PROJECT_DOMAIN_DEFAULT
      || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/video/extract-last-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });

    if (!response.ok) return undefined;
    const data = await response.json().catch(() => null);
    const frameUrl = data?.success && typeof data.frameUrl === 'string' ? data.frameUrl : '';
    return frameUrl || undefined;
  } catch (error) {
    console.warn('[VideoFrameExtraction] 提取最后一帧失败:', error);
  }
  return extractLastFrameWithLocalUpload(videoUrl);
}
