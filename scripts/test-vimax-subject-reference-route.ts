import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-subject-registry-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.ARK_IMAGE_API_KEY = 'fixture-image-key';
process.env.ARK_IMAGE_MODEL = 'fixture-image';

async function main() {
  const [
    { NextRequest },
    route,
    { createTask, getTaskForOwner },
    { persistVimaxPlanTask },
    { buildProductionBackedVimaxPlan },
    { buildVimaxProductionPlan },
    { buildVimaxContinuityContract, resolveVimaxProviderHandoffMode },
    { resolveVimaxSkillRuntimeBinding },
  ] = await Promise.all([
    import('next/server'),
    import('../src/app/api/smart/vimax-agent-step/route'),
    import('../src/lib/task-manager'),
    import('../src/lib/skills/vimax-short-drama/vimax-plan-task'),
    import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts'),
    import('../src/lib/skills/vimax-short-drama/vimax-production-plan'),
    import('../src/lib/skills/vimax-short-drama/vimax-continuity-contract'),
    import('../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding'),
  ]);

  const workspace = 'guest-creation-subject-registry-fixture-1234';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const prompt = '林夏穿蓝色雨衣，在雨夜车站举起红色录音笔。';
  const plan: VimaxAgentPlan = {
    title: '雨夜回声',
    summary: '林夏在雨夜车站收到神秘回应。',
    assets: [
      { kind: 'character', label: '林夏', prompt: '24岁女性，黑色短发，蓝色雨衣，黑色长裤，白色运动鞋' },
      { kind: 'scene', label: '雨夜车站', prompt: '冷蓝雨夜，旧车站站台' },
      { kind: 'prop', label: '红色录音笔', prompt: '红色录音笔，指示灯可见' },
    ],
    shots: [
      { index: 1, title: '侧身停步', duration: 5, camera: '中景侧拍', prompt: '林夏侧身从左向右走入站台并停下' },
      { index: 2, title: '背影回应', duration: 5, camera: '背面近景', prompt: '林夏背对镜头举起红色录音笔' },
    ],
    nextAction: '生成参考素材',
  };
  const taskId = createTask('storyboard', { prompt, workflow: 'vimax-agent' }, owner);
  const built = buildProductionBackedVimaxPlan(prompt, plan, {
    phase: 'plan',
    duration: 10,
    segmentDuration: 5,
    segmentCount: 2,
    ratio: '16:9',
    resolution: '720p',
    sceneType: 'drama',
    style: '冷蓝电影感',
    skillId: 'short-drama',
  }, taskId);
  const workflow = resolveVimaxSkillRuntimeBinding({ skillId: 'short-drama' });
  const continuity = buildVimaxContinuityContract({
    productionProject: built.productionProject,
    assemblyPlan: built.assemblyPlan,
    imageModel: 'fixture-image',
    providerHandoff: resolveVimaxProviderHandoffMode({ provider: 'fixture-video', model: 'fixture-video' }),
  });
  const initialProductionPlan = buildVimaxProductionPlan({
    title: built.plan.title,
    ratio: '16:9',
    resolution: '720p',
    planModel: VIMAX_PLAN_MODEL,
    imageModel: 'fixture-image',
    videoModel: 'fixture-video',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: built.plan.assets,
    shots: built.plan.shots,
    workflow,
    continuity,
  });
  const productionPlan = {
    ...initialProductionPlan,
    governance: {
      status: 'ready' as const,
      decisionLog: [
        { checkpoint: 'plan' as const, action: 'approved' as const, at: new Date().toISOString() },
        { checkpoint: 'cost' as const, action: 'approved' as const, at: new Date().toISOString() },
      ],
    },
    estimatedCost: {
      ...initialProductionPlan.estimatedCost,
      amount: 1,
      status: 'confirmed' as const,
      reason: '隔离 fixture 确认；fetch 已拦截，不会调用真实 provider。',
    },
  };
  persistVimaxPlanTask({
    taskId,
    prompt,
    plan: built.plan,
    productionProject: built.productionProject,
    assemblyPlan: built.assemblyPlan,
    productionPlan,
  });

  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ data: [{ url: `https://fixture.invalid/generated-${providerCalls}.png` }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const response = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-paper-host-embed': 'creation-agent',
        'x-paper-host-guest-workspace': workspace,
      },
      body: JSON.stringify({ taskId, phase: 'reference_assets' }),
    }));
    const payload = await response.json() as {
      success?: boolean;
      subjectRegistry?: { version?: string; subjects?: Array<{ label?: string }> };
      assets?: unknown[];
      error?: string;
    };
    assert.equal(response.status, 200, payload.error);
    assert.equal(payload.success, true);
    assert.equal(payload.subjectRegistry?.version, 'sceneweave-subject-reference-registry-v1');
    const subjectCount = payload.subjectRegistry?.subjects?.length || 0;
    assert.equal(subjectCount, 1);
    assert.deepEqual(payload.subjectRegistry?.subjects?.map(subject => subject.label), ['林夏']);
    assert.equal(payload.assets?.length, 5);
    assert.equal(providerCalls, 5);

    const persisted = getTaskForOwner(taskId, owner)?.result;
    assert.equal(
      (persisted?.vimaxSubjectReferenceRegistry as { version?: string } | undefined)?.version,
      'sceneweave-subject-reference-registry-v1',
    );
    assert.equal((persisted?.vimaxReferenceAssets as unknown[] | undefined)?.length, 5);
    assert.equal(getTaskForOwner(taskId, { tenantId: owner.tenantId, memberId: 'guest-other' }), undefined);

    console.log(JSON.stringify({
      ok: true,
      path: 'canonical project -> three-view registry -> shot view selection -> task persistence',
      providerCalls: 0,
      interceptedImageCalls: providerCalls,
      assets: payload.assets?.length,
      subjects: payload.subjectRegistry?.subjects?.map(subject => subject.label),
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  rmSync(taskFile, { force: true });
});
