import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const originalFetch = globalThis.fetch;
let tempDir = '';

async function main() {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'huiying-tail-recovery-'));
  process.env.HUIYING_TASKS_FILE = path.join(tempDir, 'tasks.json');
  delete process.env.HUIYING_PUBLIC_ASSET_BASE_URL;
  delete process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;
  delete process.env.HUIYING_OBJECT_STORAGE_ENDPOINT_URL;
  delete process.env.HUIYING_OBJECT_STORAGE_BUCKET_NAME;
  delete process.env.HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID;
  delete process.env.HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY;
  delete process.env.HUIYING_DISABLE_BASE64_FRAME_HANDOFF;

  const sampleVideoPath = path.resolve('public/home/huiying-ark-test-clip.mp4');
  const sampleVideo = await fs.readFile(sampleVideoPath);
  (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => new Response(sampleVideo, {
    status: 200,
    headers: { 'content-type': 'video/mp4' },
  });

  const taskManager = await import('../src/lib/task-manager');
  const { recoverProductionSegmentTailFrame } = await import('../src/lib/production-segment-tail-recovery');

  const parentTaskId = taskManager.createTask('storyboard', { prompt: 'tail recovery QA parent' });
  const childTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 0,
    ratio: '16:9',
  });
  const secondChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 1,
    ratio: '16:9',
  });

  taskManager.completeTask(parentTaskId, {
    productionProject: {
      id: 'qa-project',
      title: 'Tail Recovery QA',
      ratio: '16:9',
      assets: [],
    },
    assemblyPlan: {
      version: 'qa',
      productionProjectId: 'qa-project',
      sourceTaskId: parentTaskId,
      totalDuration: 12,
      segmentCount: 2,
      status: 'failed',
      segments: [
        {
          id: 'seg-1',
          index: 0,
          shotId: 'shot-1',
          duration: 6,
          prompt: '第一段',
          status: 'failed',
          error: 'segment-tail-frame-missing',
          expectedInputs: {},
          expectedOutputs: {
            taskId: childTaskId,
            providerTaskId: 'provider-1',
            videoUrl: 'https://provider.invalid/seg-1.mp4',
            lastFrameUrl: null,
          },
        },
        {
          id: 'seg-2',
          index: 1,
          shotId: 'shot-2',
          duration: 6,
          prompt: '第二段',
          status: 'queued',
          error: null,
          expectedInputs: {},
          expectedOutputs: {
            taskId: secondChildTaskId,
            providerTaskId: null,
            videoUrl: null,
            lastFrameUrl: null,
          },
        },
      ],
      recovery: { resumeFromSegmentIndex: 0 },
      nextAction: 'recover tail frame',
    },
    assemblyQueue: {
      version: 'qa',
      sourceTaskId: parentTaskId,
      status: 'failed',
      queuedSegmentCount: 2,
      childTaskIds: [childTaskId, secondChildTaskId],
    },
  } as any);

  taskManager.updateTask(childTaskId, {
    status: 'failed',
    progress: 45,
    error: 'segment-tail-frame-missing',
    result: {
      videoUrl: 'https://provider.invalid/seg-1.mp4',
      providerTaskId: 'provider-1',
    },
  });

  const recovery = await recoverProductionSegmentTailFrame({ childTaskId });
  const recoveredChild = taskManager.getTaskFresh(childTaskId);
  const recoveredChildResult = recoveredChild?.result as any;
  const recoveredParent = taskManager.getTaskFresh(parentTaskId);
  const assemblyPlan = recoveredParent?.result?.assemblyPlan as any;
  const firstSegment = assemblyPlan?.segments?.[0];
  const secondSegment = assemblyPlan?.segments?.[1];

  assert.equal(recovery.success, true, 'tail recovery should succeed');
  assert.equal(recovery.usedRealKey, false, 'tail recovery must not use provider key');
  assert.equal(recovery.incurredCost, false, 'tail recovery must not incur generation cost');
  assert.equal(recoveredChild?.status, 'completed', 'child task should be completed after tail recovery');
  assert(recoveredChildResult?.lastFrameUrl?.startsWith('data:image/jpeg;base64,'), 'child lastFrameUrl should use base64 fallback');
  assert.equal(recoveredChildResult?.lastFrameExtraction?.uploaded, true, 'tail extraction should be transferable');
  assert.equal(firstSegment?.status, 'completed', 'parent first segment should be completed');
  assert.equal(firstSegment?.expectedOutputs?.lastFrameUrl, recoveredChildResult?.lastFrameUrl, 'parent segment should write back lastFrameUrl');
  assert.equal(secondSegment?.expectedInputs?.firstFrameUrl, recoveredChildResult?.lastFrameUrl, 'next segment should receive firstFrameUrl');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    tasksFile: process.env.HUIYING_TASKS_FILE,
    checks: [
      'partial-video-tail-frame-recovered-without-regeneration',
      'recovered-child-completed',
      'parent-segment-last-frame-writeback',
      'next-segment-first-frame-writeback',
    ],
    uploadSource: recoveredChildResult?.lastFrameExtraction?.uploadSource,
  }, null, 2));
}

main()
  .finally(async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
