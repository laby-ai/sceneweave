import type { BYOKConnection } from '@/lib/byok-provider';

export type VimaxPlanningFailureCode =
  | 'planning_provider_unavailable'
  | 'planning_provider_auth_failed'
  | 'planning_model_unavailable'
  | 'planning_provider_failed';

export interface VimaxPlanningFailure {
  success: false;
  provider: 'planning';
  code: VimaxPlanningFailureCode;
  error: string;
}

function planningFailure(code: VimaxPlanningFailureCode): VimaxPlanningFailure {
  const error = code === 'planning_provider_auth_failed'
    ? '规划模型连接不可用，请检查 API Base、API Key 和模型名后重试。'
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
  const message = error instanceof Error ? error.message : '';
  return planningFailure(/API key|Authentication|Unauthorized|\b401\b|认证|密钥/i.test(message)
    ? 'planning_provider_auth_failed'
    : 'planning_provider_failed');
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
      const failure = planningFailure(response.status === 401 || response.status === 403
        ? 'planning_provider_auth_failed'
        : 'planning_provider_failed');
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
      const failure = planningFailure(probe.status === 401 || probe.status === 403
        ? 'planning_provider_auth_failed'
        : 'planning_provider_failed');
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
