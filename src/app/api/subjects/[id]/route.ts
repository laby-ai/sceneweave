import { NextRequest, NextResponse } from 'next/server';

import { deleteSubject, listSubjects, readSubjectImage } from '@/lib/subjects/subject-store';
import { getSubjectStoreRoot } from '@/lib/subjects/subject-store-readiness';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBJECT_ROOT = getSubjectStoreRoot();

async function accessToSubject(request: NextRequest, id: string) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return 'not_authenticated' as const;
  if (access.sessionMode === 'member') return access;
  const reference = (await listSubjects(SUBJECT_ROOT, access.owner)).find(item => item.id === id);
  return reference?.context === 'creation-agent' ? access : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await accessToSubject(request, id);
  if (access === 'not_authenticated') return NextResponse.json({ error: access }, { status: 401 });
  if (!access) return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  try {
    const result = await readSubjectImage(SUBJECT_ROOT, access.owner, id);
    return new NextResponse(new Uint8Array(result.image), {
      headers: {
        'Content-Type': result.mimeType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await accessToSubject(request, id);
  if (access === 'not_authenticated') return NextResponse.json({ error: access }, { status: 401 });
  if (!access || !await deleteSubject(SUBJECT_ROOT, access.owner, id)) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
