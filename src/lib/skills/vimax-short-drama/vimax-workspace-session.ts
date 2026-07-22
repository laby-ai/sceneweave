import type { ChatMessage } from '@/lib/smart-assistant-panel-model';
import type { VimaxProductionPlan } from './vimax-production-plan';

export function latestVimaxTaskId(messages: ChatMessage[]) {
  return [...messages].reverse().find(message => message.vimaxAgent?.taskId)?.vimaxAgent?.taskId;
}

export function resolveVimaxTaskId(
  messages: ChatMessage[],
  resumeTaskId?: string,
  ignoreResumeTask = false,
) {
  if (!ignoreResumeTask && resumeTaskId) return resumeTaskId;
  return latestVimaxTaskId(messages);
}

export function shouldClearCachedVimaxProject(
  messages: ChatMessage[],
  resumeTaskId?: string,
  recoverableTaskId?: string,
) {
  return Boolean(
    messages.length > 0
    && resumeTaskId
    && resumeTaskId === recoverableTaskId
    && latestVimaxTaskId(messages) !== recoverableTaskId,
  );
}

export function buildVimaxTaskUrl(href: string, taskId?: string) {
  const url = new URL(href);
  if (taskId) url.searchParams.set('taskId', taskId);
  else url.searchParams.delete('taskId');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isVimaxExecutionReady(plan?: VimaxProductionPlan) {
  return plan?.governance.status === 'ready' && plan.estimatedCost.status === 'confirmed';
}

export function shouldShowVimaxQuickOption(option: string, plan?: VimaxProductionPlan) {
  if (!/确认分镜|生成参考图|仅重试缺失参考图/.test(option)) return true;
  return isVimaxExecutionReady(plan);
}
