import { NextRequest, NextResponse } from 'next/server';

import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';
import { deleteSubject, readSubjectImage } from '@/lib/subjects/subject-store';
import { getSubjectStoreRoot } from '@/lib/subjects/subject-store-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBJECT_ROOT = getSubjectStoreRoot();

async function owner(request: NextRequest) {
  const session = await resolveAccountSessionFromRequest(request);
  return session?.tenant_id && session.member?.id
    ? { tenantId: session.tenant_id, memberId: session.member.id }
    : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const identity = await owner(request);
  if (!identity) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const { id } = await context.params;
    const result = await readSubjectImage(SUBJECT_ROOT, identity, id);
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
  const identity = await owner(request);
  if (!identity) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { id } = await context.params;
  if (!await deleteSubject(SUBJECT_ROOT, identity, id)) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
