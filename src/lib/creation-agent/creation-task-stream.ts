import type { CreationEvent, CreationResult, CreationStatus } from './creation-agent-model';

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
        title: typeof project.title === 'string' ? project.title : '科教创作方案',
        shotCount: shots.length,
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
  signal?: AbortSignal;
  onEvent: (event: CreationEvent) => void;
}

export async function streamCreationTask(input: StreamCreationTaskInput): Promise<void> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(input.taskId)}/events`, {
    headers: input.headers,
    signal: input.signal,
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
      const event = parseCreationTaskSseMessage(eventName, dataText, input.requestId);
      if (event) input.onEvent(event);
    }
    if (done) return;
  }
}
