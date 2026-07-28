import { streamCreationTask } from '@/lib/creation-agent/creation-task-stream';
import { clientApiRequest } from '@/lib/client-api';
import type { VimaxReferenceTaskResult } from './vimax-reference-task-runtime';

interface WaitForVimaxBackgroundReferenceTaskInput {
  taskId: string;
  requestId: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (progress: number, stage: string, message: string) => void;
}

interface PublicReferenceTask {
  status?: string;
  error?: string;
  progress?: number;
  stage?: string;
  message?: string;
  result?: { vimaxReferenceResult?: VimaxReferenceTaskResult };
}

export async function waitForVimaxBackgroundReferenceTask(
  input: WaitForVimaxBackgroundReferenceTaskInput,
): Promise<VimaxReferenceTaskResult> {
  let afterSeq = 0;
  for (let reconnect = 0; reconnect < 12; reconnect += 1) {
    await streamCreationTask({
      taskId: input.taskId,
      requestId: input.requestId,
      headers: input.headers,
      afterSeq,
      signal: input.signal,
      onSeq: seq => { afterSeq = Math.max(afterSeq, seq); },
      onEvent: event => input.onProgress?.(
        event.progress ?? 0,
        event.stage || '参考图生成中',
        event.message || '',
      ),
    });

    const response = await clientApiRequest(`/api/tasks/${encodeURIComponent(input.taskId)}`, {
      headers: input.headers,
      signal: input.signal,
      redirectOnUnauthorized: false,
    });
    const payload = await response.json().catch(() => ({})) as {
      task?: PublicReferenceTask;
      error?: string;
    };
    if (!response.ok || !payload.task) throw new Error(payload.error || '参考图任务无法恢复。');
    input.onProgress?.(
      payload.task.progress ?? 0,
      payload.task.stage || '参考图生成中',
      payload.task.message || '',
    );
    if (payload.task.status === 'completed') {
      const result = payload.task.result?.vimaxReferenceResult;
      if (!result) throw new Error('参考图任务已结束，但未找到生成结果。');
      return result;
    }
    if (payload.task.status === 'failed') throw new Error(payload.task.error || '参考图生成失败。');
    if (payload.task.status === 'cancelled') throw new Error('本次参考图生成已取消。');
  }
  throw new Error('参考图任务仍在运行，请刷新后继续查看。');
}
