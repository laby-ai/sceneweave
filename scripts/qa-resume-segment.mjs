import fs from 'node:fs';
import path from 'node:path';

const {
  createTask,
  failTask,
  startTask,
  updateTask,
} = await import('../src/lib/task-manager.ts');
const { buildPartialSegmentResult } = await import('../src/lib/segmented-video-task-result.ts');

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;
let originalExists = false;
let originalContent = null;
let taskId = null;

function ensureTaskDir() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
}

function acquireLock() {
  ensureTaskDir();
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-resume-segment',
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { response, json };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonWithTaskVisibilityRetry(url, options) {
  let lastResult;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    lastResult = await fetchJson(url, options);
    if (lastResult.response.status !== 404 || lastResult.json?.error !== '任务不存在') {
      return lastResult;
    }
    await sleep(250 * attempt);
  }
  return lastResult;
}

function restoreTasksFile() {
  if (originalExists && originalContent !== null) {
    const tempFile = `${tasksFile}.resume-segment.restore.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, originalContent, 'utf8');
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        fs.renameSync(tempFile, tasksFile);
        return;
      } catch (error) {
        if (attempt === 10) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 80);
      }
    }
  } else if (fs.existsSync(tasksFile)) {
    fs.rmSync(tasksFile, { force: true });
  }
}

async function cleanupProbeTask() {
  if (!taskId) return;
  try {
    await fetchJson(`${baseUrl}/api/tasks`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: [taskId] }),
    });
  } catch {
    // Best effort only; file restore below is still the authoritative no-leak check.
  }
}

const results = [];

try {
  acquireLock();
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  taskId = createTask('video', {
    prompt: 'Q6 resume segment probe',
    duration: '60',
    ratio: '16:9',
    videoModel: 'qa-video-model',
    isSegmented: true,
    segmentCount: 6,
  });
  startTask(taskId);
  updateTask(taskId, {
    result: buildPartialSegmentResult([
      {
        segmentIndex: 0,
        status: 'completed',
        prompt: '第1段：失业剪辑师进入凌晨便利店。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: 'https://example.invalid/huiying-segment-0.mp4',
        lastFrameUrl: 'https://example.invalid/huiying-segment-0-last-frame.jpg',
      },
      {
        segmentIndex: 1,
        status: 'completed',
        prompt: '第2段：旧录像带播放明天失败的面试。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: 'https://example.invalid/huiying-segment-1.mp4',
        lastFrameUrl: 'https://example.invalid/huiying-segment-1-last-frame.jpg',
      },
      {
        segmentIndex: 2,
        status: 'failed',
        prompt: '第3段：主角改写录像带里的失败结局。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        error: '供应商限流，等待只补该片段。',
      },
    ]),
  });
  failTask(taskId, '第3段失败，已成功片段保留。');

  const dryRun = await fetchJsonWithTaskVisibilityRetry(`${baseUrl}/api/tasks/${taskId}/resume-segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(dryRun.response.ok, `dry-run resume failed: ${dryRun.response.status}`);
  assert(dryRun.json.success === true, 'dry-run success mismatch');
  assert(dryRun.json.dryRun === true, 'dry-run flag mismatch');
  assert(dryRun.json.usedRealKey === false, 'dry-run should not use real key');
  assert(dryRun.json.incurredCost === false, 'dry-run should not incur cost');
  assert(dryRun.json.segmentIndex === 2, 'dry-run should pick failed segment');
  assert(dryRun.json.promptReady === true, 'failed segment prompt should be ready');
  assert(dryRun.json.successSegmentCount === 2, 'success segment count mismatch');
  assert(dryRun.json.segmentCount === 6, 'resume summary must preserve original expected segment count');
  assert(dryRun.json.snapshotSegmentCount === 6, 'resume route must rebuild missing future segment snapshots');
  assert(dryRun.json.missingSnapshotCount === 0, 'resume route should have no missing snapshots after plan rebuild');

  results.push({
    check: 'dry-run-locates-failed-segment',
    ok: true,
    taskId,
    segmentIndex: dryRun.json.segmentIndex,
    successSegmentCount: dryRun.json.successSegmentCount,
    segmentCount: dryRun.json.segmentCount,
    snapshotSegmentCount: dryRun.json.snapshotSegmentCount,
    missingSnapshotCount: dryRun.json.missingSnapshotCount,
  });

  const completed = await fetchJson(`${baseUrl}/api/tasks/${taskId}/resume-segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segmentIndex: 0 }),
  });
  assert(completed.response.status === 409, `completed segment should return 409, got ${completed.response.status}`);
  assert(completed.json.usedRealKey === false, 'completed segment probe should not use real key');

  results.push({
    check: 'completed-segment-not-regenerated',
    ok: true,
    status: completed.response.status,
  });

  const blockedReal = await fetchJson(`${baseUrl}/api/tasks/${taskId}/resume-segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun: false }),
  });
  assert(blockedReal.response.status === 400, `missing cost guard should return 400, got ${blockedReal.response.status}`);
  assert(blockedReal.json.usedRealKey === false, 'blocked real restore should not use real key');
  assert(blockedReal.json.incurredCost === false, 'blocked real restore should not incur cost');

  results.push({
    check: 'real-restore-requires-explicit-cost-guard',
    ok: true,
    status: blockedReal.response.status,
  });
} finally {
  await cleanupProbeTask();
  restoreTasksFile();
  releaseLock();
}

const restoredTasks = fs.existsSync(tasksFile)
  ? JSON.parse(fs.readFileSync(tasksFile, 'utf8'))
  : [];
const leaked = restoredTasks.filter(task => task.id === taskId);
assert(leaked.length === 0, `resume segment probe task leak detected in tasks file: ${leaked.map(task => task.id).join(', ')}`);

results.push({
  check: 'probe-restore',
  ok: true,
  leakedProbeTasks: 0,
  totalAfterRestore: restoredTasks.length,
});

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  tasksFile,
  usedRealKey: false,
  incurredCost: false,
  results,
}, null, 2));
