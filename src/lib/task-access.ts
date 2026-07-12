import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';
import { TaskAdmissionError, type TaskOwner } from '@/lib/task-manager';

export async function resolveTaskOwnerFromRequest(request: NextRequest | Request): Promise<TaskOwner | null> {
  const session = await resolveAccountSessionFromRequest(request);
  if (!session?.tenant_id || !session.member?.id) return null;
  return { tenantId: session.tenant_id, memberId: session.member.id };
}

export function monitorOwnerKey(owner: TaskOwner): string {
  return `${owner.tenantId}:${owner.memberId}`;
}

export function resolveTaskIdempotencyKey(request: NextRequest | Request, operation: string, content: string) {
  const explicit = request.headers.get('idempotency-key')?.trim();
  if (explicit && /^[A-Za-z0-9._:-]{8,128}$/.test(explicit)) return explicit;
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return createHash('sha256').update(`${operation}|${content}|${bucket}`).digest('hex');
}

export function taskAdmissionErrorResponse(error: unknown) {
  if (!(error instanceof TaskAdmissionError)) return null;
  return NextResponse.json({
    success: false,
    error: error.message,
    errorType: error.code,
    retryable: true,
  }, { status: error.status, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } });
}
