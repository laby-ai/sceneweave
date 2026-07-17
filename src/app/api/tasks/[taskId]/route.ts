import { NextRequest, NextResponse } from 'next/server';
import { cancelTask, getTaskForOwner, retryTask, updateTask } from '@/lib/task-manager';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';
import { approveVimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

function publicTask(task: NonNullable<ReturnType<typeof getTaskForOwner>>) {
  const { abortController: _abortController, owner: _owner, idempotencyHash: _idempotencyHash, ...taskInfo } = task;
  void _abortController;
  void _owner;
  void _idempotencyHash;
  return taskInfo;
}

// 获取单个任务详情（含进度）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const access = await resolvePaperHostCreationOwnerFromRequest(request);
    if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const { owner } = access;
    const { taskId } = await params;
    const task = getTaskForOwner(taskId, owner);

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在', task: null },
        { status: 404 }
      );
    }

    // 返回任务信息（排除不可序列化的 abortController）
    const taskInfo = publicTask(task);

    return NextResponse.json({
      success: true,
      task: {
        ...taskInfo,
        // 确保进度字段存在
        progress: taskInfo.progress ?? 0,
        status: taskInfo.status ?? 'pending',
        stage: taskInfo.stage ?? '',
        message: taskInfo.message ?? '',
      },
    });
  } catch (error) {
    console.error('获取任务详情错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 取消单个任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const access = await resolvePaperHostCreationOwnerFromRequest(request);
    if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const { owner } = access;
    const { taskId } = await params;
    const task = getTaskForOwner(taskId, owner);

    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在', task: null },
        { status: 404 }
      );
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: '任务已结束，不能取消', task },
        { status: 400 }
      );
    }

    const cancelled = cancelTask(taskId);
    const updatedTask = getTaskForOwner(taskId, owner);

    return NextResponse.json({
      success: cancelled,
      task: updatedTask ? publicTask(updatedTask) : null,
      message: cancelled ? '任务已取消' : '取消任务失败',
    }, { status: cancelled ? 200 : 500 });
  } catch (error) {
    console.error('取消任务错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 单任务操作：目前支持重试失败或已取消任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const access = await resolvePaperHostCreationOwnerFromRequest(request);
    if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const { owner } = access;
    const { taskId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'approve-production-plan') {
      const task = getTaskForOwner(taskId, owner);
      if (!task) {
        return NextResponse.json(
          { success: false, error: '任务不存在', task: null },
          { status: 404 },
        );
      }
      const productionPlan = approveVimaxProductionPlan(task.result?.productionPlan);
      updateTask(taskId, {
        result: { ...task.result, productionPlan },
      });
      return NextResponse.json({
        success: true,
        usedRealKey: false,
        incurredCost: false,
        productionPlan,
        message: '制作计划已确认，可继续准备参考素材。',
      });
    }

    if (action !== 'retry') {
      return NextResponse.json(
        { success: false, error: `未知操作: ${action || 'empty'}` },
        { status: 400 }
      );
    }

    const task = getTaskForOwner(taskId, owner);
    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在', task: null },
        { status: 404 }
      );
    }

    const retriedTask = retryTask(taskId);
    if (!retriedTask) {
      return NextResponse.json(
        { success: false, error: '任务不存在或状态不允许重试', task: publicTask(task) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      task: publicTask(retriedTask),
      message: '任务已重新排队',
    });
  } catch (error) {
    console.error('任务操作错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
