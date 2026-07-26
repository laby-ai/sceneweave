import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-persisted-render-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const { NextRequest } = await import('next/server');
  const { buildProductionAssemblyPlan } = await import('../src/lib/production-assembly-plan');
  const { freshArtifactReadiness } = await import('../src/lib/production-artifact-stale');
  const { buildProductionProject } = await import('../src/lib/production-project');
  const { generateShotsFromUserPrompt } = await import('../src/lib/storyboard-generator');
  const { createTask, getTaskFresh, updateTask } = await import('../src/lib/task-manager');
  const {
    applyRecoveredVimaxProductionPlan,
    needsPersistedVimaxRenderRecovery,
    recoverVimaxTaskProject,
  } = await import('../src/lib/skills/vimax-short-drama/vimax-task-project-recovery');
  const productionPlanModule = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const taskRoute = await import('../src/app/api/tasks/[taskId]/route');

  const workspace = 'guest-creation-persisted-render-recovery';
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': workspace,
  };
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const prompt = '雨夜天台上的单镜头测试。';
  const taskId = createTask('storyboard', { prompt, duration: '5', ratio: '16:9', resolution: '1080p' }, owner);
  const generated = generateShotsFromUserPrompt(prompt, 5, { maxShotDuration: 5, preferredSceneType: 'drama' });
  const productionProject = buildProductionProject({
    taskId,
    prompt,
    duration: 5,
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
  const baseAssemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: taskId });
  const assemblyPlan = {
    ...baseAssemblyPlan,
    status: 'completed' as const,
    segments: baseAssemblyPlan.segments.map(segment => ({
      ...segment,
      status: 'completed' as const,
      artifactReadiness: freshArtifactReadiness(productionProject),
      expectedOutputs: {
        ...segment.expectedOutputs,
        videoUrl: '/generated/videos/segment-1.mp4',
        lastFrameUrl: '/generated/images/segment-1-last.jpg',
      },
    })),
  };
  const builtPlan = productionPlanModule.buildVimaxProductionPlan({
    title: '雨夜天台',
    ratio: '16:9',
    resolution: '1080p',
    planModel: 'fixture-plan',
    imageModel: 'fixture-image',
    videoModel: 'fixture-video',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [],
    shots: assemblyPlan.segments.map(segment => ({
      index: segment.index + 1,
      title: '单镜头',
      duration: segment.duration,
      camera: '固定镜头',
      prompt: segment.prompt,
    })),
  });
  const approvedPlan = productionPlanModule.approveVimaxProductionPlan(builtPlan);
  const productionPlan = {
    ...approvedPlan,
    governance: { ...approvedPlan.governance, status: 'ready' as const },
    estimatedCost: { ...approvedPlan.estimatedCost, amount: 1, status: 'confirmed' as const },
  };
  const renderReport = {
    version: 'sceneweave-render-report-v1',
    status: 'passed',
    runtime: 'sceneweave-segmented-ffmpeg-v1',
    checkedAt: '2026-07-23T00:00:00.000Z',
    segmentCount: 1,
    expectedDurationSeconds: 5,
    actualDurationSeconds: 5,
    outputBytes: 4096,
  };
  updateTask(taskId, {
    status: 'completed',
    completedAt: Date.parse(renderReport.checkedAt),
    result: {
      productionProject,
      assemblyPlan,
      productionPlan,
      vimaxVideoResult: {
        videoUrl: '/huiying/api/final-videos/persisted-final',
        merge: { renderReport },
      },
    },
  });
  const persistedBeforeRepair = getTaskFresh(taskId);
  assert.equal(recoverVimaxTaskProject(persistedBeforeRepair), null);
  assert.equal(needsPersistedVimaxRenderRecovery(persistedBeforeRepair), true);

  const response = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${taskId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'recover-production-render' }),
  }), { params: Promise.resolve({ taskId }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.usedRealKey, false);
  assert.equal(body.incurredCost, false);
  assert.equal(body.productionPlan.render.status, 'completed');
  assert.equal(
    getTaskFresh(taskId)?.result?.productionPlan && body.productionPlan.render.lastSuccessfulResult.videoUrl,
    '/huiying/api/final-videos/persisted-final',
  );
  const recoveredProject = recoverVimaxTaskProject(
    applyRecoveredVimaxProductionPlan(persistedBeforeRepair, body.productionPlan),
  );
  assert.equal(recoveredProject?.messages[1].generatedVideo?.url, '/huiying/api/final-videos/persisted-final');

  rmSync(taskFile, { force: true });
  console.log(JSON.stringify({ ok: true, script: 'test-vimax-persisted-render-recovery-route', providerCalls: 0 }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
