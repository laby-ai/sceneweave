import type { CreationEvent } from '@/lib/creation-agent/creation-agent-model';
import { streamCreationTask } from '@/lib/creation-agent/creation-task-stream';
import { clientApiRequest } from '@/lib/client-api';

export interface VimaxBackgroundVideoResult {
  videoUrl: string;
  model?: string;
  duration?: number;
  segmentCount?: number;
  recovered?: boolean;
  segments?: Array<{ shotIndex?: number; videoUrl?: string }>;
  [key: string]: unknown;
}

interface WaitForVimaxBackgroundVideoTaskInput {
  taskId: string;
  requestId: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (event: CreationEvent) => void;
}

interface PublicVideoTask {
  status?: string;
  error?: string;
  result?: { vimaxVideoResult?: VimaxBackgroundVideoResult };
}

export async function waitForVimaxBackgroundVideoTask(
  input: WaitForVimaxBackgroundVideoTaskInput,
): Promise<VimaxBackgroundVideoResult> {
  let afterSeq = 0;
  for (let reconnect = 0; reconnect < 12; reconnect += 1) {
    await streamCreationTask({
      taskId: input.taskId,
      requestId: input.requestId,
      headers: input.headers,
      afterSeq,
      signal: input.signal,
      onSeq: seq => { afterSeq = Math.max(afterSeq, seq); },
      onEvent: event => input.onProgress?.(event),
    });

    const response = await clientApiRequest(`/api/tasks/${encodeURIComponent(input.taskId)}`, {
      headers: input.headers,
      signal: input.signal,
      redirectOnUnauthorized: false,
    });
    const payload = await response.json().catch(() => ({})) as { task?: PublicVideoTask; error?: string };
    if (!response.ok || !payload.task) throw new Error(payload.error || '后台视频任务无法恢复。');
    if (payload.task.status === 'completed') {
      const result = payload.task.result?.vimaxVideoResult;
      if (!result?.videoUrl) throw new Error('后台视频任务已结束，但未找到可交付成片。');
      return result;
    }
    if (payload.task.status === 'failed') throw new Error(payload.task.error || '后台视频生成失败。');
    if (payload.task.status === 'cancelled') throw new Error('本次视频生成已取消。');
  }
  throw new Error('后台视频任务仍在运行，请刷新后继续查看。');
}
