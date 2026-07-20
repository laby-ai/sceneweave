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
