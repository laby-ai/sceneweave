import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-render-delivery-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;

async function main() {
  const { NextRequest } = await import('next/server');
  const { buildProductionAssemblyPlan } = await import('../src/lib/production-assembly-plan');
  const { freshArtifactReadiness } = await import('../src/lib/production-artifact-stale');
  const { buildProductionProject } = await import('../src/lib/production-project');
  const { archiveCompletedVideoTaskById } = await import('../src/lib/production-video-task-archive-service');
  const { generateShotsFromUserPrompt } = await import('../src/lib/storyboard-generator');
  const { createTask, getTaskFresh, updateTask } = await import('../src/lib/task-manager');
  const productionPlanModule = await import('../src/lib/skills/vimax-short-drama/vimax-production-plan');
  const [taskRoute, exportRoute, mergeRoute] = await Promise.all([
    import('../src/app/api/tasks/[taskId]/route'),
    import('../src/app/api/production/export/route'),
    import('../src/app/api/tasks/[taskId]/merge-segments/route'),
  ]);

  const workspace = 'guest-creation-render-delivery-7f9a2c';
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': workspace,
  };
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const prompt = '记者在雨夜车站用红色录音笔记录重逢。';
  const generated = generateShotsFromUserPrompt(prompt, 10, {
    maxShotDuration: 5,
    preferredSceneType: 'drama',
  });
  const taskId = createTask('video', {
    prompt,
    duration: '10',
    ratio: '16:9',
    resolution: '1080p',
  }, owner);
  const builtProject = buildProductionProject({
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
  const productionProject = {
    ...builtProject,
    storyboard: {
      ...builtProject.storyboard,
      shots: builtProject.storyboard.shots.map(shot => ({ ...shot, status: 'completed' as const })),
    },
  };
  const baseAssemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: taskId });
  const assemblyPlan = {
    ...baseAssemblyPlan,
    status: 'completed' as const,
    segments: baseAssemblyPlan.segments.map((segment, index) => ({
      ...segment,
      status: 'completed' as const,
      artifactReadiness: freshArtifactReadiness(productionProject),
      expectedOutputs: {
        ...segment.expectedOutputs,
        taskId: `${taskId}-segment-${index + 1}`,
        videoUrl: `/generated/videos/segment-${index + 1}.mp4`,
      },
    })),
  };
  const builtPlan = productionPlanModule.buildVimaxProductionPlan({
    title: '雨夜重逢',
    ratio: '16:9',
    resolution: '1080p',
    planModel: 'fixture-plan',
    imageModel: 'fixture-image',
    videoModel: 'fixture-video',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [],
    shots: assemblyPlan.segments.map(segment => ({
      index: segment.index + 1,
      title: `镜头 ${segment.index + 1}`,
      duration: segment.duration,
      camera: '连续运镜',
      prompt: segment.prompt,
    })),
  });
  const approvedPlan = productionPlanModule.approveVimaxProductionPlan(builtPlan);
  const productionPlan = {
    ...approvedPlan,
    governance: { ...approvedPlan.governance, status: 'ready' as const },
    estimatedCost: { ...approvedPlan.estimatedCost, amount: 1, status: 'confirmed' as const },
  };
  const completedAt = Date.now();
  updateTask(taskId, {
    status: 'completed',
    completedAt,
    result: {
      videoUrl: '/generated/videos/final-current.mp4',
      segments: assemblyPlan.segments.map((segment, index) => ({
        index,
        status: 'completed' as const,
        taskId: `${taskId}-segment-${index + 1}`,
        videoUrl: segment.expectedOutputs.videoUrl || undefined,
        duration: segment.duration,
        prompt: segment.prompt,
      })),
      productionProject,
      assemblyPlan,
      productionPlan,
    },
  });

  const unapprovedMerge = await mergeRoute.POST(new NextRequest(
    `http://localhost/api/tasks/${taskId}/merge-segments`,
    { method: 'POST', headers },
  ), { params: Promise.resolve({ taskId }) });
  assert.equal(unapprovedMerge.status, 409, 'compose must fail closed before the current artifact version is approved');
  assert.equal((await unapprovedMerge.json()).usedRealKey, false);

  const approveResponse = await taskRoute.POST(new NextRequest(`http://localhost/api/tasks/${taskId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve-production-render' }),
  }), { params: Promise.resolve({ taskId }) });
  assert.equal(approveResponse.status, 200);
  assert.equal((await approveResponse.json()).usedRealKey, false);

  archiveCompletedVideoTaskById(taskId);
  const archived = getTaskFresh(taskId);
  const finalAsset = (archived?.result?.productionProject as {
    assets?: Array<{ kind?: string; metadata?: { artifactVersion?: string } }>;
  } | undefined)?.assets?.find(asset => asset.kind === 'finalVideo');
  const archivedPlan = productionPlanModule.parseVimaxProductionPlan(archived?.result?.productionPlan);
  assert.equal(finalAsset?.metadata?.artifactVersion, archivedPlan?.render.lastSuccessfulResult?.artifactVersion);

  const archivedProject = archived?.result?.productionProject as {
    assets: Array<{
      id: string;
      kind: string;
      metadata?: Record<string, unknown>;
    }>;
  };
  const currentFinalAsset = archivedProject.assets.find(asset => asset.kind === 'finalVideo');
  assert.ok(currentFinalAsset);
  updateTask(taskId, {
    result: {
      ...archived?.result,
      productionProject: {
        ...archivedProject,
        assets: [
          {
            ...currentFinalAsset,
            id: 'final-video-legacy',
            metadata: {
              ...currentFinalAsset.metadata,
              videoUrl: '/generated/videos/final-legacy.mp4',
              artifactVersion: 'legacy-artifact-version',
            },
          },
          ...archivedProject.assets,
        ],
      },
    },
  });

  const exportResponse = await exportRoute.GET(new NextRequest(
    `http://localhost/api/production/export?taskId=${taskId}`,
    { headers },
  ));
  assert.equal(exportResponse.status, 200);
  const exportBody = await exportResponse.json() as {
    usedRealKey?: boolean;
    exportPackage?: {
      assets?: {
        finalVideos?: Array<{ videoUrl?: string; artifactVersion?: string }>;
        all?: Array<{ id?: string }>;
      };
    };
  };
  assert.equal(exportBody.usedRealKey, false);
  assert.deepEqual(
    exportBody.exportPackage?.assets?.finalVideos?.map(asset => asset.videoUrl),
    ['/generated/videos/final-current.mp4'],
    'delivery must include only the last successful final video',
  );
  assert.equal(
    exportBody.exportPackage?.assets?.all?.some(asset => asset.id === 'final-video-legacy'),
    false,
    'delivery must omit stale final-video assets from the batch package',
  );

  const delivered = getTaskFresh(taskId);
  updateTask(taskId, {
    result: {
      ...delivered?.result,
      productionProject: {
        ...(delivered?.result?.productionProject as object),
        prompt: `${prompt} 改为清晨。`,
      },
    },
  });
  const staleExport = await exportRoute.GET(new NextRequest(
    `http://localhost/api/production/export?taskId=${taskId}`,
    { headers },
  ));
  assert.equal(staleExport.status, 409);
  assert.match(String((await staleExport.json()).error), /当前项目版本不一致/);

  rmSync(taskFile, { force: true });
  console.log(JSON.stringify({
    ok: true,
    script: 'test-vimax-render-delivery-route',
    providerCalls: 0,
    incurredCost: false,
  }));
}

main().catch(error => {
  rmSync(taskFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
