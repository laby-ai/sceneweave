import fs from 'node:fs';
import path from 'node:path';
import {
  createTask,
  failTask,
  getTask,
  startTask,
  updateTask,
} from '../src/lib/task-manager';
import { buildPartialSegmentResult } from '../src/lib/segmented-video-task-result';

const tasksFile = path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd: number | null = null;

function ensureTaskDir() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
}

function acquireLock() {
  ensureTaskDir();
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-segmented-video-recovery',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`任务 QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) {
    fs.rmSync(lockFile, { force: true });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

let originalExists = false;
let originalContent: string | null = null;
let taskId: string | null = null;

try {
  acquireLock();
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  taskId = createTask('video', {
    prompt: 'F4 QA segmented recovery probe',
    duration: '61',
    isSegmented: true,
    segmentCount: 2,
  });
  startTask(taskId);

  updateTask(taskId, {
    result: buildPartialSegmentResult([
      {
        segmentIndex: 0,
        status: 'completed',
        prompt: '第1段：失业剪辑师在便利店发现旧录像带。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: 'https://example.invalid/huiying-segment-0.mp4',
        lastFrameUrl: 'https://example.invalid/huiying-segment-0-last-frame.jpg',
      },
      {
        segmentIndex: 1,
        status: 'completed',
        prompt: '第2段：录像带开始播放明天失败的面试。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: 'https://example.invalid/huiying-segment-1.mp4',
      },
      {
        segmentIndex: 2,
        status: 'failed',
        prompt: '第3段：主角试图改掉录像带里的结局。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        error: '供应商限流，等待重试。',
      },
    ]),
  });

  failTask(taskId, '视频片段已生成，但合并成长视频失败。请在任务中心重试，或检查视频合成服务配置。');

  const task = getTask(taskId);
  assert(task, 'recovery task missing');
  assert(task.status === 'failed', `expected failed task, got ${task.status}`);
  assert(String(task.error || '').includes('合并成长视频失败'), 'merge failure error was not preserved');
  assert(task.result?.isPartial === true, 'partial result marker missing');
  assert(task.result?.segmentCount === 3, `partial segment count mismatch: ${task.result?.segmentCount}`);
  assert(task.result?.successSegmentCount === 2, `success segment count mismatch: ${task.result?.successSegmentCount}`);
  assert(Array.isArray(task.result?.failedSegments) && task.result.failedSegments.includes(2), 'failed segment index missing');
  const segments = task.result?.segments as Array<{
    status?: string;
    prompt?: string;
    duration?: number;
    ratio?: string;
    videoModel?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    error?: string;
  }> | undefined;
  assert(Array.isArray(segments) && segments.length === 3, 'partial segments missing');
  assert(segments[0].videoUrl?.includes('segment-0'), 'first segment URL missing');
  assert(segments[0].lastFrameUrl?.includes('last-frame'), 'first segment last frame missing');
  assert(segments[0].prompt?.includes('便利店'), 'first segment prompt snapshot missing');
  assert(segments[0].duration === 10, 'first segment duration snapshot missing');
  assert(segments[0].ratio === '16:9', 'first segment ratio snapshot missing');
  assert(segments[0].videoModel === 'qa-video-model', 'first segment model snapshot missing');
  assert(segments[1].videoUrl?.includes('segment-1'), 'second segment URL missing');
  assert(segments[2].status === 'failed', 'failed segment status missing');
  assert(segments[2].prompt?.includes('改掉录像带'), 'failed segment prompt snapshot missing');
  assert(segments[2].error?.includes('限流'), 'failed segment error snapshot missing');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    taskId,
    status: task.status,
    preservedSegmentCount: segments.length,
    successSegmentCount: task.result?.successSegmentCount,
    failedSegments: task.result?.failedSegments,
    error: task.error,
  }, null, 2));
} finally {
  if (originalExists && originalContent !== null) {
    fs.writeFileSync(tasksFile, originalContent, 'utf8');
  } else if (fs.existsSync(tasksFile)) {
    fs.rmSync(tasksFile, { force: true });
  }
  releaseLock();
}

process.exit(0);
