import type { NextRequest } from 'next/server';

import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';
import type { TaskOwner } from '@/lib/task-manager';

export async function resolveTaskOwnerFromRequest(request: NextRequest | Request): Promise<TaskOwner | null> {
  const session = await resolveAccountSessionFromRequest(request);
  if (!session?.tenant_id || !session.member?.id) return null;
  return { tenantId: session.tenant_id, memberId: session.member.id };
}

export function monitorOwnerKey(owner: TaskOwner): string {
  return `${owner.tenantId}:${owner.memberId}`;
}
