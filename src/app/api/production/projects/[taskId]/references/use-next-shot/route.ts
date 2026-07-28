import { NextRequest, NextResponse } from 'next/server';

import { resolveTaskOwnerFromRequest } from '@/lib/task-access';
import { assignVimaxShotReferenceToNextShot } from '@/lib/skills/vimax-short-drama/vimax-reference-context-action';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const owner = await resolveTaskOwnerFromRequest(request);
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  try {
    const { taskId } = await context.params;
    const body = await request.json() as {
      sourceShotIndex?: unknown;
      targetShotIndex?: unknown;
    };
    const sourceShotIndex = Number(body.sourceShotIndex);
    const targetShotIndex = Number(body.targetShotIndex);
    if (!Number.isInteger(sourceShotIndex) || sourceShotIndex < 1) {
      return NextResponse.json({ error: 'sourceShotIndex_invalid' }, { status: 400 });
    }
    if (!Number.isInteger(targetShotIndex) || targetShotIndex < 2) {
      return NextResponse.json({ error: 'targetShotIndex_invalid' }, { status: 400 });
    }

    const result = assignVimaxShotReferenceToNextShot({
      taskId,
      owner,
      sourceShotIndex,
      targetShotIndex,
    });
    return NextResponse.json({
      success: true,
      sourceShotIndex: result.sourceShotIndex,
      targetShotIndex: result.targetShotIndex,
      targetReference: result.targetReference,
      references: result.references,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '参考画面保存失败';
    const status = /不存在|无权/.test(message) ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
