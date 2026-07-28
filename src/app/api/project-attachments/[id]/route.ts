import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';

import {
  deleteProjectAttachment,
  getProjectAttachmentStoreRoot,
  readProjectAttachment,
  type ProjectAttachmentOwner,
} from '@/lib/project-attachments/project-attachment-store';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

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
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const { id } = await context.params;
    const projectId = request.nextUrl.searchParams.get('projectId') || '';
    const record = await readProjectAttachment(
      getProjectAttachmentStoreRoot(),
      access.owner as ProjectAttachmentOwner,
      projectId,
      id,
    );
    const rangeHeader = request.headers.get('range');
    const range = parseRange(rangeHeader, record.bytes);
    if (rangeHeader && !range) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${record.bytes}`, 'Accept-Ranges': 'bytes' },
      });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? record.bytes - 1;
    const stream = Readable.toWeb(createReadStream(record.absolutePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': record.mimeType,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${record.bytes}` } : {}),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'project_attachment_not_found' }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const { id } = await context.params;
    const projectId = request.nextUrl.searchParams.get('projectId') || '';
    const deleted = await deleteProjectAttachment(
      getProjectAttachmentStoreRoot(),
      access.owner as ProjectAttachmentOwner,
      projectId,
      id,
    );
    if (!deleted) return NextResponse.json({ error: 'project_attachment_not_found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'project_attachment_not_found' }, { status: 404 });
  }
}
