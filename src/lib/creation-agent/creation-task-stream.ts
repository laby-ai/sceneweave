import type { CreationEvent, CreationResult, CreationStatus } from './creation-agent-model';
import { parseCreationProductionPlan } from './creation-production-plan';
import { clientApiRequest } from '@/lib/client-api';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const TASK_STATUS: Record<string, Exclude<CreationStatus, 'idle' | 'submitting'>> = {
  pending: 'reconnecting',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

export function parseCreationTaskSseMessage(
  eventName: string,
  dataText: string,
  requestId: string,
): CreationEvent | null {
  if (eventName !== 'task' && eventName !== 'done') return null;
  try {
    const payload: unknown = JSON.parse(dataText);
    if (!isRecord(payload) || !isRecord(payload.task)) return null;
    const task = payload.task;
    const taskId = typeof task.id === 'string' ? task.id : '';
    const status = typeof task.status === 'string' ? TASK_STATUS[task.status] : undefined;
    if (!taskId || !status) return null;

    let result: CreationResult | undefined;
    if (status === 'completed' && isRecord(task.result)) {
      const project = isRecord(task.result.project) ? task.result.project : {};
      const shots = Array.isArray(task.result.shots) ? task.result.shots : [];
      result = {
        title: typeof project.title === 'string' ? project.title : '未命名创作',
        shotCount: shots.length,
        shots: shots
          .filter(isRecord)
          .map((shot, index) => ({
            id: typeof shot.id === 'string' ? shot.id : `shot-${index + 1}`,
            index: typeof shot.index === 'number' ? shot.index : index + 1,
            duration: typeof shot.duration === 'number' ? shot.duration : 0,
            phaseLabel: typeof shot.phaseLabel === 'string' ? shot.phaseLabel : '分镜',
            shotTypeLabel: typeof shot.shotTypeLabel === 'string' ? shot.shotTypeLabel : '镜头',
            prompt: typeof shot.prompt === 'string' ? shot.prompt : '',
            caption: typeof shot.subtitleText === 'string'
              ? shot.subtitleText
              : typeof shot.narrationText === 'string' ? shot.narrationText : '',
          })),
        productionPlan: parseCreationProductionPlan(task.result.productionPlan),
      };
    }

    return {
      requestId,
      taskId,
      status,
      stage: typeof task.stage === 'string' ? task.stage : '',
      progress: typeof task.progress === 'number' ? task.progress : 0,
      message: typeof task.message === 'string' ? task.message : '',
      ...(result ? { result } : {}),
    };
  } catch {
    return null;
  }
}

interface StreamCreationTaskInput {
  taskId: string;
  requestId: string;
  headers: Record<string, string>;
  afterSeq?: number;
  signal?: AbortSignal;
  onEvent: (event: CreationEvent) => void;
  onSeq?: (seq: number) => void;
}

export async function streamCreationTask(input: StreamCreationTaskInput): Promise<void> {
  const afterSeq = Number.isSafeInteger(input.afterSeq) && Number(input.afterSeq) > 0
    ? Number(input.afterSeq)
    : 0;
  const query = afterSeq > 0 ? `?afterSeq=${afterSeq}` : '';
  const response = await clientApiRequest(`/api/tasks/${encodeURIComponent(input.taskId)}/events${query}`, {
    headers: {
      ...input.headers,
      ...(afterSeq > 0 ? { 'Last-Event-ID': String(afterSeq) } : {}),
    },
    signal: input.signal,
    redirectOnUnauthorized: false,
  });
  if (!response.ok || !response.body) throw new Error(`task_stream_${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const eventName = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || '';
      const dataText = block.match(/^data:\s*(.+)$/m)?.[1]?.trim() || '';
      const seq = Number(block.match(/^id:\s*(\d+)$/m)?.[1]);
      if (Number.isSafeInteger(seq) && seq > afterSeq) input.onSeq?.(seq);
      const event = parseCreationTaskSseMessage(eventName, dataText, input.requestId);
      if (event) input.onEvent(event);
    }
    if (done) return;
  }
}
