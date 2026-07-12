import { NextRequest, NextResponse } from 'next/server';
import { getAllTasksForOwner, deleteTaskForOwner, cleanupExpiredTasks } from '@/lib/task-manager';
import { monitorOwnerKey, resolveTaskOwnerFromRequest } from '@/lib/task-access';
import { TaskMonitor, ContentSafety } from '@/lib/video-monitor';
import type { MonitorTaskStatus } from '@/lib/video-monitor';

function publicMonitorTask<T extends { userId: string }>(task: T): Omit<T, 'userId'> {
  const { userId: _userId, ...publicTask } = task;
  void _userId;
  return publicTask;
}

// 获取所有任务列表（整合监控系统数据）
export async function GET(request: NextRequest) {
  try {
    const owner = await resolveTaskOwnerFromRequest(request);
    if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const withLogs = searchParams.get('withLogs') === 'true';
    const withSafety = searchParams.get('withSafety') === 'true';

    const cleanupCount = cleanupExpiredTasks();
    let tasks = getAllTasksForOwner(owner);

    // 按状态筛选
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    // 按类型筛选
    if (type) {
      tasks = tasks.filter(task => task.type === type);
    }

    // 限制数量
    tasks = tasks.slice(0, limit);

    // 返回任务信息（不包含abortController）
    const sanitizedTasks = tasks.map(({ abortController, owner: _owner, idempotencyHash: _idempotencyHash, ...taskInfo }) => {
      void abortController;
      void _owner;
      void _idempotencyHash;
      const enriched: Record<string, unknown> = { ...taskInfo };

      // 附加监控系统数据
      if (withLogs) {
        enriched.monitorLogs = TaskMonitor.getTaskLogs(taskInfo.id);
      }
      if (withSafety && (taskInfo as Record<string, unknown>).prompt) {
        enriched.safetyChecks = []; // 安全检查需异步，此处为空
      }

      return enriched;
    });

    // 同时获取监控系统的任务
    const monitorStatus = searchParams.get('monitorStatus') as MonitorTaskStatus | null;
    const monitorTasks = monitorStatus
      ? TaskMonitor.getUserTasks(monitorOwnerKey(owner)).filter(task => task.status === monitorStatus)
      : TaskMonitor.getUserTasks(monitorOwnerKey(owner));
    const sanitizedMonitorTasks = monitorTasks.map(({ userId: _userId, ...task }) => {
      void _userId;
      return task;
    });

    return NextResponse.json({
      success: true,
      tasks: sanitizedTasks,
      monitorTasks: sanitizedMonitorTasks,
      total: sanitizedTasks.length,
      cleanupCount,
    });

  } catch (error) {
    console.error('获取任务列表错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 批量删除任务
export async function DELETE(request: NextRequest) {
  try {
    const owner = await resolveTaskOwnerFromRequest(request);
    if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const body = await request.json();
    const { taskIds } = body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的任务ID列表' },
        { status: 400 }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as string[],
    };

    taskIds.forEach(taskId => {
      const success = deleteTaskForOwner(taskId, owner);
      const ownsMonitorTask = TaskMonitor.getTask(taskId)?.userId === monitorOwnerKey(owner);
      if (ownsMonitorTask) TaskMonitor.deleteTask(taskId);
      if (success || ownsMonitorTask) {
        results.success.push(taskId);
      } else {
        results.failed.push(taskId);
      }
    });

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('批量删除任务错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 创建监测任务 / 重试 / 安全检查
export async function POST(request: NextRequest) {
  try {
    const owner = await resolveTaskOwnerFromRequest(request);
    if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const body = await request.json();
    const { action, taskId, prompt, projectName } = body;

    switch (action) {
      case 'create': {
        const monitorTask = TaskMonitor.createTask(
          monitorOwnerKey(owner),
          projectName,
        );
        return NextResponse.json({ success: true, task: publicMonitorTask(monitorTask) });
      }

      case 'retry': {
        if (TaskMonitor.getTask(taskId)?.userId !== monitorOwnerKey(owner)) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 });
        }
        const result = TaskMonitor.retryTask(taskId);
        if (!result) {
          return NextResponse.json(
            { error: '任务不存在或状态不允许重试' },
            { status: 400 },
          );
        }
        return NextResponse.json({ success: true, task: publicMonitorTask(result.task), decision: result.decision });
      }

      case 'safety_check': {
        if (!prompt) {
          return NextResponse.json(
            { error: '请提供prompt参数' },
            { status: 400 },
          );
        }
        if (taskId && TaskMonitor.getTask(taskId)?.userId !== monitorOwnerKey(owner)) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 });
        }
        const checks = await ContentSafety.fullCheck(prompt, undefined, taskId);
        return NextResponse.json({ success: true, checks });
      }

      case 'copyright_check': {
        const task = TaskMonitor.getTask(taskId);
        if (!task || task.userId !== monitorOwnerKey(owner)) {
          return NextResponse.json(
            { error: '任务不存在' },
            { status: 404 },
          );
        }
        const level = body.level || 'standard';
        const result = ContentSafety.copyrightCheck(task, level);
        return NextResponse.json({ success: true, result });
      }

      case 'reconnect': {
        if (TaskMonitor.getTask(taskId)?.userId !== monitorOwnerKey(owner)) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 });
        }
        const lastKnownUpdatedAt = body.lastKnownUpdatedAt || 0;
        const reconnectData = TaskMonitor.reconnect(taskId, lastKnownUpdatedAt);
        if (!reconnectData) {
          return NextResponse.json(
            { error: '任务不存在' },
            { status: 404 },
          );
        }
        return NextResponse.json({
          success: true,
          ...reconnectData,
          task: publicMonitorTask(reconnectData.task),
        });
      }

      case 'transition': {
        if (TaskMonitor.getTask(taskId)?.userId !== monitorOwnerKey(owner)) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 });
        }
        const event = body.event;
        const reason = body.reason;
        const result = TaskMonitor.transitionStatus(taskId, event, reason);
        if (!result) {
          return NextResponse.json(
            { error: '状态转换失败' },
            { status: 400 },
          );
        }
        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json(
          { error: `未知操作: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('任务操作错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
