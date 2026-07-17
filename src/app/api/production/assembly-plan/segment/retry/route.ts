import { NextRequest, NextResponse } from 'next/server';

import {
  ProductionSegmentRetryError,
  retryProductionAssemblySegment,
  type RetryProductionSegmentInput,
} from '@/lib/production-segment-retry';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as RetryProductionSegmentInput;
    const result = retryProductionAssemblySegment(body, access.owner);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProductionSegmentRetryError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        usedRealKey: false,
        incurredCost: false,
        ...error.details,
      }, { status: error.status });
    }

    console.error('[ProductionAssemblySegmentRetry] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '片段重试失败',
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
