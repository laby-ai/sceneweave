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
  current(): VimaxRunToken | null;
  isCurrent(token: VimaxRunToken): boolean;
  finish(token: VimaxRunToken): boolean;
  cancel(options?: { abort?: boolean }): VimaxRunToken | null;
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

  const cancel = (options: { abort?: boolean } = {}) => {
    if (!active) return null;
    const cancelled = active.token;
    clearTimeout(active.timeout);
    if (options.abort !== false) active.controller.abort();
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
    current() {
      return active?.token || null;
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
    if (message.vimaxAgent?.phase === 'reference_assets' && message.vimaxAgent.referenceTaskId) {
      return {
        ...message,
        content: `${message.content}\n页面已恢复，可继续查看同一批参考图；不会重新提交模型任务。`,
        generationStatus: 'failed',
        quickOptions: ['继续查看参考图', '取消参考图'],
      };
    }
    if (message.vimaxAgent?.phase === 'video' && message.vimaxAgent.videoTaskId) {
      return {
        ...message,
        content: `${message.content}\n页面已恢复，可继续查看同一成片任务；不会重新提交视频模型或合成任务。`,
        generationStatus: 'failed',
        quickOptions: ['继续查看成片', '取消成片'],
      };
    }
    return {
      ...message,
      content: `${message.content}\n页面刷新后，本次连接已中断；已保留当前阶段，可重新生成。`,
      generationStatus: 'failed',
      quickOptions: ['重新生成'],
    };
  });
}
