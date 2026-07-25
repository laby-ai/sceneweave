import { NextRequest, NextResponse } from 'next/server';

import {
  ProductionSegmentTailRecoveryError,
  recoverProductionSegmentTailFrame,
  type RecoverProductionSegmentTailFrameInput,
} from '@/lib/production-segment-tail-recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeRecoveryError(error: unknown) {
  const message = error instanceof Error ? error.message : '片段尾帧恢复失败';
  const signedUrlTokenPattern = new RegExp('X-' + 'Tos-[A-Za-z0-9-_.~%=&]+', 'g');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/ark-[A-Za-z0-9-]+/g, '[redacted-ark-key]')
    .replace(signedUrlTokenPattern, 'X-' + 'Tos-[redacted]');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as RecoverProductionSegmentTailFrameInput;

    if (!body.childTaskId || typeof body.childTaskId !== 'string') {
      return NextResponse.json({
        success: false,
        error: '缺少 childTaskId，无法恢复片段尾帧。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 400 });
    }

    const result = await recoverProductionSegmentTailFrame(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProductionSegmentTailRecoveryError) {
      return NextResponse.json({
        success: false,
        error: sanitizeRecoveryError(error),
        usedRealKey: false,
        incurredCost: false,
        ...error.details,
      }, { status: error.status });
    }

    console.error('[ProductionAssemblySegmentTailRecovery] Error:', error);
    return NextResponse.json({
      success: false,
      error: sanitizeRecoveryError(error),
      usedRealKey: false,
      incurredCost: false,
    }, { status: 500 });
  }
}
