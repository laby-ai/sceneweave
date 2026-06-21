import { NextRequest, NextResponse } from 'next/server';

import {
  ProductionSegmentRetryError,
  retryProductionAssemblySegment,
  type RetryProductionSegmentInput,
} from '@/lib/production-segment-retry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as RetryProductionSegmentInput;
    const result = retryProductionAssemblySegment(body);
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
