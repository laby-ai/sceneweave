import { NextRequest, NextResponse } from 'next/server';
import { patchProductionStoryboardShotFromCanvas } from '@/lib/production-storyboard-writeback';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; shotId: string }> },
) {
  try {
    const { taskId, shotId } = await params;
    const body = await request.json().catch(() => ({}));

    const result = patchProductionStoryboardShotFromCanvas({
      taskId,
      shotId,
      patch: {
        prompt: body.prompt,
        duration: body.duration,
        shotType: body.shotType,
        shotTypeLabel: body.shotTypeLabel,
        subtitleText: body.subtitleText,
        narrationText: body.narrationText,
        status: body.status,
      },
    });

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId: result.task.id,
      productionProjectId: result.productionProject.id,
      shot: result.shot,
      storyboard: result.productionProject.storyboard,
      changedFields: result.changedFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '分镜镜头写回失败';
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
