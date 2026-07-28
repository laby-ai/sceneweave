import assert from 'node:assert/strict';

import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { assignVimaxShotReferenceToNextShot } from '../src/lib/skills/vimax-short-drama/vimax-reference-context-action';
import {
  createTask,
  deleteTask,
  getTaskForOwner,
  updateTask,
  type TaskOwner,
} from '../src/lib/task-manager';

const owner: TaskOwner = { tenantId: 'paper-host', memberId: 'guest:image-context' };
const otherOwner: TaskOwner = { tenantId: 'paper-host', memberId: 'guest:image-context-other' };
const taskId = createTask('storyboard', {}, owner);

try {
  const plan = {
    title: '雨夜放映室',
    summary: '记者推门进入旧放映室。',
    assets: [],
    shots: [
      { index: 1, title: '推门', duration: 5, camera: '中景', prompt: '记者握住铁门把手。' },
      { index: 2, title: '进入', duration: 5, camera: '跟拍', prompt: '记者进入旧放映室。' },
    ],
    nextAction: '确认参考画面',
  };
  const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
    phase: 'reference_assets',
    style: '冷蓝电影感',
    sceneType: 'drama',
    ratio: '16:9',
    resolution: '720p',
    skillId: 'short-drama',
  }, taskId);
  updateTask(taskId, {
    status: 'completed',
    result: {
      ...built,
      vimaxPlan: plan,
      vimaxReferenceAssets: [
        { kind: 'shot', shotIndex: 1, label: 'Clip 1', prompt: plan.shots[0].prompt, url: '/private/shot-1' },
        { kind: 'shot', shotIndex: 2, label: 'Clip 2', prompt: plan.shots[1].prompt, url: '/private/shot-2' },
      ],
    },
  });

  assert.throws(() => assignVimaxShotReferenceToNextShot({
    taskId,
    owner: otherOwner,
    sourceShotIndex: 1,
    targetShotIndex: 2,
  }), /不存在|无权/);

  const result = assignVimaxShotReferenceToNextShot({
    taskId,
    owner,
    sourceShotIndex: 1,
    targetShotIndex: 2,
  });
  assert.equal(result.targetReference.url, '/private/shot-1');
  assert.equal(result.targetReference.shotIndex, 2);
  assert.equal(result.targetReference.sourceShotIndex, 1);
  assert.equal(
    result.references.find(asset => asset.shotIndex === 1)?.url,
    '/private/shot-1',
  );
  assert.equal(
    (getTaskForOwner(taskId, owner)?.result?.vimaxReferenceAssets as Array<{
      shotIndex?: number;
      url?: string;
    }> | undefined)?.find(asset => asset.shotIndex === 2)?.url,
    '/private/shot-1',
  );

  updateTask(taskId, {
    result: {
      ...getTaskForOwner(taskId, owner)?.result,
      vimaxHappyHorseSegments: [
        { shotIndex: 1, status: 'succeeded', videoUrl: '/private/video-1' },
      ],
    },
  });
  assert.equal(assignVimaxShotReferenceToNextShot({
    taskId,
    owner,
    sourceShotIndex: 1,
    targetShotIndex: 2,
  }).targetReference.url, '/private/shot-1');

  updateTask(taskId, {
    result: {
      ...getTaskForOwner(taskId, owner)?.result,
      vimaxHappyHorseSegments: [
        { shotIndex: 1, status: 'succeeded', videoUrl: '/private/video-1' },
        { shotIndex: 2, status: 'running' },
      ],
    },
  });
  assert.throws(() => assignVimaxShotReferenceToNextShot({
    taskId,
    owner,
    sourceShotIndex: 1,
    targetShotIndex: 2,
  }), /这个镜头已经开始制作/);

  console.log(JSON.stringify({
    ok: true,
    path: 'reference result -> use as next shot reference -> persisted recovery',
    providerCalls: 0,
    incurredCost: false,
  }));
} finally {
  deleteTask(taskId);
}
