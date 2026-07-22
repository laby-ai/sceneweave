import { NextRequest, NextResponse } from 'next/server';

import { resolveBYOKConnectionsForRequest } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, byokConfigErrorStatus, isBYOKConfigError } from '@/lib/byok-response';
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
    let imageConnection;

    if (body.dryRun === false && body.allowRealCost === true) {
      try {
        const connections = await resolveBYOKConnectionsForRequest(request);
        byokConnection = connections.video;
        imageConnection = connections.planning;
      } catch (error) {
        if (isBYOKConfigError(error)) {
          return NextResponse.json({
            ...buildBYOKConfigErrorPayload(error),
            usedRealKey: false,
            incurredCost: false,
          }, { status: byokConfigErrorStatus(error) });
        }
        throw error;
      }
    }

    const result = startProductionAssemblySegment(body, byokConnection, imageConnection);
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
