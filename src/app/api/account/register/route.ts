import { NextResponse, type NextRequest } from 'next/server';
import { registerAccountUser } from '@/lib/account/account-auth-client';
import { accountSessionCookieName } from '@/lib/account/account-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      displayName?: string;
      tenantId?: string;
    };
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim() || email.split('@')[0] || '绘影用户';
    if (!email || !password) {
      return NextResponse.json({ error: 'email_and_password_required' }, { status: 400 });
    }

    const session = await registerAccountUser({ email, password, displayName, tenantId: body.tenantId });
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
    const code = error instanceof Error ? error.message : 'register_failed';
    const status = code === 'email_already_registered' ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
