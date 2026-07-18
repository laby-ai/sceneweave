import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-canonical-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const { buildProductionAssemblyPlan } = await import('../src/lib/production-assembly-plan');
  const { patchProductionStoryboardShotFromCanvas } = await import('../src/lib/production-storyboard-writeback');
  const { createTask, getTaskFresh, updateTask } = await import('../src/lib/task-manager');
  const { persistVimaxPlanTask } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-task');
  const { buildProductionBackedVimaxPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts');
  const { buildVimaxProductionPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const { resolveCanonicalVimaxStageInput } = await import('../src/lib/skills/vimax-short-drama/vimax-canonical-stage-input');
  const [{ NextRequest }, route] = await Promise.all([
    import('next/server'),
    import('../src/app/api/smart/vimax-agent-step/route'),
  ]);

  const workspace = 'guest-creation-canonical-stage-1234';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const otherOwner = { tenantId: 'paper-host-guest', memberId: 'guest-canonical-stage-other' };
  const prompt = '同一位穿蓝色风衣的记者在雨夜车站追查红色录音笔，三个连续镜头。';
  const taskId = createTask('storyboard', { prompt, workflow: 'vimax-agent' }, owner);
  const basePlan: VimaxAgentPlan = {
    title: '雨夜录音笔',
    summary: '记者在车站追查录音笔。',
    assets: [{
      kind: 'reference',
      label: '记者定妆',
      prompt: '蓝色风衣、短发、红色录音笔',
      referenceUrl: 'https://fixture.invalid/reporter-look.png',
    }],
    shots: [
      { index: 1, title: '发现', duration: 5, camera: '中景', prompt: '记者走向长椅。' },
      { index: 2, title: '拾取', duration: 5, camera: '近景', prompt: '记者拾起红色录音笔。' },
      { index: 3, title: '追踪', duration: 5, camera: '跟拍', prompt: '记者朝站台右侧追去。' },
    ],
    nextAction: '确认分镜。',
  };
  const built = buildProductionBackedVimaxPlan(prompt, basePlan, {
    phase: 'plan',
    duration: 15,
    segmentDuration: 5,
    segmentCount: 3,
    ratio: '16:9',
    resolution: '720p',
    sceneType: 'drama',
    style: '雨夜电影感',
    skillId: 'short-drama',
  }, taskId);
  const productionPlan = buildVimaxProductionPlan({
    title: built.plan.title,
    ratio: '16:9',
    resolution: '720p',
    planModel: 'fixture-plan',
    imageModel: 'fixture-image',
    videoModel: 'fixture-video',
    providerReadiness: { plan: true, referenceAssets: true, video: false },
    assets: built.plan.assets,
    shots: built.plan.shots,
  });
  persistVimaxPlanTask({
    taskId,
    prompt,
    plan: built.plan,
    productionProject: built.productionProject,
    assemblyPlan: built.assemblyPlan,
    productionPlan,
  });

  const initial = resolveCanonicalVimaxStageInput({ taskId, owner });
  assert.equal(initial.taskId, taskId);
  assert.equal(initial.plan.shots.length, 3);
  assert.equal(initial.plan.assets.find(asset => asset.label === '记者定妆')?.referenceUrl, 'https://fixture.invalid/reporter-look.png');
  assert.doesNotMatch(initial.plan.shots[0]?.prompt || '', /客户端伪造/);
  assert.throws(
    () => resolveCanonicalVimaxStageInput({ taskId, owner: otherOwner }),
    /项目不存在或无权访问/,
    'another guest must not resolve canonical production artifacts',
  );

  const shotId = built.productionProject.storyboard.shots[0]?.id || '';
  const editedPrompt = '同一位穿蓝色风衣的记者从画面左侧进入，停在长椅前，右手伸向红色录音笔。';
  patchProductionStoryboardShotFromCanvas({ taskId, shotId, patch: { prompt: editedPrompt } });
  const staleTask = getTaskFresh(taskId);
  const staleAssemblyPlan = staleTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
  assert.equal(staleAssemblyPlan?.segments[0]?.artifactReadiness?.stale, true);
  assert.throws(
    () => resolveCanonicalVimaxStageInput({ taskId, owner }),
    /分镜或资产已更新.*重新生成制作合约/,
    'a stale client snapshot must not reach reference or video providers',
  );
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('stale artifacts must fail before provider fetch');
  };
  const staleResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
    },
    body: JSON.stringify({
      taskId,
      phase: 'reference_assets',
      plan: { ...basePlan, shots: [{ ...basePlan.shots[0], prompt: '客户端伪造旧分镜' }] },
      productionPlan,
    }),
  }));
  const stalePayload = await staleResponse.json() as { error?: string };
  globalThis.fetch = originalFetch;
  assert.notEqual(staleResponse.status, 200);
  assert.match(stalePayload.error || '', /分镜或资产已更新/);
  assert.equal(providerCalls, 0);

  const currentProject = staleTask?.result?.productionProject as typeof built.productionProject;
  const rebuiltAssemblyPlan = buildProductionAssemblyPlan({ productionProject: currentProject, sourceTaskId: taskId });
  updateTask(taskId, {
    result: {
      ...(staleTask?.result || {}),
      productionProject: currentProject,
      assemblyPlan: rebuiltAssemblyPlan,
    },
  });
  const rebuilt = resolveCanonicalVimaxStageInput({ taskId, owner });
  assert.match(rebuilt.plan.shots[0]?.prompt || '', /蓝色风衣/);
  assert.match(rebuilt.plan.shots[0]?.prompt || '', /画面左侧/);
  assert.notEqual(rebuilt.assemblyPlan.segments[0]?.artifactReadiness?.stale, true);

  rmSync(taskFile, { force: true });
  console.log(JSON.stringify({
    ok: true,
    script: 'test-vimax-canonical-stage-input',
    path: 'persist -> storyboard PATCH -> stale reject -> rebuild -> canonical stage input',
    providerCalls,
  }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
