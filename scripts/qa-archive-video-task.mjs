import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-archive-video-task',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`归档 QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
}

function restoreTasksFile(content) {
  const tempFile = `${tasksFile}.archive-video-task.restore.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, content, 'utf8');
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.renameSync(tempFile, tasksFile);
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 80);
    }
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

async function findCandidateTaskId() {
  if (process.env.HUIYING_ARCHIVE_TASK_ID) return process.env.HUIYING_ARCHIVE_TASK_ID;
  const { res, json } = await fetchJson(`${baseUrl}/api/tasks?limit=80`);
  assert(res.ok, `GET /api/tasks failed: ${res.status}`);
  const task = (json.tasks || []).find(item =>
    item.type === 'video'
    && item.status === 'completed'
    && item.result?.videoUrl
    && Array.isArray(item.result?.segments)
    && item.result.segments.filter(segment => segment.videoUrl).length >= 2
  );
  assert(task, 'no completed segmented video task found for archive QA');
  return task.id;
}

acquireLock();
let originalExists = false;
let originalContent = null;
try {
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const taskId = await findCandidateTaskId();
  const before = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
  assert(before.res.ok, `GET candidate task failed: ${before.res.status}`);
  const beforeSegmentCount = before.json.task.result.segments.filter(segment => segment.videoUrl).length;

  const archive = await fetchJson(`${baseUrl}/api/production/archive-video-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  });
  assert(archive.res.ok, `archive-video-task failed: ${archive.res.status} ${JSON.stringify(archive.json)}`);
  assert(archive.json.success === true, 'archive success mismatch');
  assert(archive.json.usedRealKey === false, 'archive should not call real model');
  assert(archive.json.incurredCost === false, 'archive should not incur cost');
  assert(archive.json.segmentAssetCount === beforeSegmentCount, 'videoSegment asset count mismatch');
  assert(archive.json.finalVideoAssetCount === 1, 'finalVideo asset count mismatch');
  assert(archive.json.task?.result?.productionProject, 'archived task missing productionProject');
  assert(archive.json.task?.result?.assemblyPlan, 'archived task missing assemblyPlan');
  assert(archive.json.task.result.productionProject.assets.filter(asset => asset.kind === 'videoSegment').length === beforeSegmentCount, 'productionProject videoSegment count mismatch');
  assert(archive.json.task.result.productionProject.assets.filter(asset => asset.kind === 'finalVideo').length === 1, 'productionProject finalVideo missing');
  assert(archive.json.task.result.assemblyPlan.segments.every(segment => segment.status === 'completed' && segment.expectedOutputs?.videoUrl), 'assemblyPlan segments not completed with videoUrl');

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(taskId)}`);
  assert(canvas.res.ok, `production canvas failed: ${canvas.res.status}`);
  const canvasText = JSON.stringify(canvas.json);
  assert(canvasText.includes('videoSegment'), 'canvas response missing videoSegment node');
  assert(canvasText.includes('finalVideo'), 'canvas response missing finalVideo node');

  const cases = await fetchJson(`${baseUrl}/api/production/case-assets?limit=10`);
  assert(cases.res.ok, `case assets failed: ${cases.res.status}`);
  assert(Array.isArray(cases.json.cases), 'case assets response missing cases');
  assert(cases.json.cases.some(item => item.source === 'productionProject.assets.finalVideo'), 'case assets missing finalVideo source');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    taskId,
    segmentAssetCount: archive.json.segmentAssetCount,
    finalVideoAssetCount: archive.json.finalVideoAssetCount,
    assemblyStatus: archive.json.assemblyStatus,
    canvasHasVideoSegment: true,
    canvasHasFinalVideo: true,
    caseAssetsHasFinalVideo: true,
    usedRealKey: false,
    incurredCost: false,
  }, null, 2));
} finally {
  if (originalExists) {
    restoreTasksFile(originalContent);
  } else if (fs.existsSync(tasksFile)) {
    fs.rmSync(tasksFile, { force: true });
  }
  releaseLock();
}
