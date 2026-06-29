import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

const ALLOWED_ROOTS = [
  path.resolve(process.cwd(), 'public'),
  'C:\\Users\\16571\\Documents\\Codex',
  'D:\\C_Migrated\\Users_16571_Documents_Codex',
].map(root => path.resolve(root).toLowerCase());

const CACHE_DIR = path.resolve(process.cwd(), 'artifacts', 'media-posters');

function isAllowedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath).toLowerCase();
  return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function cachePathFor(filePath: string): string {
  const digest = crypto.createHash('sha256').update(path.resolve(filePath).toLowerCase()).digest('hex').slice(0, 24);
  return path.join(CACHE_DIR, `${digest}.jpg`);
}

async function ensurePoster(filePath: string, posterPath: string): Promise<void> {
  try {
    const stat = await fs.promises.stat(posterPath);
    if (stat.isFile() && stat.size > 0) return;
  } catch {
    // Cache miss; generate below.
  }

  await fs.promises.mkdir(CACHE_DIR, { recursive: true });
  await execFileAsync(
    'ffmpeg',
    ['-y', '-ss', '1', '-i', filePath, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', posterPath],
    { timeout: 20000, windowsHide: true },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get('path');
  if (!requestedPath) {
    return NextResponse.json({ success: false, error: 'missing_path' }, { status: 400 });
  }

  const filePath = path.resolve(requestedPath);
  if (path.extname(filePath).toLowerCase() !== '.mp4' || !isAllowedPath(filePath)) {
    return NextResponse.json({ success: false, error: 'file_not_allowed' }, { status: 403 });
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ success: false, error: 'not_a_file' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'file_not_found' }, { status: 404 });
  }

  const posterPath = cachePathFor(filePath);
  try {
    await ensurePoster(filePath, posterPath);
  } catch {
    return NextResponse.json({ success: false, error: 'poster_generation_failed' }, { status: 422 });
  }

  const stream = fs.createReadStream(posterPath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'image/jpeg',
    },
  });
}
