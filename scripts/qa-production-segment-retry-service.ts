import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-segment-retry-service-'));
const tasksFile = path.join(qaDir, 'tasks.json');
process.env.HUIYING_TASKS_FILE = tasksFile;

async function main() {
  const taskManager = await import('../src/lib/task-manager');
  const retryService = await import('../src/lib/production-segment-retry');

  const parentTaskId = taskManager.createTask('storyboard', {
    workflow: 'smart-director-chain',
    prompt: 'A producer retries a failed bridge shot.',
  });

  const childTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 1,
    assemblySegmentId: 'segment-2',
    productionProjectId: 'production-qa',
    shotId: 'shot-2',
  });
  const downstreamChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 2,
    assemblySegmentId: 'segment-3',
    productionProjectId: 'production-qa',
    shotId: 'shot-3',
  });

  const parentUpdated = taskManager.updateTask(parentTaskId, {
    status: 'completed',
    progress: 100,
    result: {
      productionProject: {
        id: 'production-qa',
        title: 'QA retry production',
        prompt: 'A compact retry service QA.',
        style: 'cinematic',
        ratio: '16:9',
        sceneType: 'drama',
        duration: 20,
      },
      assemblyPlan: {
        version: 'qa',
        productionProjectId: 'production-qa',
        sourceTaskId: parentTaskId,
        totalDuration: 20,
        segmentCount: 2,
        status: 'failed',
        segments: [
          {
            id: 'segment-1',
            index: 0,
            shotId: 'shot-1',
            duration: 10,
            prompt: 'Opening shot',
            status: 'completed',
            expectedInputs: {
              firstFrameUrl: null,
              previousLastFrameUrl: null,
              sourceSegmentId: null,
              sourceAssetId: null,
              continuityPrompt: 'Opening shot has no previous segment dependency.',
            },
            expectedOutputs: {
              taskId: 'completed-child',
              videoUrl: '/generated/videos/qa-opening.mp4',
              lastFrameUrl: '/generated/frames/qa-opening-tail.jpg',
              providerTaskId: 'provider-ok',
            },
          },
          {
            id: 'segment-2',
            index: 1,
            shotId: 'shot-2',
            duration: 10,
            prompt: 'Retry bridge shot',
            status: 'failed',
            error: 'provider timeout',
            expectedInputs: {
              firstFrameUrl: '/generated/frames/qa-opening-tail.jpg',
              previousLastFrameUrl: '/generated/frames/qa-opening-tail.jpg',
              sourceSegmentId: 'segment-1',
              sourceAssetId: 'video-segment-1',
              continuityPrompt: 'Use segment 1 last frame before retry.',
            },
            expectedOutputs: {
              taskId: childTaskId,
              videoUrl: null,
              lastFrameUrl: null,
              providerTaskId: 'provider-failed',
            },
          },
          {
            id: 'segment-3',
            index: 2,
            shotId: 'shot-3',
            duration: 10,
            prompt: 'Downstream bridge shot',
            status: 'skipped',
            error: '依赖第 2 段失败，已停止级联启动；先重试上一段并写回 lastFrameUrl。',
            expectedInputs: {
              firstFrameUrl: null,
              previousLastFrameUrl: null,
              sourceSegmentId: 'segment-2',
              sourceAssetId: null,
              continuityPrompt: '等待第 2 段重试完成并写回 lastFrameUrl 后再启动。',
            },
            expectedOutputs: {
              taskId: downstreamChildTaskId,
              videoUrl: null,
              lastFrameUrl: null,
              providerTaskId: null,
            },
          },
        ],
        recovery: {
          resumeFromSegmentIndex: 1,
        },
      },
      assemblyQueue: {
        version: 'qa',
        sourceTaskId: parentTaskId,
        status: 'failed',
        queuedSegmentCount: 3,
        childTaskIds: [childTaskId, downstreamChildTaskId],
        updatedAt: new Date(0).toISOString(),
      },
    } as any,
  });
  assert(parentUpdated, 'parent task should be updated with production result');

  taskManager.failTask(childTaskId, 'provider timeout');

  const retry = retryService.retryProductionAssemblySegment({
    parentTaskId,
    segmentIndex: 1,
  });

  assert(retry.success === true, 'retry should succeed');
  assert(retry.usedRealKey === false, 'retry must not use a real key');
  assert(retry.incurredCost === false, 'retry must not incur cost');
  assert(retry.parentTaskId === parentTaskId, 'retry parentTaskId mismatch');
  assert(retry.childTaskId === childTaskId, 'retry should reuse failed child');
  assert(retry.segmentIndex === 1, 'retry segmentIndex mismatch');
  assert(retry.childStatus === 'pending', 'retry child should be pending');
  assert(retry.retryCount === 1, 'retry count should increment');

  const childAfterRetry = taskManager.getTaskFresh(childTaskId);
  assert(childAfterRetry?.status === 'pending', 'child task status should be pending after retry');
  assert(childAfterRetry.config.retryCount === 1, 'child task retryCount should be persisted');
  assert(!childAfterRetry.error, 'child task error should be cleared');

  const parentAfterRetry = taskManager.getTaskFresh(parentTaskId);
  const retriedSegment = parentAfterRetry?.result?.assemblyPlan?.segments?.find(segment => segment.index === 1);
  const downstreamSegment = parentAfterRetry?.result?.assemblyPlan?.segments?.find(segment => segment.index === 2);
  assert(retriedSegment?.status === 'queued', 'parent segment should be queued after retry');
  assert(retriedSegment.expectedOutputs?.taskId === childTaskId, 'segment should keep child task id');
  assert(retriedSegment.expectedOutputs?.videoUrl === null, 'segment videoUrl should stay null');
  assert(retriedSegment.expectedOutputs?.lastFrameUrl === null, 'segment lastFrameUrl should stay null');
  assert(retriedSegment.expectedOutputs?.providerTaskId === null, 'segment providerTaskId should be cleared');
  assert(downstreamSegment?.status === 'queued', 'retry should release cascade-skipped downstream segment to queued');
  assert(downstreamSegment.error === null, 'retry should clear downstream cascade-skip error');
  assert(downstreamSegment.expectedOutputs?.videoUrl === null, 'downstream videoUrl should stay null after release');
  assert(downstreamSegment.expectedOutputs?.lastFrameUrl === null, 'downstream lastFrameUrl should stay null after release');
  assert(parentAfterRetry?.result?.assemblyPlan?.status === 'partial', 'assembly status should recompute to partial');
  assert(parentAfterRetry.result.assemblyQueue?.status === 'partial', 'assembly queue status should mirror plan status');
  assert(parentAfterRetry.result.assemblyQueue?.childTaskIds.includes(childTaskId), 'assembly queue should retain child task id');
  assert(parentAfterRetry.result.assemblyQueue?.childTaskIds.includes(downstreamChildTaskId), 'assembly queue should retain downstream child task id');

  console.log(JSON.stringify({
    ok: true,
    tasksFile,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'isolated-huiying-tasks-file',
      'failed-child-retry-to-pending',
      'parent-assembly-segment-requeued',
      'cascade-skipped-downstream-segment-released-to-queued',
      'assembly-queue-status-synced',
    ],
  }, null, 2));
}

main()
  .finally(() => {
    fs.rmSync(qaDir, { recursive: true, force: true });
  });
