import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';

export type FinalVideoOwner = { tenantId: string; memberId: string };

const MAX_FINAL_VIDEO_BYTES = 1024 * 1024 * 1024;

function ownerKey(owner: FinalVideoOwner): string {
  if (!owner.tenantId || !owner.memberId) throw new Error('final_video_owner_required');
  return createHash('sha256').update(`${owner.tenantId}\0${owner.memberId}`).digest('hex');
}

function ownerDirectory(root: string, owner: FinalVideoOwner): string {
  return path.join(root, ownerKey(owner));
}

function assertId(id: string): void {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('final_video_not_found');
}

function assertMp4(bytes: Buffer): void {
  if (bytes.length < 1024 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') {
    throw new Error('final_video_invalid');
  }
}

export function getFinalVideoStoreRoot(): string {
  return process.env.HUIYING_FINAL_VIDEO_STORE_PATH?.trim()
    ? path.resolve(process.env.HUIYING_FINAL_VIDEO_STORE_PATH)
    : path.resolve('artifacts', 'final-videos');
}

export async function getFinalVideoStoreReadiness(root = getFinalVideoStoreRoot()) {
  const probe = path.join(root, `.readiness-${randomUUID()}`);
  try {
    await mkdir(probe, { recursive: true });
    const temporary = path.join(probe, 'probe.tmp');
    const target = path.join(probe, 'probe.mp4');
    await writeFile(temporary, Buffer.alloc(1024), { mode: 0o600 });
    await rename(temporary, target);
    return {
      ready: true,
      blockers: [] as string[],
      requirements: [{
        name: 'HUIYING_FINAL_VIDEO_STORE_PATH',
        configured: true,
        configuredVia: process.env.HUIYING_FINAL_VIDEO_STORE_PATH?.trim() ? 'environment' : 'artifacts-default',
        purpose: 'member-isolated durable final video files',
      }],
      note: '本地成片共享目录可写，并支持原子落盘。',
    };
  } catch {
    return {
      ready: false,
      blockers: ['final_video_store_not_writable'],
      requirements: [{
        name: 'HUIYING_FINAL_VIDEO_STORE_PATH',
        configured: false,
        purpose: 'member-isolated durable final video files',
      }],
      note: '本地成片共享目录不可写。',
    };
  } finally {
    await rm(probe, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function saveMemberFinalVideo(
  root: string,
  owner: FinalVideoOwner,
  bytes: Buffer,
  options: { segmentCount: number },
) {
  assertMp4(bytes);
  if (bytes.length > MAX_FINAL_VIDEO_BYTES) throw new Error('final_video_too_large');
  const id = randomUUID();
  const directory = ownerDirectory(root, owner);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${id}.mp4`);
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, filePath);
  return { id, filePath, bytes: bytes.length, segmentCount: options.segmentCount };
}

export async function saveMemberFinalVideoFromUrl(root: string, owner: FinalVideoOwner, url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`final_video_download_failed_${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_FINAL_VIDEO_BYTES) throw new Error('final_video_too_large');

  const id = randomUUID();
  const directory = ownerDirectory(root, owner);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${id}.mp4`);
  const temporary = `${filePath}.tmp`;
  try {
    let received = 0;
    const sizeGuard = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        callback(received > MAX_FINAL_VIDEO_BYTES ? new Error('final_video_too_large') : null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body as never), sizeGuard, createWriteStream(temporary, { mode: 0o600 }));
    const info = await stat(temporary);
    if (info.size > MAX_FINAL_VIDEO_BYTES) throw new Error('final_video_too_large');
    const handle = await open(temporary, 'r');
    const header = Buffer.alloc(12);
    await handle.read(header, 0, header.length, 0);
    await handle.close();
    assertMp4(Buffer.concat([header, Buffer.alloc(1012)]));
    await rename(temporary, filePath);
    return { id, filePath, bytes: info.size, segmentCount: 1 };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function mergeMemberFinalVideos(
  root: string,
  owner: FinalVideoOwner,
  segmentUrls: string[],
  options: { expectedDurationSeconds?: number } = {},
) {
  const id = randomUUID();
  const directory = ownerDirectory(root, owner);
  await mkdir(directory, { recursive: true });
  const result = await mergeVideosWithLocalFfmpeg(segmentUrls, {
    outputDirectory: directory,
    outputFileName: `${id}.mp4`,
    expectedDurationSeconds: options.expectedDurationSeconds,
  });
  return {
    id,
    filePath: result.outputPath,
    bytes: result.bytes,
    segmentCount: result.segmentCount,
    renderReport: result.renderReport,
  };
}

export async function readMemberFinalVideo(root: string, owner: FinalVideoOwner, id: string) {
  assertId(id);
  const filePath = path.join(ownerDirectory(root, owner), `${id}.mp4`);
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size < 1024) throw new Error('final_video_not_found');
    return { filePath, bytes: info.size, stream: () => createReadStream(filePath) };
  } catch {
    throw new Error('final_video_not_found');
  }
}
