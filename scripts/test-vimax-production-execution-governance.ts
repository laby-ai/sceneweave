import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-execution-governance-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const [{ NextRequest }, taskRoute, exportRoute, planModule, taskManager] = await Promise.all([
    import('next/server'),
    import('../src/app/api/tasks/[taskId]/route'),
    import('../src/app/api/production/export/route'),
    import('../src/lib/skills/vimax-short-drama/vimax-production-plan'),
    import('../src/lib/task-manager'),
  ]);

  const guestWorkspace = 'guest-creation-execution-governance-b2';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(guestWorkspace).digest('hex').slice(0, 32)}`,
  };
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': guestWorkspace,
  };
  const taskId = taskManager.createTask('storyboard', { prompt: '无成本制作草稿' }, owner);
  const productionPlan = planModule.approveVimaxProductionPlan(planModule.buildVimaxProductionPlan({
    title: '无成本制作草稿',
    ratio: '16:9',
    resolution: '1080p',
    planModel: 'plan-model',
    imageModel: 'image-model',
    videoModel: 'video-model',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [{ kind: 'reference', label: '主视觉' }],
    shots: [{ index: 1, title: '开场', duration: 5, camera: '推进', prompt: '产品特写' }],
  }));
  taskManager.startTask(taskId);
  taskManager.completeTask(taskId, {
    productionPlan,
    productionProject: {
      version: 'production-project-v1',
      id: 'project-governance-b2',
      title: '无成本制作草稿',
      duration: 5,
      ratio: '16:9',
      style: '品牌短片',
      narrativeSummary: '用于验证执行治理与交付。',
      storyBible: {},
      stages: [],
      storyboard: { shots: [] },
      assets: [],
    },
  });

  async function post(action: string) {
    return taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${taskId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action }),
    }), { params: Promise.resolve({ taskId }) });
  }

  const draftResponse = await post('confirm-production-draft');
  assert.equal(draftResponse.status, 200);
  const draftBody = await draftResponse.json() as Record<string, unknown>;
  assert.equal(draftBody.usedRealKey, false);
  assert.equal(draftBody.incurredCost, false);
  let currentPlan = planModule.parseVimaxProductionPlan(taskManager.getTaskFresh(taskId)?.result?.productionPlan);
  assert.equal(currentPlan?.governance.status, 'ready');
  assert.equal(currentPlan?.estimatedCost.status, 'draft-only-confirmed');
  assert.equal(currentPlan?.checkpoints.find(item => item.id === 'reference_assets')?.status, 'skipped');
  assert.equal(currentPlan?.checkpoints.find(item => item.id === 'video')?.status, 'skipped');
  assert.equal(currentPlan?.checkpoints.find(item => item.id === 'render')?.status, 'pending');

  const pauseResponse = await post('pause-production');
  assert.equal(pauseResponse.status, 200);
  currentPlan = planModule.parseVimaxProductionPlan(taskManager.getTaskFresh(taskId)?.result?.productionPlan);
  assert.equal(currentPlan?.governance.status, 'paused');

  const recoveredResponse = await taskRoute.GET(new NextRequest(`http://localhost/api/tasks/${taskId}`, { headers }), {
    params: Promise.resolve({ taskId }),
  });
  const recoveredBody = await recoveredResponse.json() as { task?: { result?: { productionPlan?: unknown } } };
  assert.equal(planModule.parseVimaxProductionPlan(recoveredBody.task?.result?.productionPlan)?.governance.status, 'paused');

  const pausedExportResponse = await exportRoute.GET(new NextRequest(
    `http://localhost/api/production/export?taskId=${taskId}&format=cut-draft-json`,
    { headers },
  ));
  assert.equal(pausedExportResponse.status, 409);
  const pausedExportBody = await pausedExportResponse.json() as Record<string, unknown>;
  assert.match(String(pausedExportBody.error), /尚未准备完成/);

  const blockedDelivery = await post('prepare-production-draft');
  assert.equal(blockedDelivery.status, 409);
  const blockedBody = await blockedDelivery.json() as Record<string, unknown>;
  assert.match(String(blockedBody.error), /继续流程/);

  const resumeResponse = await post('resume-production');
  assert.equal(resumeResponse.status, 200);
  currentPlan = planModule.parseVimaxProductionPlan(taskManager.getTaskFresh(taskId)?.result?.productionPlan);
  assert.equal(currentPlan?.governance.status, 'ready');

  const deliveryResponse = await post('prepare-production-draft');
  assert.equal(deliveryResponse.status, 200);
  currentPlan = planModule.parseVimaxProductionPlan(taskManager.getTaskFresh(taskId)?.result?.productionPlan);
  assert.equal(currentPlan?.governance.status, 'delivery-ready');
  assert.equal(currentPlan?.checkpoints.find(item => item.id === 'render')?.status, 'completed');
  assert.equal(currentPlan?.render.status, 'draft-ready');

  const exportResponse = await exportRoute.GET(new NextRequest(
    `http://localhost/api/production/export?taskId=${taskId}&format=cut-draft-json`,
    { headers },
  ));
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get('content-disposition') || '', /attachment/);
  const exportBody = await exportResponse.json() as Record<string, unknown>;
  assert.equal(exportBody.usedRealKey, false);
  assert.equal(exportBody.incurredCost, false);

  const otherGuestResponse = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${taskId}`, {
    method: 'POST',
    headers: { ...headers, 'x-paper-host-guest-workspace': 'guest-creation-execution-governance-other' },
    body: JSON.stringify({ action: 'pause-production' }),
  }), { params: Promise.resolve({ taskId }) });
  assert.equal(otherGuestResponse.status, 404);

  rmSync(taskFile, { force: true });
  console.log(JSON.stringify({
    ok: true,
    script: 'test-vimax-production-execution-governance',
    checks: 26,
    usedRealKey: false,
    incurredCost: false,
  }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
