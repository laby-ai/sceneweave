import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { VimaxProjectBar } from '../src/components/generate/vimax-project-bar';
import { VimaxProjectHome } from '../src/components/generate/vimax-project-home';

const home = renderToStaticMarkup(createElement(VimaxProjectHome, {
  projects: [{
    id: 'project-1',
    title: '星际短片',
    updatedAt: 1721188800000,
    messageCount: 4,
    stageLabel: '参考素材',
  }],
  skills: [{
    id: 'short-drama',
    name: '短剧一键成片',
    description: '从创意到成片',
    prompt: '创作短剧',
    sceneType: 'drama',
    style: 'cinematic',
    keywords: ['短剧'],
  }],
  selectedSkillId: 'short-drama',
  composer: createElement('div', { 'data-testid': 'composer' }, 'composer'),
  onOpenProject: () => undefined,
  onDeleteProject: () => undefined,
  onStartProject: () => undefined,
  onSelectSkill: () => undefined,
}));

assert.match(home, /data-testid="vimax-project-home"/);
assert.match(home, /data-testid="vimax-recent-projects"/);
assert.match(home, /星际短片/);
assert.match(home, /短剧一键成片/);
assert.match(home, /data-testid="composer"/);
assert.match(home, /aria-label="管理项目 星际短片"/);
assert.doesNotMatch(home, /Vimax 创作智能体/i);
assert.doesNotMatch(home, /vimax-history-sidebar/);

const bar = renderToStaticMarkup(createElement(VimaxProjectBar, {
  title: '星际短片',
  onBack: () => undefined,
  onNewProject: () => undefined,
  onRenameProject: () => undefined,
}));

assert.match(bar, /返回项目/);
assert.match(bar, /新建项目/);
assert.match(bar, /星际短片/);
assert.match(bar, /重命名项目/);
assert.doesNotMatch(bar, /Vimax/i);

const workspaceSource = readFileSync(
  new URL('../src/components/generate/generate-workspace.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(workspaceSource, /Vimax 会沿用/);

const embedShellSource = readFileSync(
  new URL('../src/components/creation-agent/vimax-creation-agent-shell.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(embedShellSource, /bg-black/);
assert.match(embedShellSource, /bg-\[#f7f8fa\]/);

console.log(JSON.stringify({ ok: true, script: 'test-vimax-project-layout', checks: 16 }));
