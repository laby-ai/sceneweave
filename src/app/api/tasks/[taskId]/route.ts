import { NextRequest, NextResponse } from 'next/server';
import { cancelTask, getTask, getTaskFresh, retryTask } from '@/lib/task-manager';

// 获取单个任务详情（含进度）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const task = getTaskFresh(taskId);

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在', task: null },
        { status: 404 }
      );
    }

    // 返回任务信息（排除不可序列化的 abortController）
    const { abortController, ...taskInfo } = task;

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
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const task = getTask(taskId);

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
    const updatedTask = getTask(taskId);

    return NextResponse.json({
      success: cancelled,
      task: updatedTask,
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
    const { taskId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action !== 'retry') {
      return NextResponse.json(
        { success: false, error: `未知操作: ${action || 'empty'}` },
        { status: 400 }
      );
    }

    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在', task: null },
        { status: 404 }
      );
    }

    const retriedTask = retryTask(taskId);
    if (!retriedTask) {
      return NextResponse.json(
        { success: false, error: '任务不存在或状态不允许重试', task },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      task: retriedTask,
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
