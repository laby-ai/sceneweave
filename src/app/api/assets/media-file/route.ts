import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_ROOTS = [
  path.resolve(process.cwd(), 'public'),
  'C:\\Users\\16571\\Documents\\Codex',
  'D:\\C_Migrated\\Users_16571_Documents_Codex',
].map(root => path.resolve(root).toLowerCase());

const MIME_TYPES: Record<string, string> = {
  '.avi': 'video/x-msvideo',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

function isAllowedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath).toLowerCase();
  return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function parseRange(range: string | null, size: number): { start: number; end: number } | null {
  if (!range) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return null;

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get('path');
  if (!requestedPath) {
    return NextResponse.json({ success: false, error: 'missing_path' }, { status: 400 });
  }

  const filePath = path.resolve(requestedPath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension];

  if (!contentType || !isAllowedPath(filePath)) {
    return NextResponse.json({ success: false, error: 'file_not_allowed' }, { status: 403 });
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return NextResponse.json({ success: false, error: 'file_not_found' }, { status: 404 });
  }

  if (!stat.isFile()) {
    return NextResponse.json({ success: false, error: 'not_a_file' }, { status: 400 });
  }

  const range = parseRange(request.headers.get('range'), stat.size);
  if (range) {
    const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        'accept-ranges': 'bytes',
        'content-length': String(range.end - range.start + 1),
        'content-range': `bytes ${range.start}-${range.end}/${stat.size}`,
        'content-type': contentType,
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'accept-ranges': 'bytes',
      'content-length': String(stat.size),
      'content-type': contentType,
    },
  });
}
