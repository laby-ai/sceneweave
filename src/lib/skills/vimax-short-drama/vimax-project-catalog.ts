import type { ChatHistoryEntry, ChatMessage } from '@/lib/smart-assistant-panel-model';

export type VimaxWorkspaceView = 'home' | 'project';

interface VimaxWorkspaceViewReader {
  getItem(key: string): string | null;
}

interface VimaxWorkspaceViewWriter {
  setItem(key: string, value: string): void;
}

export interface VimaxProjectSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  stageLabel: string;
}

const viewKey = (scope?: string) => `vimax-workspace-view:${scope || 'default'}`;
const activeProjectKey = (scope?: string) => `vimax-active-project:${scope || 'default'}`;
const projectReferenceKey = (scope: string | undefined, projectId: string) => (
  `vimax-project-references:${scope || 'default'}:${encodeURIComponent(projectId)}`
);

export function loadActiveVimaxProjectId(
  storage: VimaxWorkspaceViewReader | null,
  scope: string | undefined,
) {
  return storage?.getItem(activeProjectKey(scope)) || null;
}

export function saveActiveVimaxProjectId(
  storage: VimaxWorkspaceViewWriter | null,
  scope: string | undefined,
  projectId: string,
) {
  storage?.setItem(activeProjectKey(scope), projectId);
}

export function loadVimaxProjectReferenceIds(
  storage: VimaxWorkspaceViewReader | null,
  scope: string | undefined,
  projectId: string,
): string[] {
  if (!storage || !projectId) return [];
  try {
    const parsed = JSON.parse(storage.getItem(projectReferenceKey(scope, projectId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))].slice(0, 8);
  } catch {
    return [];
  }
}

export function saveVimaxProjectReferenceIds(
  storage: VimaxWorkspaceViewWriter | null,
  scope: string | undefined,
  projectId: string,
  referenceIds: string[],
) {
  if (!storage || !projectId) return;
  const normalized = [...new Set(referenceIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))].slice(0, 8);
  storage.setItem(projectReferenceKey(scope, projectId), JSON.stringify(normalized));
}

export function moveVimaxProjectReference<T extends { id: string }>(
  references: T[],
  referenceId: string,
  direction: -1 | 1,
): T[] {
  const index = references.findIndex(reference => reference.id === referenceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= references.length) return references;
  const next = [...references];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function createVimaxProject(
  history: ChatHistoryEntry[],
  projectId: string,
  now = Date.now(),
): ChatHistoryEntry[] {
  const existing = history.find(entry => entry.id === projectId);
  const project = existing || {
    id: projectId,
    title: '未命名创作',
    time: now,
    messages: [],
  };
  return [project, ...history.filter(entry => entry.id !== projectId)].slice(0, 20);
}

export function renameVimaxProject(
  history: ChatHistoryEntry[],
  projectId: string,
  title: string,
  now = Date.now(),
): ChatHistoryEntry[] {
  const normalizedTitle = title.trim().slice(0, 60);
  if (!normalizedTitle) return history;
  return history.map(entry => entry.id === projectId ? {
    ...entry,
    title: normalizedTitle,
    time: now,
    params: { ...entry.params, vimaxManualTitle: true },
  } : entry);
}

export function deleteVimaxProject(
  history: ChatHistoryEntry[],
  projectId: string,
): ChatHistoryEntry[] {
  if (!history.some(entry => entry.id === projectId)) return history;
  return history.filter(entry => entry.id !== projectId);
}

export function hasCurrentVimaxRouteContract(messages: ChatMessage[]): boolean {
  const planned = [...messages].reverse().find(message => (
    message.vimaxAgent?.phase === 'plan'
    && (message.vimaxAgent.shots || []).length > 0
  ))?.vimaxAgent;
  if (!planned) return true;
  return (planned.shots || []).every(shot => (
    Boolean(shot.spatialRelation)
    && Boolean(shot.temporalRelation)
    && Boolean(shot.routeConfidence)
  ));
}

export function removeLegacyVimaxProjects(history: ChatHistoryEntry[]): ChatHistoryEntry[] {
  return history.filter(entry => hasCurrentVimaxRouteContract(entry.messages || []));
}

export function upsertVimaxProjectMessages(
  history: ChatHistoryEntry[],
  projectId: string,
  messages: ChatMessage[],
  now = Date.now(),
): ChatHistoryEntry[] {
  const existing = history.find(entry => entry.id === projectId);
  const firstUser = messages.find(message => message.role === 'user');
  const title = existing?.params?.vimaxManualTitle === true
    ? existing.title
    : firstUser?.content.slice(0, 30) || existing?.title || '未命名创作';
  const project: ChatHistoryEntry = {
    ...existing,
    id: projectId,
    title,
    time: now,
    messages,
  };
  return [project, ...history.filter(entry => entry.id !== projectId)].slice(0, 20);
}

export function loadVimaxWorkspaceView(
  storage: VimaxWorkspaceViewReader | null,
  scope: string | undefined,
): VimaxWorkspaceView {
  if (!storage) return 'home';
  return storage.getItem(viewKey(scope)) === 'project' ? 'project' : 'home';
}

export function saveVimaxWorkspaceView(
  storage: VimaxWorkspaceViewWriter | null,
  scope: string | undefined,
  view: VimaxWorkspaceView,
) {
  storage?.setItem(viewKey(scope), view);
}

export function restoreVimaxWorkspaceView(
  storage: (VimaxWorkspaceViewReader & VimaxWorkspaceViewWriter) | null,
  previousScope: string | null,
  nextScope: string | undefined,
  currentView: VimaxWorkspaceView,
): VimaxWorkspaceView {
  const persistedView = loadVimaxWorkspaceView(storage, nextScope);
  const nextScopeKey = nextScope || '';
  if (persistedView === 'project') return 'project';
  if (previousScope !== null && previousScope !== nextScopeKey && currentView === 'project') {
    saveVimaxWorkspaceView(storage, nextScope, 'project');
    return 'project';
  }
  return 'home';
}

const phaseLabel: Record<NonNullable<ChatMessage['vimaxAgent']>['phase'], string> = {
  plan: '制作计划',
  reference_assets: '参考素材',
  video_cost_confirm: '待确认视频',
  video: '成片',
};

export function summarizeVimaxProjects(history: ChatHistoryEntry[]): VimaxProjectSummary[] {
  return [...history].sort((left, right) => right.time - left.time).map(entry => {
    const latest = [...(entry.messages || [])].reverse().find(message => message.vimaxAgent)?.vimaxAgent;
    return {
      id: entry.id,
      title: entry.title || '未命名创作',
      updatedAt: entry.time,
      messageCount: entry.messages?.length || 0,
      stageLabel: latest ? phaseLabel[latest.phase] : '创意草稿',
    };
  });
}
