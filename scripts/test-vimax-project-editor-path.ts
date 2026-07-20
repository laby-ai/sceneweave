import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-project-editor-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const { NextRequest } = await import('next/server');
  const { buildProductionProject } = await import('../src/lib/production-project');
  const { generateShotsFromUserPrompt } = await import('../src/lib/storyboard-generator');
  const { createTask, getTaskFresh, updateTask } = await import('../src/lib/task-manager');
  const assetRoute = await import('../src/app/api/production/projects/[taskId]/assets/[assetId]/route');
  const storyboardRoute = await import('../src/app/api/production/projects/[taskId]/storyboard/[shotId]/route');
  const taskRoute = await import('../src/app/api/tasks/[taskId]/route');

  const workspace = 'guest-creation-project-editor-path-a19d63';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': workspace,
  };
  const prompt = '一位设计师在清晨车站完成一支品牌短片的三个镜头。';
  const generated = generateShotsFromUserPrompt(prompt, 12, { maxShotDuration: 4, preferredSceneType: 'commercial' });
  const taskId = createTask('storyboard', { prompt, workflow: 'vimax-agent' }, owner);
  const productionProject = buildProductionProject({
    taskId,
    prompt,
    duration: 12,
    segmentDuration: 4,
    style: '清透商业短片',
    sceneType: 'commercial',
    ratio: '16:9',
    entities: generated.entities,
    visualAnchors: generated.visualAnchors as Array<{ element: string; category: string }>,
    narrativeSummary: generated.narrativeSummary,
    subtitleSuggestion: generated.subtitleSuggestion,
    narrationSuggestion: generated.narrationSuggestion,
    shots: generated.shots.map((shot, index) => ({ ...shot, index: index + 1, status: 'planned' })),
  });
  updateTask(taskId, { status: 'completed', progress: 100, result: { productionProject } });

  const asset = productionProject.assets.find(item => item.kind === 'script');
  const shot = productionProject.storyboard.shots[0];
  assert.ok(asset);
  assert.ok(shot);

  const initial = await taskRoute.GET(new NextRequest(`http://localhost/api/tasks/${taskId}`, { headers }), {
    params: Promise.resolve({ taskId }),
  });
  assert.equal(initial.status, 200);

  const assetResponse = await assetRoute.PATCH(new NextRequest(
    `http://localhost/api/production/projects/${taskId}/assets/${asset.id}`,
    { method: 'PATCH', headers, body: JSON.stringify({ name: '品牌短片脚本定稿', summary: '保留清晨冷暖对比与车站动线。' }) },
  ), { params: Promise.resolve({ taskId, assetId: asset.id }) });
  assert.equal(assetResponse.status, 200);
  const assetBody = await assetResponse.json() as { usedRealKey?: boolean; incurredCost?: boolean };
  assert.equal(assetBody.usedRealKey, false);
  assert.equal(assetBody.incurredCost, false);

  const failedShotResponse = await storyboardRoute.PATCH(new NextRequest(
    `http://localhost/api/production/projects/${taskId}/storyboard/${shot.id}`,
    { method: 'PATCH', headers, body: JSON.stringify({ prompt: '', duration: 0 }) },
  ), { params: Promise.resolve({ taskId, shotId: shot.id }) });
  assert.equal(failedShotResponse.status, 400);
  const afterFailure = getTaskFresh(taskId);
  const afterFailureProject = afterFailure?.result?.productionProject as typeof productionProject | undefined;
  assert.equal(afterFailureProject?.assets.find(item => item.id === asset.id)?.name, '品牌短片脚本定稿');
  assert.equal(afterFailureProject?.storyboard.shots.find(item => item.id === shot.id)?.prompt, shot.prompt);

  const shotResponse = await storyboardRoute.PATCH(new NextRequest(
    `http://localhost/api/production/projects/${taskId}/storyboard/${shot.id}`,
    { method: 'PATCH', headers, body: JSON.stringify({ prompt: '镜头沿站台缓慢推进，人物在晨光中回望。', duration: 6 }) },
  ), { params: Promise.resolve({ taskId, shotId: shot.id }) });
  assert.equal(shotResponse.status, 200);
  const shotBody = await shotResponse.json() as { usedRealKey?: boolean; incurredCost?: boolean };
  assert.equal(shotBody.usedRealKey, false);
  assert.equal(shotBody.incurredCost, false);

  const refreshed = await taskRoute.GET(new NextRequest(`http://localhost/api/tasks/${taskId}`, { headers }), {
    params: Promise.resolve({ taskId }),
  });
  const refreshedBody = await refreshed.json() as { task?: { result?: { productionProject?: typeof productionProject } } };
  const refreshedProject = refreshedBody.task?.result?.productionProject;
  assert.equal(refreshedProject?.assets.find(item => item.id === asset.id)?.summary, '保留清晨冷暖对比与车站动线。');
  assert.equal(refreshedProject?.storyboard.shots.find(item => item.id === shot.id)?.duration, 6);

  const otherHeaders = { ...headers, 'x-paper-host-guest-workspace': 'guest-creation-project-editor-path-other' };
  const isolated = await taskRoute.GET(new NextRequest(`http://localhost/api/tasks/${taskId}`, { headers: otherHeaders }), {
    params: Promise.resolve({ taskId }),
  });
  assert.equal(isolated.status, 404);
  const isolatedPatch = await assetRoute.PATCH(new NextRequest(
    `http://localhost/api/production/projects/${taskId}/assets/${asset.id}`,
    { method: 'PATCH', headers: otherHeaders, body: JSON.stringify({ name: '越权改写' }) },
  ), { params: Promise.resolve({ taskId, assetId: asset.id }) });
  assert.equal(isolatedPatch.status, 404);

  console.log(JSON.stringify({
    ok: true,
    script: 'test-vimax-project-editor-path',
    checks: 16,
    usedRealKey: false,
    incurredCost: false,
  }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  rmSync(taskFile, { force: true });
});
