import { NextResponse, type NextRequest } from 'next/server';
import { accountSessionCookieName } from '@/lib/account/account-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(accountSessionCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}
