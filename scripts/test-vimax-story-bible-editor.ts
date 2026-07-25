import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { updateVimaxStoryBibleForTask } from '../src/lib/skills/vimax-short-drama/vimax-story-bible-editor';
import { buildVimaxProductionPlan } from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { recoverVimaxTaskProject } from '../src/lib/skills/vimax-short-drama/vimax-task-project-recovery';
import { createTask, deleteTask, getTaskForOwner, updateTask, type TaskOwner } from '../src/lib/task-manager';

const owner: TaskOwner = { tenantId: 'paper-host', memberId: 'guest:story-editor' };
const otherOwner: TaskOwner = { tenantId: 'paper-host', memberId: 'guest:other-story-editor' };
const taskId = createTask('storyboard', {}, owner);

try {
  const plan = {
    title: '雨夜录音笔',
    summary: '记者在雨夜车站追查一支录音笔。',
    assets: [
      { kind: 'character' as const, label: '记者', prompt: '蓝色风衣，短发' },
      { kind: 'scene' as const, label: '雨夜车站', prompt: '冷蓝顶灯，湿地反光' },
    ],
    shots: [
      { index: 1, title: '发现', duration: 5, camera: '中景', prompt: '记者看见录音笔。' },
      { index: 2, title: '拾取', duration: 5, camera: '近景', prompt: '记者拾起录音笔。' },
    ],
    nextAction: '确认后生成',
  };
  const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
    phase: 'plan',
    style: '冷蓝电影感',
    sceneType: 'drama',
    ratio: '16:9',
    resolution: '720p',
    skillId: 'short-drama',
  }, taskId);
  const productionPlan = buildVimaxProductionPlan({
    title: plan.title,
    ratio: '16:9',
    resolution: '720p',
    planModel: 'authoritative-plan-model',
    imageModel: 'wan2.7-image-pro',
    videoModel: 'happyhorse-1.1-i2v',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: plan.assets,
    shots: plan.shots,
  });
  updateTask(taskId, {
    status: 'completed',
    progress: 100,
    result: {
      ...built,
      vimaxPlan: plan,
      productionPlan,
      vimaxReferenceAssets: [{ kind: 'shot', shotIndex: 1, url: '/private/reference-1' }],
      vimaxVideoResult: { videoUrl: '/private/final-video', segments: [] },
    },
  });

  assert.throws(() => updateVimaxStoryBibleForTask({
    taskId,
    owner: otherOwner,
    patch: { premise: '越权修改' },
  }), /不存在|无权/);

  const updated = updateVimaxStoryBibleForTask({
    taskId,
    owner,
    patch: {
      premise: '记者必须在末班车离站前找回被篡改的录音证据。',
      protagonist: '调查记者林夏',
      desire: '公开录音里的真相',
      obstacle: '列车即将离站，追踪者已经接近',
      relationship: '林夏与失踪线人之间未完成的承诺',
      conflict: '录音证据正在被远程覆盖',
      turningPoint: '林夏发现覆盖指令来自站内控制室',
      endingHook: '车门关闭前，录音里出现她自己的声音',
      emotionalArc: {
        start: '警觉',
        shift: '孤注一掷',
        end: '震惊',
      },
      continuityRules: ['蓝色风衣保持不变', '录音笔始终在林夏左手', '动作沿站台由左向右推进'],
    },
  });

  const recovered = getTaskForOwner(taskId, owner);
  assert.equal(updated.productionProject.storyBible.protagonist, '调查记者林夏');
  assert.equal(updated.productionProject.storyBible.emotionalArc.end, '震惊');
  assert.deepEqual(updated.productionProject.storyBible.continuityRules, [
    '蓝色风衣保持不变',
    '录音笔始终在林夏左手',
    '动作沿站台由左向右推进',
  ]);
  assert.equal(updated.productionPlan.providerRoutes.find(route => route.stage === 'reference_assets')?.model, 'wan2.7-image-pro');
  assert.equal(updated.productionPlan.providerRoutes.find(route => route.stage === 'video')?.model, 'happyhorse-1.1-i2v');
  assert.equal(updated.productionPlan.governance.status, 'awaiting-plan-approval');
  assert.equal(updated.productionPlan.render.status, 'not-started');
  assert.equal(recovered?.result?.vimaxReferenceAssets, undefined);
  assert.equal(recovered?.result?.vimaxVideoResult, undefined);
  assert.equal(
    (recovered?.result?.productionProject as typeof updated.productionProject | undefined)?.storyBible.premise,
    updated.productionProject.storyBible.premise,
  );
  const recoveredWorkspace = recoverVimaxTaskProject(recovered);
  assert.ok(recoveredWorkspace, 'story-edited project should recover without stale reference/video assets');
  assert.equal(recoveredWorkspace.messages.at(-1)?.vimaxAgent?.phase, 'plan');
  assert.equal(recoveredWorkspace.messages.at(-1)?.vimaxAgent?.costState, 'not-yet');

  const cardSource = readFileSync('src/components/generate/vimax-project-editor-card.tsx', 'utf8');
  assert.match(cardSource, /故事与角色 Bible/);
  assert.match(cardSource, /aria-label="故事前提"/);
  assert.match(cardSource, /aria-label="主角"/);
  assert.match(cardSource, /aria-label="连续性规则"/);
  assert.match(cardSource, /保存故事/);

  console.log(JSON.stringify({
    ok: true,
    path: 'story edit -> owner writeback -> stale output reset -> refresh recovery',
    providerCalls: 0,
    usedRealKey: false,
    incurredCost: false,
  }));
} finally {
  deleteTask(taskId);
}
