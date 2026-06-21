import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, deleteTask, cleanupExpiredTasks } from '@/lib/task-manager';
import { TaskMonitor, ContentSafety } from '@/lib/video-monitor';
import type { MonitorTaskStatus } from '@/lib/video-monitor';

// 获取所有任务列表（整合监控系统数据）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const withLogs = searchParams.get('withLogs') === 'true';
    const withSafety = searchParams.get('withSafety') === 'true';

    const cleanupCount = cleanupExpiredTasks();
    let tasks = getAllTasks();

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
    const sanitizedTasks = tasks.map(({ abortController, ...taskInfo }) => {
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
      ? TaskMonitor.getAllTasks(monitorStatus)
      : TaskMonitor.getAllTasks();

    return NextResponse.json({
      success: true,
      tasks: sanitizedTasks,
      monitorTasks,
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
      const success = deleteTask(taskId);
      // 同步删除监控任务
      TaskMonitor.deleteTask(taskId);
      if (success) {
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
    const body = await request.json();
    const { action, taskId, prompt, userId, projectName } = body;

    switch (action) {
      case 'create': {
        const monitorTask = TaskMonitor.createTask(
          userId || 'anonymous',
          projectName,
        );
        return NextResponse.json({ success: true, task: monitorTask });
      }

      case 'retry': {
        const result = TaskMonitor.retryTask(taskId);
        if (!result) {
          return NextResponse.json(
            { error: '任务不存在或状态不允许重试' },
            { status: 400 },
          );
        }
        return NextResponse.json({ success: true, task: result.task, decision: result.decision });
      }

      case 'safety_check': {
        if (!prompt) {
          return NextResponse.json(
            { error: '请提供prompt参数' },
            { status: 400 },
          );
        }
        const checks = await ContentSafety.fullCheck(prompt, undefined, taskId);
        return NextResponse.json({ success: true, checks });
      }

      case 'copyright_check': {
        const task = TaskMonitor.getTask(taskId);
        if (!task) {
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
        const lastKnownUpdatedAt = body.lastKnownUpdatedAt || 0;
        const reconnectData = TaskMonitor.reconnect(taskId, lastKnownUpdatedAt);
        if (!reconnectData) {
          return NextResponse.json(
            { error: '任务不存在' },
            { status: 404 },
          );
        }
        return NextResponse.json({ success: true, ...reconnectData });
      }

      case 'transition': {
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
