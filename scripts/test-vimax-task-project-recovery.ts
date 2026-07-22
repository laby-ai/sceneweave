import assert from 'node:assert/strict';

import { recoverVimaxTaskProject } from '../src/lib/skills/vimax-short-drama/vimax-task-project-recovery';
import { buildVimaxResultDelivery } from '../src/lib/skills/vimax-short-drama/vimax-result-delivery';

const productionPlan = {
  version: 'sceneweave-vimax-production-plan-v1',
  workflow: { presetId: 'short-drama', operationOrder: ['plan', 'video'] },
  preferences: { ratio: '16:9', resolution: '720p' },
  continuity: { artifactRevision: 'rev-1' },
  governance: { status: 'delivery-ready' },
  render: {
    status: 'completed',
    lastSuccessfulResult: {
      artifactVersion: 'rev-1',
      videoUrl: '/sceneweave/api/final-videos/final-1',
      completedAt: '2026-07-20T00:00:00.000Z',
    },
  },
};

const recovered = recoverVimaxTaskProject({
  id: 'task-1',
  status: 'completed',
  createdAt: 100,
  config: { prompt: '同一主体连续穿过三个空间。' },
  result: {
    productionPlan,
    productionProject: { title: '连续空间测试' },
    vimaxReferenceAssets: [{ kind: 'character', label: '主体', url: 'https://example.com/subject.jpg' }],
    vimaxVideoResult: {
      model: 'happyhorse-1.1-r2v',
      videoUrl: '/sceneweave/api/final-videos/final-1',
      duration: 15,
      segments: [
        { shotIndex: 1, shotTitle: '进入', duration: 5, status: 'succeeded', videoUrl: 'https://example.com/a.mp4' },
        { shotIndex: 2, shotTitle: '穿越', duration: 5, status: 'succeeded', videoUrl: 'https://example.com/b.mp4' },
        { shotIndex: 3, shotTitle: '抵达', duration: 5, status: 'succeeded', videoUrl: 'https://example.com/c.mp4' },
      ],
    },
  },
});

assert.ok(recovered);
assert.equal(recovered.project.id, 'task:task-1');
assert.equal(recovered.project.messages[0].content, '同一主体连续穿过三个空间。');
assert.equal(recovered.project.messages[1].generatedVideo?.url, '/sceneweave/api/final-videos/final-1');
assert.equal(recovered.project.messages[1].vimaxAgent?.taskId, 'task-1');
assert.equal(recovered.project.messages[1].vimaxAgent?.shots?.length, 3);
assert.equal(buildVimaxResultDelivery(recovered.project.messages[1]).downloads[0]?.url, '/sceneweave/api/final-videos/final-1');

const recoveredReferences = recoverVimaxTaskProject({
  id: 'task-reference-1',
  status: 'completed',
  createdAt: 200,
  config: { prompt: '雨夜天台发现发光胶片。' },
  result: {
    productionPlan: {
      ...productionPlan,
      render: { status: 'not-started' },
    },
    productionProject: { title: '雨夜天台' },
    vimaxPlan: {
      title: '雨夜天台',
      summary: '四个连续镜头',
      shots: [
        { index: 1, title: '发现', duration: 5, camera: '推进', prompt: '角色发现胶片' },
        { index: 2, title: '触碰', duration: 5, camera: '特写', prompt: '手指触碰胶片' },
      ],
    },
    vimaxReferenceAssets: [
      { kind: 'shot', label: 'Clip 1', shotIndex: 1, url: 'https://example.com/shot-1.png' },
      { kind: 'shot', label: 'Clip 2', shotIndex: 2, url: 'https://example.com/shot-2.png' },
    ],
  },
});

assert.ok(recoveredReferences, 'persisted reference assets must recover before video generation');
assert.equal(recoveredReferences.project.messages[1].vimaxAgent?.phase, 'reference_assets');
assert.equal(recoveredReferences.project.messages[1].generatedImages?.length, 2);
assert.equal(recoveredReferences.project.messages[1].vimaxAgent?.shots?.[0]?.referenceUrl, 'https://example.com/shot-1.png');
assert.deepEqual(recoveredReferences.project.messages[1].quickOptions, ['确认参考图，继续生成视频', '调整分镜']);

const recoveredLegacyReferences = recoverVimaxTaskProject({
  id: 'task-reference-legacy',
  status: 'completed',
  createdAt: 201,
  config: { prompt: '恢复旧版参考图。' },
  result: {
    productionPlan: { ...productionPlan, render: { status: 'not-started' } },
    vimaxPlan: {
      title: '旧版参考图',
      summary: '两个镜头',
      shots: [
        { index: 1, title: '镜头一', duration: 5, camera: '推进', prompt: '镜头一' },
        { index: 2, title: '镜头二', duration: 5, camera: '特写', prompt: '镜头二' },
      ],
    },
    vimaxReferenceAssets: [
      { kind: 'reference', label: '参考素材1', url: 'https://example.com/legacy-1.png' },
      { kind: 'reference', label: '参考素材2', url: 'https://example.com/legacy-2.png' },
      { kind: 'reference', label: '重复素材1', url: 'https://example.com/legacy-1.png' },
      { kind: 'reference', label: '重复素材2', url: 'https://example.com/legacy-2.png' },
    ],
  },
});

assert.deepEqual(
  recoveredLegacyReferences?.project.messages[1].vimaxAgent?.assets?.map(asset => [asset.kind, asset.shotIndex]),
  [['shot', 1], ['shot', 2]],
  'legacy generic references may be mapped only when unique URLs exactly match the shot count',
);

assert.equal(recoverVimaxTaskProject({
  id: 'task-2',
  status: 'completed',
  result: {
    productionPlan,
    vimaxVideoResult: { videoUrl: '/sceneweave/api/final-videos/other', segments: [] },
  },
}), null, 'must reject a result that is not the locked last successful artifact');

assert.equal(recoverVimaxTaskProject({ id: 'task-3', status: 'failed', result: {} }), null);

console.log('vimax task project recovery: PASS');
