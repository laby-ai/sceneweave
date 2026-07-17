import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-governance-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const [{ NextRequest }, taskRoute, planModule, governanceView, taskManager] = await Promise.all([
    import('next/server'),
    import('../src/app/api/tasks/[taskId]/route'),
    import('../src/lib/skills/vimax-short-drama/vimax-production-plan'),
    import('../src/lib/skills/vimax-short-drama/vimax-production-governance'),
    import('../src/lib/task-manager'),
  ]);

  const guestWorkspace = 'guest-creation-production-governance-a81f92';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(guestWorkspace).digest('hex').slice(0, 32)}`,
  };
  const taskId = taskManager.createTask('storyboard', { prompt: '一支两镜头品牌短片' }, owner);
  const productionPlan = planModule.buildVimaxProductionPlan({
    title: '品牌短片制作计划',
    ratio: '16:9',
    resolution: '1080p',
    planModel: 'plan-model',
    imageModel: 'image-model',
    videoModel: 'video-model',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [{ kind: 'reference', label: '品牌主视觉' }],
    shots: [{ index: 1, title: '开场', duration: 5, camera: '推进', prompt: '产品特写' }],
  });
  taskManager.startTask(taskId);
  taskManager.completeTask(taskId, { productionPlan, content: '{}' });

  assert.equal(
    productionPlan.checkpoints.find(checkpoint => checkpoint.id === 'reference_assets')?.status,
    'awaiting-human',
  );
  assert.equal(productionPlan.governance.status, 'awaiting-plan-approval');
  assert.deepEqual(governanceView.buildVimaxProductionGovernanceView(productionPlan), {
    state: 'awaiting-plan-approval',
    label: '确认制作计划',
    canApprove: true,
    description: '确认素材清单、模型路线与费用边界后，才会开放后续制作。',
  });
  assert.throws(
    () => planModule.assertVimaxProductionPlanForPhase(productionPlan, 'reference_assets', {
      plan: 'plan-model',
      referenceAssets: 'image-model',
      video: 'video-model',
    }),
    /确认制作计划/,
  );

  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': guestWorkspace,
  };
  const approveRequest = () => new NextRequest(`http://localhost/api/tasks/${taskId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve-production-plan' }),
  });
  const approvedResponse = await taskRoute.POST(approveRequest(), { params: Promise.resolve({ taskId }) });
  const approvedBody = await approvedResponse.json() as Record<string, unknown>;
  assert.equal(approvedResponse.status, 200);
  assert.equal(approvedBody.usedRealKey, false);
  assert.equal(approvedBody.incurredCost, false);

  const persisted = taskManager.getTaskFresh(taskId);
  const approvedPlan = planModule.parseVimaxProductionPlan(persisted?.result?.productionPlan);
  assert.equal(approvedPlan?.governance.status, 'awaiting-cost-decision');
  assert.equal(
    approvedPlan?.checkpoints.find(checkpoint => checkpoint.id === 'reference_assets')?.status,
    'awaiting-human',
  );
  assert.equal(approvedPlan?.checkpoints.find(checkpoint => checkpoint.id === 'video')?.status, 'blocked');
  assert.equal(approvedPlan?.render.status, 'not-started');
  assert.equal(approvedPlan?.governance.decisionLog.length, 1);
  assert.equal(approvedPlan?.governance.decisionLog[0]?.action, 'approved');
  assert.deepEqual(governanceView.buildVimaxProductionGovernanceView(approvedPlan), {
    state: 'awaiting-cost-decision',
    label: '费用与执行方式',
    canApprove: false,
    description: '计划已确认。真实媒体费用待供应商确认，也可以先准备不调用模型的制作草稿。',
  });
  assert.throws(() => planModule.assertVimaxProductionPlanForPhase(approvedPlan, 'reference_assets', {
    plan: 'plan-model',
    referenceAssets: 'image-model',
    video: 'video-model',
  }), /真实费用/);

  const duplicateResponse = await taskRoute.POST(approveRequest(), { params: Promise.resolve({ taskId }) });
  assert.equal(duplicateResponse.status, 200);
  const duplicatePlan = planModule.parseVimaxProductionPlan(taskManager.getTaskFresh(taskId)?.result?.productionPlan);
  assert.equal(duplicatePlan?.governance.decisionLog.length, 1);

  const otherGuestResponse = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${taskId}`, {
    method: 'POST',
    headers: { ...headers, 'x-paper-host-guest-workspace': 'guest-creation-production-governance-other' },
    body: JSON.stringify({ action: 'approve-production-plan' }),
  }), { params: Promise.resolve({ taskId }) });
  assert.equal(otherGuestResponse.status, 404);

  rmSync(taskFile, { force: true });
  console.log(JSON.stringify({ ok: true, script: 'test-vimax-production-governance', checks: 20 }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
