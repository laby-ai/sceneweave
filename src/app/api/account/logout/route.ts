import { NextResponse, type NextRequest } from 'next/server';
import { logoutAccountUser } from '@/lib/account/account-auth-client';
import { accountSessionCookieName, bearerTokenFromRequest } from '@/lib/account/account-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(accountSessionCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  const token = bearerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    await logoutAccountUser(token);
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'account_logout_failed';
    const status = /invalid|expired|missing_bearer/i.test(message)
      ? 401
      : /not_configured/i.test(message)
        ? 503
        : 502;
    const response = NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
    if (status === 401) clearSessionCookie(response, request);
    return response;
  }
}
