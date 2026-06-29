import { NextResponse, type NextRequest } from 'next/server';
import { loginAccountUser } from '@/lib/account/account-auth-client';
import { accountSessionCookieName } from '@/lib/account/account-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!email || !password) {
      return NextResponse.json({ error: 'email_and_password_required' }, { status: 400 });
    }

    const session = await loginAccountUser({ email, password });
    const response = NextResponse.json({
      member: session.member,
      tenant_id: session.tenant_id,
      tenant_name: session.tenant_name,
      expires_at: session.expires_at,
    });
    response.cookies.set(accountSessionCookieName(), session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'login_failed';
    return NextResponse.json({ error: code }, { status: 401 });
  }
}
