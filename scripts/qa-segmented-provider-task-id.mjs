#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const { buildPartialSegmentResult } = await import('../src/lib/segmented-video-task-result.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sourcePath = path.resolve('src/lib/generate-segmented-video.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

const result = buildPartialSegmentResult([
  {
    segmentIndex: 0,
    status: 'running',
    prompt: '第1段提交后仍在轮询',
    duration: 10,
    providerTaskId: 'provider-running-1',
  },
  {
    segmentIndex: 1,
    status: 'completed',
    prompt: '第2段完成',
    duration: 10,
    providerTaskId: 'provider-completed-2',
    videoUrl: 'https://example.invalid/segment-2.mp4',
    lastFrameUrl: 'https://example.invalid/segment-2-last.png',
  },
  {
    segmentIndex: 2,
    status: 'failed',
    prompt: '第3段提交后轮询超时',
    duration: 10,
    providerTaskId: 'provider-failed-3',
    error: 'BYOK 视频生成超时',
  },
]);

const segments = result.segments || [];
const plannedResult = buildPartialSegmentResult(Array.from({ length: 6 }, (_, segmentIndex) => ({
  segmentIndex,
  status: segmentIndex < 2 ? 'completed' : segmentIndex === 2 ? 'failed' : 'pending',
  prompt: `第${segmentIndex + 1}段计划快照`,
  duration: 10,
  providerTaskId: segmentIndex === 2 ? 'provider-failed-3' : undefined,
  videoUrl: segmentIndex < 2 ? `https://example.invalid/segment-${segmentIndex}.mp4` : undefined,
  lastFrameUrl: segmentIndex < 2 ? `https://example.invalid/segment-${segmentIndex}-last.png` : undefined,
  error: segmentIndex === 2 ? 'BYOK 视频生成超时' : undefined,
})));
const plannedSegments = plannedResult.segments || [];

assert(segments[0]?.providerTaskId === 'provider-running-1', 'running segment must preserve providerTaskId');
assert(segments[1]?.providerTaskId === 'provider-completed-2', 'completed segment must preserve providerTaskId');
assert(segments[2]?.providerTaskId === 'provider-failed-3', 'failed segment must preserve providerTaskId');
assert(Array.isArray(result.failedSegments) && result.failedSegments.includes(2), 'failed segment index must be retained');
assert(plannedResult.segmentCount === 6, 'planned partial result must preserve total planned segment count');
assert(plannedResult.successSegmentCount === 2, 'planned partial result should count only completed segments');
assert(plannedSegments.length === 6, 'planned partial result must retain future pending segment snapshots');
assert(plannedSegments.slice(3).every(segment => segment.status === 'pending' && segment.prompt), 'future segment prompts must remain recoverable');

assert(/let\s+activeProviderTaskId/.test(source), 'generateSegmentedVideo must track active provider task id');
assert(/activeProviderTaskId\s*=\s*submitResponse\.taskId/.test(source), 'provider task id must be captured immediately after submit');
assert(/providerTaskId:\s*activeProviderTaskId/.test(source), 'segment snapshots must include providerTaskId');
assert(/status:\s*'failed'[\s\S]{0,220}error:\s*errorMessage/.test(source), 'failed segment update must be emitted with error');
assert(/plannedSegments/.test(source), 'generateSegmentedVideo must pre-persist planned segment snapshots');
assert(/status:\s*'pending'/.test(source), 'planned segment snapshots must use pending status');

console.log(JSON.stringify({
  ok: true,
  checked: 'segmented providerTaskId persistence',
  preservedStatuses: segments.map(segment => ({
    index: segment.index,
    status: segment.status,
    providerTaskIdPresent: Boolean(segment.providerTaskId),
  })),
  sourceChecks: {
    activeProviderTaskId: true,
    captureAfterSubmit: true,
    snapshotProviderTaskId: true,
    failedUpdateError: true,
    plannedSegmentSnapshots: true,
  },
  plannedSnapshotChecks: {
    segmentCount: plannedResult.segmentCount,
    successSegmentCount: plannedResult.successSegmentCount,
    retainedSnapshots: plannedSegments.length,
    futurePendingCount: plannedSegments.filter(segment => segment.status === 'pending').length,
  },
}, null, 2));
