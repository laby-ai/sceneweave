import type { VimaxAgentPlan } from './vimax-agent-contract';
import { parseVimaxProductionPlan, type VimaxProductionPlan } from './vimax-production-plan';

type UnknownRecord = Record<string, unknown>;

export interface RecoveredPersistedVimaxPlan {
  taskId: string;
  plan: VimaxAgentPlan;
  productionPlan: VimaxProductionPlan;
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

function parseAgentPlan(value: unknown): VimaxAgentPlan | null {
  if (!isRecord(value) || typeof value.title !== 'string' || !value.title.trim()) return null;
  if (!Array.isArray(value.assets) || !Array.isArray(value.shots) || value.shots.length === 0) return null;
  return value as unknown as VimaxAgentPlan;
}

export function recoverPersistedVimaxPlan(
  task: unknown,
  expectedTaskId: string,
): RecoveredPersistedVimaxPlan | null {
  if (!isRecord(task) || task.status !== 'completed' || task.id !== expectedTaskId) return null;
  const result = isRecord(task.result) ? task.result : null;
  const plan = parseAgentPlan(result?.vimaxPlan);
  const productionPlan = parseVimaxProductionPlan(result?.productionPlan);
  if (!plan || !productionPlan) return null;
  return { taskId: expectedTaskId, plan, productionPlan };
}

interface WaitForPersistedVimaxPlanInput {
  taskId: string;
  loadTask: (taskId: string) => Promise<unknown>;
  signal?: AbortSignal;
  maxAttempts?: number;
  intervalMs?: number;
}

function terminalTaskStatus(task: unknown): boolean {
  return isRecord(task) && ['completed', 'failed', 'cancelled'].includes(String(task.status));
}

function wait(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (intervalMs <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, intervalMs);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason || new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function waitForPersistedVimaxPlan({
  taskId,
  loadTask,
  signal,
  maxAttempts = 12,
  intervalMs = 500,
}: WaitForPersistedVimaxPlanInput): Promise<RecoveredPersistedVimaxPlan | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    const task = await loadTask(taskId);
    const recovered = recoverPersistedVimaxPlan(task, taskId);
    if (recovered) return recovered;
    if (terminalTaskStatus(task)) return null;
    if (attempt < maxAttempts - 1) await wait(intervalMs, signal);
  }
  return null;
}
