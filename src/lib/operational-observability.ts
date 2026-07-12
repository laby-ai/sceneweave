import { createHmac, randomUUID } from 'node:crypto';

import { currentRequestId } from './request-observability';

type LogWriter = (line: string) => void;

export interface ObservationOwner {
  tenantId: string;
  memberId: string;
}

interface TaskEventInput {
  owner?: ObservationOwner;
  taskId: string;
  taskType: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  startedAt?: number;
  errorType?: string;
}

interface ProviderObservationInput {
  owner: ObservationOwner;
  taskId: string;
  provider: string;
}

const SAFE_PROVIDER = /^[a-z0-9._-]{2,64}$/;

function hashKey(): string {
  return process.env.HUIYING_OBSERVABILITY_HASH_KEY?.trim() || '';
}

export function getOperationalObservabilityReadiness() {
  const ready = Buffer.byteLength(hashKey(), 'utf8') >= 32;
  return {
    ready,
    blockers: ready ? [] : ['observability_identity_hash_unavailable'],
  };
}

export function createSecureRef(namespace: 'tenant' | 'member' | 'task', value: string): string {
  if (!getOperationalObservabilityReadiness().ready) {
    throw new Error('operational_observability_not_ready');
  }
  const prefix = namespace === 'tenant' ? 'tn' : namespace === 'member' ? 'mb' : 'tk';
  const digest = createHmac('sha256', hashKey())
    .update(`${namespace}\0${value}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
  return `${prefix}_${digest}`;
}

function requestId(): string {
  return currentRequestId() || `background:${randomUUID()}`;
}

function writeEvent(
  event: string,
  level: 'info' | 'warn' | 'error',
  fields: Record<string, string | number | boolean | undefined>,
  writeLog: LogWriter,
) {
  const payload = Object.fromEntries(Object.entries({
    timestamp: new Date().toISOString(),
    level,
    service: 'huiying',
    event,
    requestId: requestId(),
    ...fields,
  }).filter(([, value]) => value !== undefined));
  writeLog(JSON.stringify(payload));
}

export function emitTaskStateEvent(
  input: TaskEventInput,
  writeLog: LogWriter = line => console.log(line),
): boolean {
  if (!input.owner || !getOperationalObservabilityReadiness().ready) return false;
  const durationMs = input.startedAt ? Math.max(0, Date.now() - input.startedAt) : undefined;
  writeEvent(
    `task.${input.status}`,
    input.status === 'failed' ? 'error' : input.status === 'cancelled' ? 'warn' : 'info',
    {
      tenantRef: createSecureRef('tenant', input.owner.tenantId),
      memberRef: createSecureRef('member', input.owner.memberId),
      taskRef: createSecureRef('task', input.taskId),
      taskType: input.taskType,
      status: input.status,
      durationMs,
      errorType: input.errorType,
    },
    writeLog,
  );
  return true;
}

export async function observeProviderCall<T>(
  input: ProviderObservationInput,
  operation: () => Promise<T>,
  writeLog: LogWriter = line => console.log(line),
): Promise<T> {
  if (!getOperationalObservabilityReadiness().ready) return operation();
  if (!SAFE_PROVIDER.test(input.provider)) throw new Error('invalid_provider_observation_name');

  const common = {
    tenantRef: createSecureRef('tenant', input.owner.tenantId),
    memberRef: createSecureRef('member', input.owner.memberId),
    taskRef: createSecureRef('task', input.taskId),
    provider: input.provider,
  };
  const startedAt = Date.now();
  writeEvent('provider.started', 'info', common, writeLog);
  try {
    const result = await operation();
    writeEvent('provider.succeeded', 'info', { ...common, durationMs: Date.now() - startedAt }, writeLog);
    return result;
  } catch (error) {
    writeEvent('provider.failed', 'error', {
      ...common,
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }, writeLog);
    throw error;
  }
}

export function emitOperationalSystemEvent(
  event: string,
  fields: { level?: 'info' | 'warn' | 'error'; count?: number; errorType?: string },
  writeLog: LogWriter = line => console.log(line),
) {
  writeEvent(event, fields.level || 'info', { count: fields.count, errorType: fields.errorType }, writeLog);
}
