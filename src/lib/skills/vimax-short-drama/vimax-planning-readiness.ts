import type { BYOKConnection } from '@/lib/byok-provider';
import { emitOperationalSystemEvent } from '@/lib/operational-observability';

export type VimaxPlanningFailureCode =
  | 'planning_provider_unavailable'
  | 'planning_provider_auth_failed'
  | 'planning_provider_permission_denied'
  | 'planning_model_unavailable'
  | 'planning_provider_failed';

export interface VimaxPlanningFailure {
  success: false;
  provider: 'planning';
  code: VimaxPlanningFailureCode;
  error: string;
}

const SAFE_PROVIDER_CODE = /^[A-Za-z0-9._-]{1,64}$/;

class VimaxPlanningProviderError extends Error {
  constructor(
    readonly status: number,
    readonly providerCode: string,
    readonly failure: VimaxPlanningFailure,
  ) {
    super(failure.error);
    this.name = 'VimaxPlanningProviderError';
  }
}

function planningFailure(code: VimaxPlanningFailureCode): VimaxPlanningFailure {
  const error = code === 'planning_provider_auth_failed'
    ? '百炼 API Key 无效，请检查后重试。'
    : code === 'planning_provider_permission_denied'
      ? '百炼 API Key 暂无权调用固定规划模型，请在百炼控制台授权 qwen3.7-plus，并检查 API Key 的 IP 白名单。'
    : code === 'planning_model_unavailable'
      ? '连接已通过，但未找到所选规划模型，请检查模型名后重试。'
    : code === 'planning_provider_unavailable'
      ? '规划模型暂不可用，请先连接可用的规划模型后重试。'
      : '规划暂时失败，输入和项目已保留，请稍后重试或更换规划模型。';
  return { success: false, provider: 'planning', code, error };
}

export function resolveVimaxPlanningReadinessFailure(
  connection: BYOKConnection | undefined,
  fallbackApiKey: string | undefined,
): VimaxPlanningFailure | null {
  if (connection?.provider === 'happyhorse-dashscope') {
    return planningFailure('planning_provider_unavailable');
  }
  if (connection && !connection.model) {
    return planningFailure('planning_provider_unavailable');
  }
  if (!connection && !fallbackApiKey) {
    return planningFailure('planning_provider_unavailable');
  }
  return null;
}

export function sanitizeVimaxPlanningFailure(error: unknown): VimaxPlanningFailure {
  if (error instanceof VimaxPlanningProviderError) return error.failure;
  const message = error instanceof Error ? error.message : '';
  return planningFailure(/Access denied|API-Key restrictions|\b403\b/i.test(message)
    ? 'planning_provider_permission_denied'
    : /API key|Authentication|Unauthorized|\b401\b|认证|密钥/i.test(message)
      ? 'planning_provider_auth_failed'
      : 'planning_provider_failed');
}

function readProviderCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'unknown';
  const error = 'error' in payload ? (payload as { error?: unknown }).error : undefined;
  const value = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code
    : 'code' in payload ? (payload as { code?: unknown }).code : undefined;
  return typeof value === 'string' && SAFE_PROVIDER_CODE.test(value) ? value : 'unknown';
}

export function createVimaxPlanningProviderError(status: number, payload: unknown): Error {
  return new VimaxPlanningProviderError(
    status,
    readProviderCode(payload),
    planningFailure(planningFailureCodeForStatus(status)),
  );
}

export function getVimaxPlanningProviderDiagnostic(error: unknown): string | null {
  return error instanceof VimaxPlanningProviderError
    ? `http_${error.status}_${error.providerCode}`
    : null;
}

export function reportVimaxPlanningFailure(error: unknown): VimaxPlanningFailure {
  const diagnostic = getVimaxPlanningProviderDiagnostic(error);
  if (diagnostic) {
    emitOperationalSystemEvent('planning.provider_rejected', { level: 'error', errorType: diagnostic });
  }
  return sanitizeVimaxPlanningFailure(error);
}

function planningFailureCodeForStatus(status: number): VimaxPlanningFailureCode {
  if (status === 401) return 'planning_provider_auth_failed';
  if (status === 403) return 'planning_provider_permission_denied';
  return 'planning_provider_failed';
}

function buildModelDirectoryUrl(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  return base.endsWith('/models') ? base : `${base}/models`;
}

function buildChatCompletionsUrl(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

async function validatePlanningConnection(connection: BYOKConnection | undefined): Promise<Record<string, unknown>> {
  const missing = resolveVimaxPlanningReadinessFailure(connection, undefined);
  if (missing || !connection) return { ...(missing || planningFailure('planning_provider_unavailable')), ready: false };
  try {
    const response = await fetch(buildModelDirectoryUrl(connection.apiBase), {
      method: 'GET',
      headers: { Authorization: `Bearer ${connection.apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const failure = planningFailure(planningFailureCodeForStatus(response.status));
      return { ...failure, ready: false };
    }
    const payload = await response.json().catch(() => null) as { data?: Array<{ id?: unknown }> } | null;
    const models = Array.isArray(payload?.data)
      ? payload.data.map(item => typeof item?.id === 'string' ? item.id.trim() : '').filter(Boolean)
      : [];
    if (!connection.model || !models.includes(connection.model)) {
      return { ...planningFailure('planning_model_unavailable'), ready: false };
    }
    const probe = await fetch(buildChatCompletionsUrl(connection.apiBase), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: connection.model,
        messages: [{ role: 'user', content: '回复 OK' }],
        temperature: 0,
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!probe.ok) {
      const failure = planningFailure(planningFailureCodeForStatus(probe.status));
      return { ...failure, ready: false };
    }
    return { success: true, provider: 'planning', ready: true, model: connection.model };
  } catch (error) {
    return { ...sanitizeVimaxPlanningFailure(error), ready: false };
  }
}

export async function resolveVimaxPlanningConnectionPhase(
  phase: string,
  connection: BYOKConnection | undefined,
  fallbackApiKey: string | undefined,
): Promise<{ status: number; payload: Record<string, unknown> } | null> {
  if (phase === 'planning_readiness') {
    const failure = resolveVimaxPlanningReadinessFailure(connection, fallbackApiKey);
    return { status: 200, payload: failure ? { ...failure, phase, ready: false } : { success: true, provider: 'planning', phase, ready: true } };
  }
  if (phase !== 'planning_connection_validate') return null;
  return { status: 200, payload: { ...(await validatePlanningConnection(connection)), phase } };
}

export async function callWithSanitizedVimaxPlanningFailure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new Error(sanitizeVimaxPlanningFailure(error).error);
  }
}
