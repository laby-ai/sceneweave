import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';

import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';
import { getFinalVideoStoreRoot, readMemberFinalVideo } from '@/lib/final-videos/member-final-video-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseRange(value: string | null, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  if (!match) return null;
  if (!match[1] && match[2]) {
    const suffix = Number(match[2]);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAccountSessionFromRequest(request);
  if (!session?.tenant_id || !session.member?.id) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const video = await readMemberFinalVideo(getFinalVideoStoreRoot(), {
      tenantId: session.tenant_id,
      memberId: session.member.id,
    }, id);
    const rangeHeader = request.headers.get('range');
    const range = parseRange(rangeHeader, video.bytes);
    if (rangeHeader && !range) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${video.bytes}`, 'Accept-Ranges': 'bytes' },
      });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? video.bytes - 1;
    const stream = Readable.toWeb(createReadStream(video.filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${video.bytes}` } : {}),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'final_video_not_found' }, { status: 404 });
  }
}
