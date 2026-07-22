import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { TaskResult } from '../src/lib/task-manager';

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'huiying-resume-queue-'));
  process.env.HUIYING_TASKS_FILE = path.join(tempDir, 'tasks.json');

  try {
  const tasks = await import('../src/lib/task-manager');
  const { queueProductionAssemblySegments } = await import('../src/lib/production-assembly-queue');
  const owner = { tenantId: 'qa-tenant', memberId: 'qa-member' };
  const parentTaskId = tasks.createTask('storyboard', { prompt: 'resume queue QA' }, owner);
  const childIds = [0, 1, 2, 3].map(index => tasks.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: index,
  }));

  tasks.startTask(childIds[0]);
  tasks.completeTask(childIds[0], {
    videoUrl: 'https://media.invalid/clip-1.mp4',
    lastFrameUrl: 'data:image/jpeg;base64,clip-1-tail',
    providerTaskId: 'provider-1',
  });
  for (const childTaskId of childIds.slice(1)) {
    tasks.updateTask(childTaskId, { status: 'failed', error: 'expired-before-start' });
  }

  const segments = childIds.map((childTaskId, index) => ({
    id: `segment-${index + 1}`,
    index,
    shotId: `shot-${index + 1}`,
    duration: 5,
    prompt: `clip ${index + 1}`,
    status: index === 0 ? 'completed' : 'skipped',
    error: index === 0 ? null : 'upstream-failed',
    dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
    expectedInputs: {
      firstFrameUrl: index === 0 ? 'data:image/jpeg;base64,reference-1' : null,
      previousLastFrameUrl: index === 1 ? 'data:image/jpeg;base64,clip-1-tail' : null,
      sourceSegmentId: index > 0 ? `segment-${index}` : null,
      sourceAssetId: null,
      continuityPrompt: null,
    },
    expectedOutputs: {
      taskId: childTaskId,
      providerTaskId: index === 0 ? 'provider-1' : null,
      videoUrl: index === 0 ? 'https://media.invalid/clip-1.mp4' : null,
      lastFrameUrl: index === 0 ? 'data:image/jpeg;base64,clip-1-tail' : null,
    },
    shotFrameContract: { readiness: { pass: true } },
    storySegmentContract: {},
    retryPolicy: { maxRetries: 2, retryable: true, fallback: 'retry-segment' },
  }));

  tasks.startTask(parentTaskId);
  tasks.completeTask(parentTaskId, {
    productionProject: { id: 'project-1', ratio: '16:9', style: 'cinematic' },
    assemblyPlan: {
      version: 'yh-assembly-plan-v1',
      productionProjectId: 'project-1',
      sourceTaskId: parentTaskId,
      totalDuration: 20,
      segmentCount: 4,
      segmentDurationHint: 5,
      status: 'partial',
      readiness: { pass: true, issues: [], nextAction: 'continue' },
      segments,
      assembly: { strategy: 'ordered-concat', requiresAllSegments: true, outputUrl: null, exportFormats: ['mp4'] },
      recovery: { persistEachSegment: true, resumeFromSegmentIndex: 1, canRetryFailedSegments: true, failurePolicy: 'retry' },
      nextAction: 'resume',
    },
  } as unknown as TaskResult);

  const queued = queueProductionAssemblySegments({ owner, taskId: parentTaskId });
  const persisted = tasks.getTaskForOwner(parentTaskId, owner);
  const plan = persisted?.result?.assemblyPlan as unknown as { status: string; segments: typeof segments };

  assert.equal(queued.queuedSegmentCount, 3, 'only unfinished segments should count as queued');
  assert.equal(plan.status, 'partial', 'a resumed plan with one completed segment must remain partial');
  assert.equal(plan.segments[0].status, 'completed', 'completed segment status must be preserved');
  assert.equal(plan.segments[0].expectedOutputs.videoUrl, 'https://media.invalid/clip-1.mp4');
  assert.equal(tasks.getTaskForOwner(childIds[0], owner)?.status, 'completed');
  assert.deepEqual(plan.segments.slice(1).map(segment => segment.status), ['queued', 'queued', 'queued']);
  assert.deepEqual(childIds.slice(1).map(id => tasks.getTaskForOwner(id, owner)?.status), ['pending', 'pending', 'pending']);

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    checks: ['completed-segment-preserved', 'unfinished-segments-requeued', 'partial-plan-preserved'],
  }, null, 2));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
