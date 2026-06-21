import { strict as assert } from 'node:assert';
import { deriveProductionSegmentUiState } from '../src/lib/production-segment-ui';

const failed = deriveProductionSegmentUiState({
  status: 'failed',
  error: 'BYOK 视频调用缺少视频模型',
  expectedOutputs: {
    taskId: 'child-task-1234567890',
    videoUrl: null,
    lastFrameUrl: null,
    providerTaskId: null,
  },
});

assert.equal(failed.statusLabel, 'failed');
assert.equal(failed.canRetry, true);
assert.equal(failed.canCopyTaskId, true);
assert.equal(failed.canOpenVideo, false);
assert.equal(failed.errorText, 'BYOK 视频调用缺少视频模型');
assert.match(failed.actionHint, /重新排队|失败/);

const completed = deriveProductionSegmentUiState({
  status: 'completed',
  error: null,
  expectedOutputs: {
    taskId: 'child-task-abcdefgh',
    videoUrl: 'https://example.invalid/video.mp4',
    lastFrameUrl: 'https://example.invalid/last.jpg',
    providerTaskId: 'provider-job-1234567890',
  },
});

assert.equal(completed.statusLabel, 'completed');
assert.equal(completed.canRetry, false);
assert.equal(completed.canOpenVideo, true);
assert.equal(completed.canOpenLastFrame, true);
assert.equal(completed.providerLabel, 'provider provider-j');
assert.equal(completed.taskLabel, 'task child-ta');

const queued = deriveProductionSegmentUiState({
  status: 'queued',
  error: null,
  expectedOutputs: {
    taskId: null,
    videoUrl: null,
    lastFrameUrl: null,
    providerTaskId: null,
  },
});

assert.equal(queued.statusLabel, 'queued');
assert.equal(queued.canRetry, false);
assert.equal(queued.canCopyTaskId, false);
assert.match(queued.actionHint, /等待/);

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'failed segment exposes retry without video asset',
    'completed segment exposes reusable video and tail frame actions',
    'queued segment stays passive',
  ],
}, null, 2));
