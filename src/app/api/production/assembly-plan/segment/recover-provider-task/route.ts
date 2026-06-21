import { NextRequest, NextResponse } from 'next/server';

import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';
import {
  ProductionSegmentProviderRecoveryError,
  recoverProductionSegmentProviderTask,
  type RecoverProductionSegmentProviderTaskInput,
} from '@/lib/production-segment-provider-recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeRecoveryError(error: unknown) {
  const message = error instanceof Error ? error.message : '供应商片段恢复失败';
  const signedUrlTokenPattern = new RegExp('X-' + 'Tos-[A-Za-z0-9-_.~%=&]+', 'g');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/ark-[A-Za-z0-9-]+/g, '[redacted-ark-key]')
    .replace(signedUrlTokenPattern, 'X-' + 'Tos-[redacted]');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as RecoverProductionSegmentProviderTaskInput;

    if (!body.childTaskId || typeof body.childTaskId !== 'string') {
      return NextResponse.json({
        success: false,
        error: '缺少 childTaskId，无法续查供应商片段任务。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 400 });
    }

    let byokConnection;
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

    if (!byokConnection) {
      return NextResponse.json({
        success: false,
        error: '供应商片段恢复需要提供 Ark BYOK API Base、API Key 和视频模型。',
        usedRealKey: false,
        incurredCost: false,
      }, { status: 400 });
    }

    const result = await recoverProductionSegmentProviderTask(body, byokConnection);
    return NextResponse.json(result, { status: result.success ? 200 : 202 });
  } catch (error) {
    if (error instanceof ProductionSegmentProviderRecoveryError) {
      return NextResponse.json({
        success: false,
        error: sanitizeRecoveryError(error),
        usedRealKey: true,
        incurredCost: false,
        ...error.details,
      }, { status: error.status });
    }

    console.error('[ProductionAssemblySegmentProviderRecovery] Error:', error);
    return NextResponse.json({
      success: false,
      error: sanitizeRecoveryError(error),
      usedRealKey: true,
      incurredCost: false,
    }, { status: 500 });
  }
}
