import assert from 'node:assert/strict';

import {
  loadVimaxWorkspaceView,
  restoreVimaxWorkspaceView,
  saveVimaxWorkspaceView,
  summarizeVimaxProjects,
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

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-project-catalog',
  checks: 7,
}));
