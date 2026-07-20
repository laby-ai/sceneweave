import assert from 'node:assert/strict';

import {
  createVimaxProject,
  deleteVimaxProject,
  loadActiveVimaxProjectId,
  loadVimaxWorkspaceView,
  renameVimaxProject,
  restoreVimaxWorkspaceView,
  saveActiveVimaxProjectId,
  saveVimaxWorkspaceView,
  summarizeVimaxProjects,
  upsertVimaxProjectMessages,
} from '../src/lib/skills/vimax-short-drama/vimax-project-catalog';
import type { ChatHistoryEntry } from '../src/lib/smart-assistant-panel-model';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
};

assert.equal(loadVimaxWorkspaceView(storage, 'guest-a'), 'home');
saveVimaxWorkspaceView(storage, 'guest-a', 'project');
assert.equal(loadVimaxWorkspaceView(storage, 'guest-a'), 'project');
assert.equal(loadVimaxWorkspaceView(storage, 'guest-b'), 'home');

assert.equal(restoreVimaxWorkspaceView(storage, '', 'guest-late', 'project'), 'project');
assert.equal(loadVimaxWorkspaceView(storage, 'guest-late'), 'project');
assert.equal(restoreVimaxWorkspaceView(storage, 'guest-late', 'guest-b', 'home'), 'home');

saveActiveVimaxProjectId(storage, 'guest-a', 'project-empty');
assert.equal(loadActiveVimaxProjectId(storage, 'guest-a'), 'project-empty');
assert.equal(loadActiveVimaxProjectId(storage, 'guest-b'), null);

const emptyProjectHistory = createVimaxProject([], 'project-empty', 1721188700000);
assert.deepEqual(summarizeVimaxProjects(emptyProjectHistory), [{
  id: 'project-empty',
  title: '未命名创作',
  updatedAt: 1721188700000,
  messageCount: 0,
  stageLabel: '创意草稿',
}]);

const renamedProjectHistory = renameVimaxProject(
  emptyProjectHistory,
  'project-empty',
  '  夏日品牌片  ',
  1721188750000,
);
assert.equal(renamedProjectHistory[0]?.title, '夏日品牌片');

const renamedAfterProgress = upsertVimaxProjectMessages(
  renamedProjectHistory,
  'project-empty',
  [{ id: 'user-1', role: 'user', content: '这段提示词不应覆盖手动项目名', timestamp: 1721188800000 }],
  1721188800000,
);
assert.equal(renamedAfterProgress[0]?.title, '夏日品牌片');

const history: ChatHistoryEntry[] = [{
  id: 'project-1',
  title: '星际短片',
  time: 1721188800000,
  messages: [{
    id: 'assistant-1',
    role: 'assistant',
    content: '参考素材已生成',
    timestamp: 1721188800000,
    vimaxAgent: {
      phase: 'reference_assets',
      title: '星际短片',
      summary: '参考素材已生成',
      model: 'doubao-seedream-5.0-lite',
      costState: 'incurred',
      nextAction: '确认后生成视频',
    },
  }],
}];

assert.deepEqual(summarizeVimaxProjects(history), [{
  id: 'project-1',
  title: '星际短片',
  updatedAt: 1721188800000,
  messageCount: 1,
  stageLabel: '参考素材',
}]);

const multiProjectHistory: ChatHistoryEntry[] = [
  { id: 'older', title: '较早项目', time: 1721188700000, messages: [] },
  { id: 'newer', title: '最近项目', time: 1721188900000, messages: [] },
];

assert.deepEqual(
  summarizeVimaxProjects(multiProjectHistory).map(project => project.id),
  ['newer', 'older'],
);
assert.deepEqual(
  deleteVimaxProject(multiProjectHistory, 'newer').map(project => project.id),
  ['older'],
);
assert.equal(deleteVimaxProject(multiProjectHistory, 'missing'), multiProjectHistory);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-project-catalog',
  checks: 15,
}));
