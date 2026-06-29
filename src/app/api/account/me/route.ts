import { NextResponse, type NextRequest } from 'next/server';
import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const context = await resolveAccountSessionFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  return NextResponse.json({
    member: context.member,
    tenant_id: context.tenant_id,
    tenant_name: context.tenant_name,
    expires_at: context.expires_at,
  });
}
