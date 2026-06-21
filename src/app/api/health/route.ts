import { NextResponse } from 'next/server';
import { getProviderHealthStatus, resetProviderHealth } from '@/lib/model-router';
import { getProductionRuntimeReadiness } from '@/lib/runtime-readiness';
import type { ServiceType } from '@/lib/model-router';

/**
 * GET /api/health - 查看所有provider健康状态
 * POST /api/health - 重置指定provider健康状态
 *   body: { provider?: string, service?: ServiceType }
 */
export async function GET() {
  const status = getProviderHealthStatus();
  const runtimeReadiness = getProductionRuntimeReadiness();
  return NextResponse.json({
    providers: status,
    unhealthy: status.filter(s => !s.healthy).map(s => `${s.provider}(${s.failCount} failures)`),
    runtimeReadiness,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, service } = body as { provider?: string; service?: ServiceType };
    resetProviderHealth(provider, service);
    const status = getProviderHealthStatus();
    return NextResponse.json({ success: true, providers: status });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
