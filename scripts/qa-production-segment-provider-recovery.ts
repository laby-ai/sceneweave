import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-provider-recovery-'));
process.env.HUIYING_TASKS_FILE = path.join(qaDir, 'tasks.json');
process.env.HUIYING_DISABLE_BASE64_FRAME_HANDOFF = '';

async function main() {
  const taskManager = await import('../src/lib/task-manager');
  const { recoverProductionSegmentProviderTask } = await import('../src/lib/production-segment-provider-recovery');

  const parentTaskId = taskManager.createTask('storyboard', { prompt: 'provider recovery parent' });
  const firstChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 0,
  });
  const secondChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 1,
  });

  const assemblyPlan = {
    version: 'qa',
    productionProjectId: 'provider-recovery-project',
    sourceTaskId: parentTaskId,
    totalDuration: 12,
    segmentCount: 2,
    status: 'failed',
    segments: [
      {
        id: 'segment-1',
        index: 0,
        shotId: 'shot-1',
        duration: 6,
        prompt: 'first segment',
        status: 'failed',
        error: 'timeout',
        expectedInputs: { firstFrameUrl: null },
        expectedOutputs: {
          taskId: firstChildTaskId,
          videoUrl: null,
          lastFrameUrl: null,
          providerTaskId: 'provider-recoverable-1',
        },
      },
      {
        id: 'segment-2',
        index: 1,
        shotId: 'shot-2',
        duration: 6,
        prompt: 'second segment',
        status: 'skipped',
        error: 'depends on segment 1',
        expectedInputs: {
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceSegmentId: 'segment-1',
        },
        expectedOutputs: {
          taskId: secondChildTaskId,
          videoUrl: null,
          lastFrameUrl: null,
          providerTaskId: null,
        },
      },
    ],
    recovery: { resumeFromSegmentIndex: 0 },
    nextAction: 'recover provider task',
  };

  taskManager.updateTask(parentTaskId, {
    status: 'failed',
    result: { assemblyPlan },
  });
  taskManager.updateTask(firstChildTaskId, {
    status: 'failed',
    error: 'BYOK video timeout',
    result: {
      providerTaskId: 'provider-recoverable-1',
      segments: [{
        index: 0,
        taskId: firstChildTaskId,
        status: 'failed',
        providerTaskId: 'provider-recoverable-1',
        error: 'BYOK video timeout',
      }],
    },
  });

  const connection = {
    provider: 'ark-plan' as const,
    apiBase: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: 'ark-redacted-local-test',
    videoModel: 'doubao-seedance-1-5-pro-251215',
  };
  const recoveredVideoUrl = 'https://example.invalid/recovered-provider-video.mp4';
  const recoveredLastFrameUrl = 'https://example.invalid/recovered-provider-tail.jpg';

  const result = await recoverProductionSegmentProviderTask(
    { childTaskId: firstChildTaskId },
    connection,
    {
      getVideoStatus: async () => ({
        status: 'succeeded',
        videoUrl: recoveredVideoUrl,
        lastFrameUrl: recoveredLastFrameUrl,
        rawStatus: 'succeeded',
      }),
    }
  );

  const recoveredChild = taskManager.getTaskFresh(firstChildTaskId);
  const recoveredParent = taskManager.getTaskFresh(parentTaskId);
  const recoveredPlan = recoveredParent?.result?.assemblyPlan as typeof assemblyPlan | undefined;
  const firstSegment = recoveredPlan?.segments[0];
  const secondSegment = recoveredPlan?.segments[1];

  assert.equal(result.success, true, 'provider recovery should complete');
  assert.equal(result.incurredCost, false, 'provider status recovery must not submit a new generation');
  assert.equal(recoveredChild?.status, 'completed', 'child task should become completed');
  assert.equal(recoveredChild?.result?.videoUrl, recoveredVideoUrl, 'child should write provider videoUrl');
  assert.equal(firstSegment?.status, 'completed', 'parent segment should become completed');
  assert.equal(firstSegment?.expectedOutputs?.providerTaskId, 'provider-recoverable-1', 'providerTaskId should be preserved');
  assert.equal(firstSegment?.expectedOutputs?.videoUrl, recoveredVideoUrl, 'parent should write provider videoUrl');
  assert.equal(firstSegment?.expectedOutputs?.lastFrameUrl, recoveredLastFrameUrl, 'parent should write provider tail frame');
  assert.equal(secondSegment?.expectedInputs?.firstFrameUrl, recoveredLastFrameUrl, 'next segment should receive firstFrameUrl');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'provider-timeout-child-recovers-from-providerTaskId',
      'no-new-generation-submit',
      'parent-segment-video-and-tail-writeback',
      'next-segment-first-frame-updated',
    ],
    parentTaskId,
    childTaskId: firstChildTaskId,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
