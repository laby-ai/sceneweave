import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-segments-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
const { buildProductionAssemblyPlan } = await import('../src/lib/production-assembly-plan');
const { buildProductionProject } = await import('../src/lib/production-project');
const { generateShotsFromUserPrompt } = await import('../src/lib/storyboard-generator');
const { createTask, getTaskFresh, updateTask } = await import('../src/lib/task-manager');
const { persistVimaxPlanTask } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-task');
const { buildVimaxSegmentedProductionView } = await import('../src/lib/skills/vimax-short-drama/vimax-segmented-production');
const productionPlanModule = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
const [{ NextRequest }, queueRoute, exportRoute, retryRoute, taskRoute, storyboardRoute] = await Promise.all([
  import('next/server'),
  import('../src/app/api/production/assembly-plan/queue/route'),
  import('../src/app/api/production/export/route'),
  import('../src/app/api/production/assembly-plan/segment/retry/route'),
  import('../src/app/api/tasks/[taskId]/route'),
  import('../src/app/api/production/projects/[taskId]/storyboard/[shotId]/route'),
]);

const guestWorkspace = 'guest-creation-segmented-production-7f9a2c';
const owner = {
  tenantId: 'paper-host-guest',
  memberId: `guest-${createHash('sha256').update(guestWorkspace).digest('hex').slice(0, 32)}`,
};
const prompt = '两位青年在雨夜车站重逢，制作两个连续镜头。';
const generated = generateShotsFromUserPrompt(prompt, 10, { maxShotDuration: 5, preferredSceneType: 'drama' });
const taskId = createTask('storyboard', { prompt, workflow: 'vimax-agent' }, owner);
const productionProject = buildProductionProject({
  taskId,
  prompt,
  duration: 10,
  segmentDuration: 5,
  style: '电影感短剧',
  sceneType: 'drama',
  ratio: '16:9',
  entities: generated.entities,
  visualAnchors: generated.visualAnchors as Array<{ element: string; category: string }>,
  narrativeSummary: generated.narrativeSummary,
  subtitleSuggestion: generated.subtitleSuggestion,
  narrationSuggestion: generated.narrationSuggestion,
  shots: generated.shots.map((shot, index) => ({ ...shot, index: index + 1, status: 'planned' })),
});
const assemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: taskId });
const productionPlan = productionPlanModule.approveVimaxProductionPlan(productionPlanModule.buildVimaxProductionPlan({
  title: '雨夜重逢',
  ratio: '16:9',
  resolution: '1080p',
  planModel: 'plan-model',
  imageModel: 'image-model',
  videoModel: 'video-model',
  providerReadiness: { plan: true, referenceAssets: true, video: true },
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
  taskId,
  prompt,
  plan: {
    title: '雨夜重逢',
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

const persisted = getTaskFresh(taskId);
assert.equal(persisted?.status, 'completed');
assert.equal(persisted?.owner?.memberId, owner.memberId);
assert.equal((persisted?.result?.productionProject as { id?: string } | undefined)?.id, productionProject.id);
assert.equal(persisted?.result?.assemblyPlan?.sourceTaskId, taskId);

const readyView = buildVimaxSegmentedProductionView(taskId, persisted?.result);
assert.equal(readyView.state, 'ready');
assert.equal(readyView.segments.length, assemblyPlan.segments.length);
assert.equal(readyView.primaryAction, null, 'queue action must stay hidden before the zero-cost decision');
assert.equal(readyView.exportPath, null);

const guestHeaders = {
  'content-type': 'application/json',
  'x-paper-host-embed': 'creation-agent',
  'x-paper-host-guest-workspace': guestWorkspace,
};

async function updateProduction(action: string) {
  return taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${taskId}`, {
    method: 'POST',
    headers: guestHeaders,
    body: JSON.stringify({ action }),
  }), { params: Promise.resolve({ taskId }) });
}

const bypassQueueResponse = await queueRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/queue', {
  method: 'POST',
  headers: guestHeaders,
  body: JSON.stringify({ taskId }),
}));
const bypassQueueBody = await bypassQueueResponse.json() as Record<string, unknown>;
assert.equal(bypassQueueResponse.status, 409, 'segment queue must not bypass the cost decision checkpoint');
assert.equal(bypassQueueBody.usedRealKey, false);
assert.equal(bypassQueueBody.incurredCost, false);

assert.equal((await updateProduction('confirm-production-draft')).status, 200);
const confirmedView = buildVimaxSegmentedProductionView(taskId, getTaskFresh(taskId)?.result);
assert.deepEqual(confirmedView.primaryAction, {
  label: '创建分段任务',
  path: '/api/production/assembly-plan/queue',
  body: { taskId },
});

const shotId = productionProject.storyboard.shots[0]?.id || '';
const storyboardResponse = await storyboardRoute.PATCH(new NextRequest(
  `http://localhost/api/production/projects/${taskId}/storyboard/${shotId}`,
  {
    method: 'PATCH',
    headers: guestHeaders,
    body: JSON.stringify({ prompt: '青年抬头看见故人，雨滴沿站台灯光落下。' }),
  },
), { params: Promise.resolve({ taskId, shotId }) });
assert.equal(storyboardResponse.status, 200, 'confirmed project storyboard must remain editable before queueing');

const queueResponse = await queueRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/queue', {
  method: 'POST',
  headers: guestHeaders,
  body: JSON.stringify({ taskId }),
}));
const queueBody = await queueResponse.json() as Record<string, unknown>;
assert.equal(queueResponse.status, 200, JSON.stringify(queueBody));
assert.equal(queueBody.usedRealKey, false);
assert.equal(queueBody.incurredCost, false);
assert.equal(queueBody.taskId, taskId);

const exportResponse = await exportRoute.GET(new NextRequest(`http://localhost/api/production/export?taskId=${taskId}`, {
  headers: guestHeaders,
}));
assert.equal(exportResponse.status, 409);

const failedResult = {
  ...getTaskFresh(taskId)?.result,
  assemblyQueue: {
    version: 'yh-assembly-queue-v1',
    sourceTaskId: taskId,
    status: 'failed',
    queuedSegmentCount: assemblyPlan.segments.length,
    childTaskIds: ['child-1'],
    updatedAt: new Date().toISOString(),
  },
  assemblyPlan: {
    ...assemblyPlan,
    status: 'failed',
    segments: assemblyPlan.segments.map((segment, index) => index === 0 ? {
      ...segment,
      status: 'failed' as const,
      error: 'provider_timeout',
      expectedOutputs: { ...segment.expectedOutputs, taskId: 'child-1' },
    } : segment),
  },
};
const failedView = buildVimaxSegmentedProductionView(taskId, failedResult);
assert.equal(failedView.state, 'failed');
assert.deepEqual(failedView.segments[0]?.retryAction, {
  path: '/api/production/assembly-plan/segment/retry',
  body: { parentTaskId: taskId, segmentIndex: 0, childTaskId: 'child-1' },
});
assert.equal(failedView.segments[1]?.retryAction, null);

updateTask(taskId, { result: failedResult });
updateTask('child-1', { status: 'failed', error: 'provider_timeout' });
const anonymousRetry = await retryRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/segment/retry', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(failedView.segments[0]?.retryAction?.body),
}));
assert.equal(anonymousRetry.status, 401);
const otherGuestRetry = await retryRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/segment/retry', {
  method: 'POST',
  headers: { ...guestHeaders, 'x-paper-host-guest-workspace': 'guest-creation-segmented-production-other' },
  body: JSON.stringify(failedView.segments[0]?.retryAction?.body),
}));
assert.equal(otherGuestRetry.status, 404);

assert.equal((await updateProduction('pause-production')).status, 200);
const pausedRetry = await retryRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/segment/retry', {
  method: 'POST',
  headers: guestHeaders,
  body: JSON.stringify(failedView.segments[0]?.retryAction?.body),
}));
assert.equal(pausedRetry.status, 409, 'paused production must reject segment retry');
assert.equal((await updateProduction('resume-production')).status, 200);
const guestRetry = await retryRoute.POST(new NextRequest('http://localhost/api/production/assembly-plan/segment/retry', {
  method: 'POST',
  headers: guestHeaders,
  body: JSON.stringify(failedView.segments[0]?.retryAction?.body),
}));
assert.equal(guestRetry.status, 200);

assert.equal((await updateProduction('prepare-production-draft')).status, 200);
const deliveryTask = getTaskFresh(taskId);
const deliveryView = buildVimaxSegmentedProductionView(taskId, deliveryTask?.result);
assert.equal(deliveryView.exportPath, `/api/production/export?taskId=${taskId}`);
const deliveryExport = await exportRoute.GET(new NextRequest(`http://localhost${deliveryView.exportPath}`, {
  headers: guestHeaders,
}));
assert.equal(deliveryExport.status, 200);

const workspaceSource = readFileSync(new URL('../src/components/generate/generate-workspace.tsx', import.meta.url), 'utf8');
assert.match(workspaceSource, /VimaxSegmentedProductionCard taskId=\{agent\.taskId\}/);
const routeSource = readFileSync(new URL('../src/app/api/smart/vimax-agent-step/route.ts', import.meta.url), 'utf8');
assert.match(routeSource, /createPersistedPlanEnvelope\(owner, prompt, result\.model, result\.plan, body\)/);

rmSync(taskFile, { force: true });
console.log(JSON.stringify({ ok: true, script: 'test-vimax-segmented-production', checks: 38 }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
