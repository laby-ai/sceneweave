import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';

import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';
import { createSubject, listSubjects, type SubjectOwner, type SubjectType } from '@/lib/subjects/subject-store';
import { getSubjectStoreRoot } from '@/lib/subjects/subject-store-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBJECT_ROOT = getSubjectStoreRoot();

function ownerFromSession(session: Awaited<ReturnType<typeof resolveAccountSessionFromRequest>>): SubjectOwner | null {
  return session?.tenant_id && session.member?.id
    ? { tenantId: session.tenant_id, memberId: session.member.id }
    : null;
}

function isPrivateAddress(address: string): boolean {
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

async function assertSafeRemoteUrl(url: URL, origin: string): Promise<void> {
  if (url.origin === origin) return;
  if (url.protocol !== 'https:') throw new Error('subject_source_not_allowed');
  if (url.username || url.password || url.port) throw new Error('subject_source_not_allowed');
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error('subject_source_not_allowed');
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(item => isPrivateAddress(item.address))) {
    throw new Error('subject_source_not_allowed');
  }
}

function detectImageMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

async function downloadSubjectImage(request: NextRequest, referenceUrl: string): Promise<{ image: Buffer; mimeType: string }> {
  if (referenceUrl.startsWith('data:image/')) {
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(referenceUrl);
    if (!match) throw new Error('subject_image_invalid');
    const image = Buffer.from(match[2], 'base64');
    const mimeType = detectImageMime(image);
    if (!mimeType || mimeType !== match[1]) throw new Error('subject_image_invalid');
    return { image, mimeType };
  }

  let url = new URL(referenceUrl, request.nextUrl.origin);
  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    await assertSafeRemoteUrl(url, request.nextUrl.origin);
    const sameOrigin = url.origin === request.nextUrl.origin;
    response = await fetch(url, {
      headers: {
        Accept: 'image/png,image/jpeg,image/webp,image/gif',
        ...(sameOrigin ? {
          cookie: request.headers.get('cookie') || '',
          authorization: request.headers.get('authorization') || '',
        } : {}),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get('location');
    if (!location || redirectCount === 3) throw new Error('subject_image_unavailable');
    url = new URL(location, url);
  }
  if (!response) throw new Error('subject_image_unavailable');
  if (!response.ok) throw new Error('subject_image_unavailable');
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > 15 * 1024 * 1024) throw new Error('subject_image_too_large');
  const image = Buffer.from(await response.arrayBuffer());
  if (image.length > 15 * 1024 * 1024) throw new Error('subject_image_too_large');
  const mimeType = detectImageMime(image);
  if (!mimeType) throw new Error('subject_image_invalid');
  return { image, mimeType };
}

function publicSubject(record: Awaited<ReturnType<typeof listSubjects>>[number]) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    source: record.source,
    createdAt: record.createdAt,
    imageUrl: `${basePath}/api/subjects/${encodeURIComponent(record.id)}`,
  };
}

export async function GET(request: NextRequest) {
  const owner = ownerFromSession(await resolveAccountSessionFromRequest(request));
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  return NextResponse.json({ success: true, subjects: (await listSubjects(SUBJECT_ROOT, owner)).map(publicSubject) });
}

export async function POST(request: NextRequest) {
  const owner = ownerFromSession(await resolveAccountSessionFromRequest(request));
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json() as { name?: string; type?: SubjectType; referenceUrl?: string; source?: 'generated' | 'uploaded' };
    if (!body.referenceUrl || typeof body.referenceUrl !== 'string') throw new Error('subject_image_required');
    const downloaded = await downloadSubjectImage(request, body.referenceUrl);
    const subject = await createSubject(SUBJECT_ROOT, owner, {
      name: body.name || '',
      type: body.type as SubjectType,
      source: body.source === 'uploaded' ? 'uploaded' : 'generated',
      ...downloaded,
    });
    return NextResponse.json({ success: true, subject: publicSubject(subject) }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'subject_create_failed';
    const status = code === 'subject_image_unavailable' ? 422 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
