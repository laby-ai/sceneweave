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
