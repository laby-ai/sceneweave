import { NextResponse, type NextRequest } from 'next/server';
import {
  accountSessionCookieName,
  resolveAccountSessionFromRequest,
  sessionCookieOptions,
} from '@/lib/account/account-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const context = await resolveAccountSessionFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const response = NextResponse.json({
    member: context.member,
    tenant_id: context.tenant_id,
    tenant_name: context.tenant_name,
    expires_at: context.expires_at,
  });
  const authorization = request.headers.get('authorization')?.trim() || '';
  if (authorization.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) {
      const options = sessionCookieOptions(context.expires_at);
      response.cookies.set(accountSessionCookieName(), token, {
        ...options,
        secure: request.nextUrl.protocol === 'https:' || options.secure,
      });
    }
  }
  return response;
}
