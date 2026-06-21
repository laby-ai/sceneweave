import { NextRequest, NextResponse } from 'next/server';
import { patchProductionAssetFromCanvas } from '@/lib/production-asset-writeback';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; assetId: string }> },
) {
  try {
    const { taskId, assetId } = await params;
    const body = await request.json().catch(() => ({}));

    const result = patchProductionAssetFromCanvas({
      taskId,
      assetId,
      patch: {
        name: body.name,
        summary: body.summary,
        status: body.status,
        metadata: body.metadata,
      },
    });

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId: result.task.id,
      productionProjectId: result.productionProject.id,
      asset: result.asset,
      changedFields: result.changedFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '画布资产写回失败';
    const status = message.includes('不存在') || message.includes('缺少 productionProject') ? 404 : 400;

    return NextResponse.json(
      {
        success: false,
        usedRealKey: false,
        incurredCost: false,
        error: message,
      },
      { status },
    );
  }
}
