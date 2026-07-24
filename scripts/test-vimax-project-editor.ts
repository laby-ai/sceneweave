import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { ProductionProject } from '../src/lib/production-project';
import {
  applyVimaxAssetEditorWriteback,
  applyVimaxStoryboardEditorWriteback,
  resolveVimaxProjectEditorView,
} from '../src/lib/skills/vimax-short-drama/vimax-project-editor';

const project = {
  id: 'production-project-1',
  title: '城市短片',
  assets: [
    { id: 'script-1', kind: 'script', name: '初版脚本', status: 'ready', summary: '旧脚本摘要', source: 'prompt' },
    { id: 'character-1', kind: 'character', name: '主角', status: 'ready', summary: '旧角色设定', source: 'prompt' },
    { id: 'task-1', kind: 'task', name: '视频任务', status: 'planned', summary: '内部任务', source: 'task' },
  ],
  storyboard: {
    shotCount: 1,
    totalDuration: 5,
    shots: [{
      id: 'shot-1',
      index: 1,
      duration: 5,
      storyBeat: 'setup',
      dramaticPurpose: '建立场景',
      emotionShift: '平静',
      prompt: '雨夜街口的远景',
      status: 'planned',
    }],
  },
} as unknown as ProductionProject;

const view = resolveVimaxProjectEditorView({ productionProject: project });
assert.equal(view?.project.id, project.id);
assert.deepEqual(view?.editableAssets.map(asset => asset.id), ['script-1', 'character-1']);
assert.deepEqual(view?.shots.map(shot => shot.id), ['shot-1']);

const assetUpdated = applyVimaxAssetEditorWriteback(project, {
  success: true,
  asset: { ...project.assets[0], name: '定稿脚本', summary: '成功保存的新摘要' },
});
assert.equal(assetUpdated.assets[0]?.name, '定稿脚本');
assert.equal(assetUpdated.assets[0]?.summary, '成功保存的新摘要');
assert.equal(assetUpdated.assets[1]?.name, '主角');

const derivedAsset = {
  ...project.assets[1],
  id: 'character-1-v2',
  name: '主角 · 雨夜服装',
  metadata: {
    assetVersion: {
      rootAssetId: 'character-1',
      parentAssetId: 'character-1',
      number: 2,
      status: 'draft',
    },
  },
};
const derivedProject = {
  ...project,
  assets: [...project.assets, derivedAsset],
} as ProductionProject;
const derivedUpdated = applyVimaxAssetEditorWriteback(project, {
  success: true,
  asset: derivedAsset,
  productionProject: derivedProject,
});
assert.equal(derivedUpdated.assets.at(-1)?.id, 'character-1-v2');

const storyboardUpdated = applyVimaxStoryboardEditorWriteback(assetUpdated, {
  success: true,
  shot: { ...project.storyboard.shots[0], prompt: '雨夜街口的推进镜头', duration: 7 },
  storyboard: {
    ...project.storyboard,
    totalDuration: 7,
    shots: [{ ...project.storyboard.shots[0], prompt: '雨夜街口的推进镜头', duration: 7 }],
  },
});
assert.equal(storyboardUpdated.storyboard.shots[0]?.prompt, '雨夜街口的推进镜头');
assert.equal(storyboardUpdated.storyboard.totalDuration, 7);

assert.throws(
  () => applyVimaxAssetEditorWriteback(storyboardUpdated, { success: false, error: '保存失败' }),
  /保存失败/,
);
assert.equal(storyboardUpdated.assets[0]?.summary, '成功保存的新摘要');

const cardSource = readFileSync(new URL('../src/components/generate/vimax-project-editor-card.tsx', import.meta.url), 'utf8');
assert.match(cardSource, /素材与分镜/);
assert.match(cardSource, /保存素材/);
assert.match(cardSource, /保存为新版本/);
assert.match(cardSource, /批准此版本/);
assert.match(cardSource, /versionAction/);
assert.match(cardSource, /适用镜头/);
assert.match(cardSource, /relatedShotIds/);
assert.match(cardSource, /保存分镜/);
assert.match(cardSource, /api\/production\/projects\/\$\{encodeURIComponent\(taskId\)\}\/assets/);
assert.match(cardSource, /api\/production\/projects\/\$\{encodeURIComponent\(taskId\)\}\/storyboard/);
assert.match(cardSource, /clientApiFetch/);

const workspaceSource = readFileSync(new URL('../src/components/generate/generate-workspace.tsx', import.meta.url), 'utf8');
assert.match(workspaceSource, /VimaxProjectEditorCard taskId=\{agent\.taskId\}/);
assert.match(
  workspaceSource,
  /agent\?\.taskId && message\.generationStatus === 'completed' && !message\.generatedVideo\?\.url/,
  'delivered projects must not mount task-backed editor controls after the runtime task is cleaned up',
);

console.log(JSON.stringify({ ok: true, script: 'test-vimax-project-editor', checks: 18 }));
