import type { ChatMessage } from '@/lib/smart-assistant-panel-model';

export type VimaxRunPhase = 'plan' | 'reference_assets' | 'video';

export interface VimaxRunToken {
  projectId: string;
  requestId: string;
  phase: VimaxRunPhase;
  messageId: string;
  signal: AbortSignal;
}

interface BeginVimaxRunInput {
  projectId: string;
  phase: VimaxRunPhase;
  messageId: string;
  timeoutMs: number;
}

export interface VimaxRunCoordinator {
  begin(input: BeginVimaxRunInput): VimaxRunToken;
  isCurrent(token: VimaxRunToken): boolean;
  finish(token: VimaxRunToken): boolean;
  cancel(): VimaxRunToken | null;
}

export const VIMAX_REFERENCE_REQUEST_TIMEOUT_MS = 300_000;
export const VIMAX_REFERENCE_RUN_TIMEOUT_MS = VIMAX_REFERENCE_REQUEST_TIMEOUT_MS + 15_000;

export function buildVimaxProjectTaskCursorKey(input: {
  workspaceScope?: string;
  projectId: string;
  taskId: string;
}) {
  const workspace = input.workspaceScope?.trim() || 'member';
  return [
    'sceneweave:creation-task-cursor',
    workspace,
    input.projectId,
    input.taskId,
  ].map(part => encodeURIComponent(part)).join(':');
}

const createRequestId = () => (
  globalThis.crypto?.randomUUID
    ? `vimax-${globalThis.crypto.randomUUID()}`
    : `vimax-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function createVimaxRunCoordinator(
  requestIdFactory: () => string = createRequestId,
): VimaxRunCoordinator {
  let active: { token: VimaxRunToken; controller: AbortController; timeout: ReturnType<typeof setTimeout> } | null = null;

  const cancel = () => {
    if (!active) return null;
    const cancelled = active.token;
    clearTimeout(active.timeout);
    active.controller.abort();
    active = null;
    return cancelled;
  };

  return {
    begin(input) {
      cancel();
      const controller = new AbortController();
      const token: VimaxRunToken = {
        projectId: input.projectId,
        requestId: requestIdFactory(),
        phase: input.phase,
        messageId: input.messageId,
        signal: controller.signal,
      };
      active = {
        token,
        controller,
        timeout: setTimeout(() => controller.abort(), input.timeoutMs),
      };
      return token;
    },
    isCurrent(token) {
      return active?.token.requestId === token.requestId;
    },
    finish(token) {
      if (active?.token.requestId !== token.requestId) return false;
      clearTimeout(active.timeout);
      active = null;
      return true;
    },
    cancel,
  };
}

export function recoverVimaxProjectMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(message => {
    if (message.generationStatus !== 'generating') return message;
    return {
      ...message,
      content: `${message.content}\n页面刷新后，本次连接已中断；已保留当前阶段，可重新生成。`,
      generationStatus: 'failed',
      quickOptions: ['重新生成'],
    };
  });
}
