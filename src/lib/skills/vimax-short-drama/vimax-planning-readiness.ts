import type { BYOKConnection } from '@/lib/byok-provider';

export type VimaxPlanningFailureCode =
  | 'planning_provider_unavailable'
  | 'planning_provider_auth_failed'
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

export async function callWithSanitizedVimaxPlanningFailure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new Error(sanitizeVimaxPlanningFailure(error).error);
  }
}
