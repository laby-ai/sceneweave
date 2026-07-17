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
  return history.map(entry => {
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
