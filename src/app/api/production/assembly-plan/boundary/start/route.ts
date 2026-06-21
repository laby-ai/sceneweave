import { NextRequest, NextResponse } from 'next/server';

import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';
import {
  ProductionBoundaryBridgeStartError,
  redactProductionBoundaryBridgeError,
  startProductionBoundaryBridge,
  type StartProductionBoundaryBridgeInput,
} from '@/lib/production-boundary-bridge-start';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as StartProductionBoundaryBridgeInput;
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

    return NextResponse.json(startProductionBoundaryBridge(body, byokConnection));
  } catch (error) {
    if (error instanceof ProductionBoundaryBridgeStartError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        usedRealKey: false,
        incurredCost: false,
        ...error.details,
      }, { status: error.status });
    }

    console.error('[ProductionBoundaryBridgeStart] Error:', error);
    return NextResponse.json({
      success: false,
      error: redactProductionBoundaryBridgeError(error),
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
