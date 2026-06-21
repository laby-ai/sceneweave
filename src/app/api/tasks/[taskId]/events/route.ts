import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupExpiredTasks,
  getTask,
  type BackgroundTask,
  type TaskStatus,
} from '@/lib/task-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STREAM_INTERVAL_MS = 2000;
const STREAM_MAX_MS = 10 * 60 * 1000;
const TERMINAL_STATUSES = new Set<TaskStatus>(['completed', 'failed', 'cancelled']);

function getWaitingHint(task: BackgroundTask, elapsedSeconds: number): string {
  if (task.status === 'pending') {
    return '任务已进入队列，稍后会自动开始。你可以离开当前页面，任务中心会保留进度。';
  }

  if (task.status === 'running') {
    if (task.progress < 15) {
      return '正在准备模型、素材和生成参数，长视频任务可能需要更久，请保持任务在后台运行。';
    }

    if (task.progress < 55) {
      return '正在生成核心镜头内容。视频、分镜和多素材任务通常会停留在此阶段较久。';
    }

    if (task.progress < 90) {
      return '正在合成与检查结果，若网络或供应商排队较慢，任务中心会继续轮询。';
    }

    return '结果即将完成，正在做最后保存与回传。';
  }

  if (task.status === 'completed') {
    return '任务已完成，结果可在任务中心回看和复用。';
  }

  if (task.status === 'cancelled') {
    return '任务已取消，可从任务中心重新编辑配置后再次生成。';
  }

  if (task.error?.includes('超时')) {
    return '任务长时间无响应，系统已标记失败。建议检查 API Base、Key、供应商任务状态后重试。';
  }

  if (task.error?.includes('API') || task.error?.includes('配置')) {
    return '供应商配置或调用失败。请先到设置页检查 API Base、API Key 和模型名称。';
  }

  if (elapsedSeconds > 60) {
    return '任务已运行超过 1 分钟，如果没有继续推进，请保留任务记录并检查供应商后台状态。';
  }

  return '任务失败，可查看错误信息并从任务中心重试。';
}

function serializeTask(task: BackgroundTask) {
  const { abortController, ...taskInfo } = task;
  void abortController;

  const startedAt = task.startedAt ?? task.createdAt;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  return {
    ...taskInfo,
    elapsedSeconds,
    isTerminal: TERMINAL_STATUSES.has(task.status),
    nextPollMs: STREAM_INTERVAL_MS,
    waitingHint: getWaitingHint(task, elapsedSeconds),
  };
}

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  cleanupExpiredTasks();
  if (!getTask(taskId)) {
    return NextResponse.json(
      {
        success: false,
        error: '任务不存在',
        task: null,
      },
      { status: 404 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const timers: {
        interval?: ReturnType<typeof setInterval>;
        timeout?: ReturnType<typeof setTimeout>;
      } = {};

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(formatSse(event, data)));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (timers.interval) clearInterval(timers.interval);
        if (timers.timeout) clearTimeout(timers.timeout);
        request.signal.removeEventListener('abort', handleAbort);
        controller.close();
      };

      const handleAbort = () => close();

      const emitTask = () => {
        cleanupExpiredTasks();
        const task = getTask(taskId);

        if (!task) {
          send('error', {
            success: false,
            error: '任务不存在或已被清理',
            task: null,
          });
          close();
          return;
        }

        const payload = {
          success: true,
          task: serializeTask(task),
        };

        send('task', payload);

        if (TERMINAL_STATUSES.has(task.status)) {
          send('done', payload);
          close();
        }
      };

      request.signal.addEventListener('abort', handleAbort, { once: true });
      controller.enqueue(encoder.encode(`retry: ${STREAM_INTERVAL_MS}\n\n`));

      emitTask();
      timers.interval = setInterval(emitTask, STREAM_INTERVAL_MS);
      timers.timeout = setTimeout(() => {
        send('heartbeat', {
          success: true,
          message: '事件流已达到本次连接时长上限，任务仍会在后台运行。请重新连接或回到任务中心继续查看。',
          nextPollMs: STREAM_INTERVAL_MS,
        });
        close();
      }, STREAM_MAX_MS);
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  });
}
