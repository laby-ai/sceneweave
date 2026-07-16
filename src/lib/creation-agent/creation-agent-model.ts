export type CreationStatus =
  | 'idle'
  | 'submitting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'reconnecting';

export interface CreationResult {
  title: string;
  shotCount: number;
  downloadUrl?: string;
}

export interface CreationAgentState {
  status: CreationStatus;
  prompt: string;
  requestId?: string;
  taskId?: string;
  attempt: number;
  stage: string;
  progress: number;
  message: string;
  error: string;
  canRetry: boolean;
  result?: CreationResult;
}

export interface BeginCreationInput {
  requestId: string;
  prompt: string;
}

export interface CreationEvent {
  requestId: string;
  taskId?: string;
  status: Exclude<CreationStatus, 'idle' | 'submitting'>;
  stage?: string;
  progress?: number;
  message?: string;
  error?: string;
  result?: CreationResult;
}

export interface PromptValidation {
  valid: boolean;
  message: string;
}

const PAPER_HOST_GUEST_WORKSPACE_PATTERN = /^guest-creation-[a-z0-9-]{16,96}$/;

const DEFAULT_STATE: CreationAgentState = {
  status: 'idle',
  prompt: '',
  attempt: 0,
  stage: '',
  progress: 0,
  message: '',
  error: '',
  canRetry: false,
};

const clampProgress = (progress: number | undefined) => {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Number(progress)));
};

export function buildPaperHostGuestRequestHeaders(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const workspace = params.get('workspaceKey')?.trim() || '';
  if (params.get('embed') !== 'creation-agent' || !PAPER_HOST_GUEST_WORKSPACE_PATTERN.test(workspace)) {
    return {};
  }
  return {
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': workspace,
  };
}

export function createCreationRequestId(
  randomUUID: (() => string) | null | undefined = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
  now = Date.now,
  random = Math.random,
): string {
  if (randomUUID) {
    try {
      return `request-${randomUUID()}`;
    } catch {
      // Correlation ids are not security credentials; continue with a local fallback.
    }
  }

  const suffix = Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36);
  return `request-${now()}-${suffix}`;
}

export function createCreationAgentState(
  restored: Partial<CreationAgentState> = {},
): CreationAgentState {
  return {
    ...DEFAULT_STATE,
    ...restored,
    progress: clampProgress(restored.progress ?? DEFAULT_STATE.progress),
    attempt: Math.max(0, Math.floor(restored.attempt ?? DEFAULT_STATE.attempt)),
  };
}

export function validateCreationPrompt(prompt: string): PromptValidation {
  if (prompt.trim().length < 2) {
    return {
      valid: false,
      message: '请输入至少2个字符的创作想法',
    };
  }
  return { valid: true, message: '' };
}

export function beginCreation(
  state: CreationAgentState,
  input: BeginCreationInput,
): CreationAgentState {
  const prompt = input.prompt.trim();
  const validation = validateCreationPrompt(prompt);
  if (!validation.valid) throw new Error(validation.message);
  if (!input.requestId.trim()) throw new Error('requestId is required');

  return {
    ...state,
    status: 'submitting',
    prompt,
    requestId: input.requestId,
    taskId: undefined,
    attempt: state.attempt + 1,
    stage: '准备创作',
    progress: 0,
    message: '正在创建任务',
    error: '',
    canRetry: false,
    result: undefined,
  };
}

export function applyCreationEvent(
  state: CreationAgentState,
  event: CreationEvent,
): CreationAgentState {
  if (state.status === 'completed' || state.status === 'cancelled') return state;
  if (!state.requestId || event.requestId !== state.requestId) return state;
  if (state.taskId && event.taskId && event.taskId !== state.taskId) return state;

  const taskId = state.taskId ?? event.taskId;
  const completed = event.status === 'completed';
  const failed = event.status === 'failed';
  const cancelled = event.status === 'cancelled';

  return {
    ...state,
    status: event.status,
    taskId,
    stage: event.stage ?? state.stage,
    progress: completed ? 100 : clampProgress(event.progress ?? state.progress),
    message: event.message ?? state.message,
    error: failed ? '创作任务暂时未完成，请稍后重试' : '',
    canRetry: failed || cancelled,
    result: completed ? event.result : state.result,
  };
}

export function retryCreation(state: CreationAgentState): CreationAgentState {
  if (!state.canRetry) return state;
  return {
    ...state,
    status: 'idle',
    requestId: undefined,
    taskId: undefined,
    stage: '',
    progress: 0,
    message: '',
    error: '',
    canRetry: false,
    result: undefined,
  };
}

export function cancelCreation(state: CreationAgentState): CreationAgentState {
  if (state.status !== 'submitting' && state.status !== 'running' && state.status !== 'reconnecting') {
    return state;
  }
  return {
    ...state,
    status: 'cancelled',
    message: '任务已取消',
    error: '',
    canRetry: true,
  };
}
