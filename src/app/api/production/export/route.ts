import { NextRequest, NextResponse } from 'next/server';

import { buildProductionCutDraftJson } from '@/lib/production-export-package';
import { getTaskForOwner } from '@/lib/task-manager';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';

export const dynamic = 'force-dynamic';

function attachmentName(taskId: string) {
  return `huiying-cut-draft-${taskId.slice(0, 8)}.json`;
}

export async function GET(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { owner } = access;
  try {
    const taskId = request.nextUrl.searchParams.get('taskId')?.trim();
    const format = request.nextUrl.searchParams.get('format') || 'cut-draft-json';

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 taskId，无法导出制作草稿',
          usedRealKey: false,
          incurredCost: false,
        },
        { status: 400 },
      );
    }

    if (format !== 'cut-draft-json') {
      return NextResponse.json(
        {
          success: false,
          error: `暂不支持导出格式：${format}`,
          supportedFormats: ['cut-draft-json'],
          usedRealKey: false,
          incurredCost: false,
        },
        { status: 400 },
      );
    }

    const task = getTaskForOwner(taskId, owner);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: `任务 ${taskId} 不存在或已过期`,
          usedRealKey: false,
          incurredCost: false,
        },
        { status: 404 },
      );
    }

    const exportPackage = buildProductionCutDraftJson(task);
    return NextResponse.json(
      {
        success: true,
        usedRealKey: false,
        incurredCost: false,
        format,
        taskId: task.id,
        exportPackage,
      },
      {
        headers: {
          'Content-Disposition': `attachment; filename="${attachmentName(task.id)}"`,
        },
      },
    );
  } catch (error) {
    console.error('[ProductionExport] cut draft export failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导出制作草稿失败',
        usedRealKey: false,
        incurredCost: false,
      },
      { status: 500 },
    );
  }
}
