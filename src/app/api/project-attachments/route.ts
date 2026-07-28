import { NextRequest, NextResponse } from 'next/server';

import {
  createProjectAttachment,
  getProjectAttachmentStoreRoot,
  listProjectAttachments,
  reorderProjectAttachments,
  type ProjectAttachmentKind,
  type ProjectAttachmentOwner,
  type ProjectAttachmentRecord,
} from '@/lib/project-attachments/project-attachment-store';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_RULES: Record<string, {
  kind: ProjectAttachmentKind;
  extension: string;
  maxBytes: number;
}> = {
  'image/jpeg': { kind: 'image', extension: 'jpg', maxBytes: 15 * 1024 * 1024 },
  'image/png': { kind: 'image', extension: 'png', maxBytes: 15 * 1024 * 1024 },
  'image/webp': { kind: 'image', extension: 'webp', maxBytes: 15 * 1024 * 1024 },
  'video/mp4': { kind: 'video', extension: 'mp4', maxBytes: 100 * 1024 * 1024 },
  'video/webm': { kind: 'video', extension: 'webm', maxBytes: 100 * 1024 * 1024 },
  'video/quicktime': { kind: 'video', extension: 'mov', maxBytes: 100 * 1024 * 1024 },
  'application/pdf': { kind: 'document', extension: 'pdf', maxBytes: 25 * 1024 * 1024 },
  'text/plain': { kind: 'document', extension: 'txt', maxBytes: 5 * 1024 * 1024 },
  'text/markdown': { kind: 'document', extension: 'md', maxBytes: 5 * 1024 * 1024 },
};

function publicAttachment(record: ProjectAttachmentRecord) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    kind: record.kind,
    mimeType: record.mimeType,
    bytes: record.bytes,
    createdAt: record.createdAt,
    order: record.order,
    url: `${basePath}/api/project-attachments/${encodeURIComponent(record.id)}?projectId=${encodeURIComponent(record.projectId)}`,
  };
}

function detectMime(bytes: Buffer, declaredMime: string): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    return declaredMime === 'video/quicktime' ? 'video/quicktime' : 'video/mp4';
  }
  if (bytes.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))) return 'video/webm';
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (['text/plain', 'text/markdown'].includes(declaredMime)
    && !bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0)) return declaredMime;
  return null;
}

export async function GET(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || '';
    const records = await listProjectAttachments(
      getProjectAttachmentStoreRoot(),
      access.owner as ProjectAttachmentOwner,
      projectId,
    );
    return NextResponse.json({ success: true, attachments: records.map(publicAttachment) });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'project_attachment_list_failed';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const form = await request.formData();
    const projectId = String(form.get('projectId') || '');
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('project_attachment_file_required');
    const rule = MIME_RULES[file.type];
    if (!rule) throw new Error('project_attachment_type_not_allowed');
    if (file.size <= 0 || file.size > rule.maxBytes) throw new Error('project_attachment_size_invalid');
    const content = Buffer.from(await file.arrayBuffer());
    if (content.length !== file.size || detectMime(content, file.type) !== file.type) {
      throw new Error('project_attachment_content_invalid');
    }
    const record = await createProjectAttachment(
      getProjectAttachmentStoreRoot(),
      access.owner as ProjectAttachmentOwner,
      {
        projectId,
        name: file.name,
        kind: rule.kind,
        mimeType: file.type,
        content,
        extension: rule.extension,
      },
    );
    return NextResponse.json({ success: true, attachment: publicAttachment(record) }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'project_attachment_create_failed';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json() as { projectId?: string; orderedIds?: string[] };
    const records = await reorderProjectAttachments(
      getProjectAttachmentStoreRoot(),
      access.owner as ProjectAttachmentOwner,
      body.projectId || '',
      Array.isArray(body.orderedIds) ? body.orderedIds.filter(id => typeof id === 'string') : [],
    );
    return NextResponse.json({ success: true, attachments: records.map(publicAttachment) });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'project_attachment_order_failed';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
