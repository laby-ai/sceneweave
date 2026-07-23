import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { TaskResult } from '../src/lib/task-manager';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-vimax-jit-retry-'));
process.env.HUIYING_TASKS_FILE = path.join(qaDir, 'tasks.json');

async function main() {
  const taskManager = await import('../src/lib/task-manager');
  const readiness = await import(
    '../src/lib/skills/vimax-short-drama/vimax-production-segment-readiness'
  );
  const owner = { tenantId: 'tenant-jit', memberId: 'member-jit' };
  const parentTaskId = taskManager.createTask('storyboard', {
    workflow: 'smart-director-chain',
  }, owner);
  const childTaskIds = [0, 1, 2].map(index => taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: index,
    assemblySegmentId: `segment-${index + 1}`,
    productionProjectId: 'production-jit',
    shotId: `shot-${index + 1}`,
  }, owner));

  taskManager.startTask(childTaskIds[0]);
  taskManager.completeTask(childTaskIds[0], {
    videoUrl: '/api/final-videos/segment-1',
  });
  taskManager.failTask(childTaskIds[1], '任务长时间未开始，已自动失效');
  taskManager.failTask(childTaskIds[2], '任务长时间未开始，已自动失效');
  taskManager.updateTask(parentTaskId, {
    status: 'completed',
    progress: 100,
    result: {
      productionProject: {
        id: 'production-jit',
        title: 'JIT retry QA',
        prompt: 'Three sequential shots.',
        style: 'cinematic',
        ratio: '16:9',
        sceneType: 'documentary',
        duration: 15,
      },
      assemblyPlan: {
        version: 'qa',
        productionProjectId: 'production-jit',
        sourceTaskId: parentTaskId,
        totalDuration: 15,
        segmentCount: 3,
        status: 'failed',
        segments: childTaskIds.map((childTaskId, index) => ({
          id: `segment-${index + 1}`,
          index,
          shotId: `shot-${index + 1}`,
          duration: 5,
          prompt: `Shot ${index + 1}`,
          status: index === 0 ? 'completed' : 'failed',
          error: index === 0 ? null : '任务长时间未开始，已自动失效',
          expectedInputs: {
            firstFrameUrl: index === 0 ? '/api/reference-images/shot-1' : null,
            previousLastFrameUrl: index === 0 ? null : `/api/final-frames/segment-${index}`,
            sourceSegmentId: index === 0 ? null : `segment-${index}`,
            sourceAssetId: index === 0 ? null : `video-segment-${index}`,
            continuityPrompt: index === 0 ? 'Opening shot.' : 'Continue the previous shot.',
          },
          expectedOutputs: {
            taskId: childTaskId,
            videoUrl: index === 0 ? '/api/final-videos/segment-1' : null,
            lastFrameUrl: index === 0 ? '/api/final-frames/segment-1' : null,
            providerTaskId: index === 0 ? 'provider-completed' : null,
          },
        })),
        recovery: {
          resumeFromSegmentIndex: 1,
        },
      },
      assemblyQueue: {
        version: 'qa',
        sourceTaskId: parentTaskId,
        status: 'failed',
        queuedSegmentCount: 3,
        childTaskIds,
        updatedAt: new Date(0).toISOString(),
      },
    } as unknown as TaskResult,
  });

  const completed = readiness.prepareVimaxProductionSegmentForStart({
    owner,
    parentTaskId,
    childTaskId: childTaskIds[0],
    segmentIndex: 0,
  });
  assert(completed.status === 'completed', 'completed segment must be reused without retry');
  assert(completed.config.retryCount === undefined, 'completed segment retry count must not change');

  const recovered = readiness.prepareVimaxProductionSegmentForStart({
    owner,
    parentTaskId,
    childTaskId: childTaskIds[1],
    segmentIndex: 1,
  });
  assert(recovered.status === 'pending', 'expired segment must be reset when its turn starts');
  assert(recovered.config.retryCount === 1, 'expired segment retry count must increment once');

  const untouched = taskManager.getTaskForOwner(childTaskIds[2], owner);
  assert(untouched?.status === 'failed', 'later segment must stay untouched until its own turn');
  assert(untouched.config.retryCount === undefined, 'later segment must not be retried early');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'completed-segment-reused',
      'expired-segment-reset-just-in-time',
      'later-segment-left-untouched',
    ],
  }, null, 2));
}

main()
  .finally(() => {
    fs.rmSync(qaDir, { recursive: true, force: true });
  });
