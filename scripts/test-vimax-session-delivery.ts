import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-session-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const { buildProductionAssemblyPlan } = await import('../src/lib/production-assembly-plan');
  const { buildProductionProject } = await import('../src/lib/production-project');
  const { generateShotsFromUserPrompt } = await import('../src/lib/storyboard-generator');
  const { createTask, getTaskFresh, startTask } = await import('../src/lib/task-manager');
  const { persistVimaxPlanTask } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-task');
  const { buildVimaxSegmentedProductionView } = await import('../src/lib/skills/vimax-short-drama/vimax-segmented-production');
  const productionPlanModule = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const [{ NextRequest }, queueRoute, taskRoute, taskEvents, retryRoute, exportRoute] = await Promise.all([
    import('next/server'),
    import('../src/app/api/production/assembly-plan/queue/route'),
    import('../src/app/api/tasks/[taskId]/route'),
    import('../src/app/api/tasks/[taskId]/events/route'),
    import('../src/app/api/production/assembly-plan/segment/retry/route'),
    import('../src/app/api/production/export/route'),
  ]);

  const workspace = 'guest-creation-session-delivery-7f9a2c';
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': workspace,
  };
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const prompt = '两位角色在车站重逢，生成两个连续镜头。';
  const generated = generateShotsFromUserPrompt(prompt, 10, { maxShotDuration: 5, preferredSceneType: 'drama' });
  const parentTaskId = createTask('storyboard', { prompt, workflow: 'vimax-agent' }, owner);
  const productionProject = buildProductionProject({
    taskId: parentTaskId,
    prompt,
    duration: 10,
    segmentDuration: 5,
    style: '电影感',
    sceneType: 'drama',
    ratio: '16:9',
    entities: generated.entities,
    visualAnchors: generated.visualAnchors as Array<{ element: string; category: string }>,
    narrativeSummary: generated.narrativeSummary,
    subtitleSuggestion: generated.subtitleSuggestion,
    narrationSuggestion: generated.narrationSuggestion,
    shots: generated.shots.map((shot, index) => ({ ...shot, index: index + 1, status: 'planned' })),
  });
  const assemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: parentTaskId });
  const productionPlan = productionPlanModule.approveVimaxProductionPlan(productionPlanModule.buildVimaxProductionPlan({
    title: '车站重逢',
    ratio: '16:9',
    resolution: '1080p',
    planModel: 'fixture-plan',
    imageModel: 'fixture-image',
    videoModel: 'fixture-video',
    providerReadiness: { plan: true, referenceAssets: true, video: false },
    assets: [],
    shots: assemblyPlan.segments.map(segment => ({
      index: segment.index + 1,
      title: `片段 ${segment.index + 1}`,
      duration: segment.duration,
      camera: '连续运镜',
      prompt: segment.prompt,
    })),
  }));
  persistVimaxPlanTask({
    taskId: parentTaskId,
    prompt,
    plan: {
      title: '车站重逢',
      summary: generated.narrativeSummary,
      assets: [],
      shots: assemblyPlan.segments.map(segment => ({
        index: segment.index + 1,
        title: `片段 ${segment.index + 1}`,
        duration: segment.duration,
        camera: '连续运镜',
        prompt: segment.prompt,
      })),
      nextAction: '创建分段任务',
    },
    productionProject,
    assemblyPlan,
    productionPlan,
  });

  const draftDecisionResponse = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${parentTaskId}`, {
    method: 'POST', headers, body: JSON.stringify({ action: 'confirm-production-draft' }),
  }), { params: Promise.resolve({ taskId: parentTaskId }) });
  assert.equal(draftDecisionResponse.status, 200);

  const queueResponse = await queueRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/queue', {
    method: 'POST', headers, body: JSON.stringify({ taskId: parentTaskId }),
  }));
  const queueBody = await queueResponse.json() as { childTaskIds?: string[]; usedRealKey?: boolean; incurredCost?: boolean };
  assert.equal(queueResponse.status, 200);
  assert.equal(queueBody.usedRealKey, false);
  assert.equal(queueBody.incurredCost, false);
  const childTaskId = queueBody.childTaskIds?.[0] || '';
  assert.ok(childTaskId);

  const parent = getTaskFresh(parentTaskId);
  const initialView = buildVimaxSegmentedProductionView(parentTaskId, parent?.result, {
    [childTaskId]: { status: 'pending', progress: 0, stage: '等待制作' },
  });
  assert.equal(initialView.segments[0]?.taskId, childTaskId, 'project UI must retain the real child task id');
  assert.equal(initialView.segments[0]?.status, 'queued');
  assert.deepEqual(initialView.segments[0]?.cancelAction, {
    path: `/api/tasks/${childTaskId}`,
    method: 'DELETE',
  });

  assert.equal(startTask(childTaskId), true);
  const streamResponse = await taskEvents.GET(
    new NextRequest(`http://localhost/api/tasks/${childTaskId}/events`, { headers }),
    { params: Promise.resolve({ taskId: childTaskId }) },
  );
  const cancelResponse = await taskRoute.DELETE(
    new NextRequest(`http://localhost/api/tasks/${childTaskId}`, { method: 'DELETE', headers }),
    { params: Promise.resolve({ taskId: childTaskId }) },
  );
  assert.equal(cancelResponse.status, 200);
  const streamText = await streamResponse.text();
  assert.match(streamText, /"status":"running"/);
  assert.match(streamText, /"status":"cancelled"/);

  const cancelledView = buildVimaxSegmentedProductionView(parentTaskId, parent?.result, {
    [childTaskId]: { status: 'cancelled', progress: 0, stage: '已取消' },
  });
  assert.equal(cancelledView.segments[0]?.status, 'cancelled');
  assert.equal(cancelledView.segments[0]?.retryAction?.path, '/api/production/assembly-plan/segment/retry');
  assert.equal(cancelledView.exportPath, initialView.exportPath, 'a cancelled attempt must not replace the last deliverable');

  const retryResponse = await retryRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/segment/retry', {
    method: 'POST', headers, body: JSON.stringify(cancelledView.segments[0]?.retryAction?.body),
  }));
  assert.equal(retryResponse.status, 200);
  assert.equal(getTaskFresh(childTaskId)?.status, 'pending');

  async function updateProduction(action: string) {
    return taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${parentTaskId}`, {
      method: 'POST', headers, body: JSON.stringify({ action }),
    }), { params: Promise.resolve({ taskId: parentTaskId }) });
  }
  assert.equal((await updateProduction('confirm-production-draft')).status, 200);
  assert.equal((await updateProduction('prepare-production-draft')).status, 200);
  const deliveryParent = getTaskFresh(parentTaskId);
  const deliveryView = buildVimaxSegmentedProductionView(parentTaskId, deliveryParent?.result, {
    [childTaskId]: { status: 'pending', progress: 0, stage: '等待重试' },
  });
  assert.equal(deliveryView.exportPath, `/api/production/export?taskId=${parentTaskId}`);
  const exportResponse = await exportRoute.GET(new NextRequest(`http://localhost${deliveryView.exportPath}`, { headers }));
  assert.equal(exportResponse.status, 200, 'download must continue to target the last successful deliverable');

  const otherGuest = await taskRoute.GET(
    new NextRequest(`http://localhost/api/tasks/${childTaskId}`, {
      headers: { ...headers, 'x-paper-host-guest-workspace': 'guest-creation-session-delivery-other' },
    }),
    { params: Promise.resolve({ taskId: childTaskId }) },
  );
  assert.equal(otherGuest.status, 404);

  const cardSource = readFileSync(new URL('../src/components/generate/vimax-segmented-production-card.tsx', import.meta.url), 'utf8');
  const viewSource = readFileSync(new URL('../src/lib/skills/vimax-short-drama/vimax-segmented-production.ts', import.meta.url), 'utf8');
  assert.match(cardSource, /streamCreationTask/);
  assert.match(cardSource, /action\.method \|\| 'POST'/);
  assert.match(viewSource, /method:\s*'DELETE'/);
  assert.match(cardSource, /正在同步任务阶段/);
  assert.doesNotMatch(cardSource, /LibTV|SceneWeave|ViMAX/);

  rmSync(taskFile, { force: true });
  console.log(JSON.stringify({ ok: true, script: 'test-vimax-session-delivery', providerCalls: 0 }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
