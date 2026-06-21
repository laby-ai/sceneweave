import { NextRequest, NextResponse } from 'next/server';

import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';
import {
  ProductionSegmentStartError,
  redactProductionSegmentStartError,
  startProductionAssemblySegment,
  type StartProductionSegmentInput,
} from '@/lib/production-segment-start';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as StartProductionSegmentInput;
    let byokConnection;

    if (body.dryRun === false && body.allowRealCost === true) {
      try {
        byokConnection = extractBYOKConnection(request.headers);
      } catch (error) {
        if (isBYOKConfigError(error)) {
          return NextResponse.json({
            ...buildBYOKConfigErrorPayload(error),
            usedRealKey: false,
            incurredCost: false,
          }, { status: 400 });
        }
        throw error;
      }
    }

    const result = startProductionAssemblySegment(body, byokConnection);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProductionSegmentStartError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        usedRealKey: false,
        incurredCost: false,
        ...error.details,
      }, { status: error.status });
    }

    console.error('[ProductionAssemblySegmentStart] Error:', error);
    return NextResponse.json({
      success: false,
      error: redactProductionSegmentStartError(error),
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
