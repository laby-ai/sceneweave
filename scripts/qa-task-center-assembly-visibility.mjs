import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '月球放映室里，制片人用六个镜头修复一段被宇宙噪声打断的短片。';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensureTaskDir() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
}

function acquireLock() {
  ensureTaskDir();
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-task-center-assembly-visibility',
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

async function waitForTaskStatus(taskId, status, timeoutMs = 12000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const detail = await fetchJson(`${baseUrl}/api/tasks/${taskId}`);
    if (detail.res.ok) {
      last = detail.json.task;
      if (last?.status === status) return last;
    }
    await sleep(500);
  }
  throw new Error(`task ${taskId} did not reach ${status}; last=${JSON.stringify(last)?.slice(0, 300)}`);
}

let lockAcquired = false;
let originalExists = false;
let originalContent = null;
let parentTaskId = null;
let childTaskIds = [];
const results = [];

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const director = await fetchJson(`${baseUrl}/api/smart/director-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: 60,
      segmentDuration: 10,
      style: '黑色宇宙短剧',
      sceneType: 'drama',
      ratio: '16:9',
    }),
  });
  assert(director.res.ok, `director-chain failed: ${director.res.status}`);
  parentTaskId = director.json.taskId;

  await sleep(1200);
  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: parentTaskId, persist: true }),
  });
  assert(assembly.res.ok, `assembly-plan failed: ${assembly.res.status}`);

  await sleep(1200);
  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: parentTaskId }),
  });
  assert(queue.res.ok, `assembly queue failed: ${queue.res.status}`);
  childTaskIds = queue.json.childTaskIds;

  const failedStart = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': 'https://ark.cn-beijing.volces.com/api/v3',
      'x-yh-api-key': 'dummy-key',
    },
    body: JSON.stringify({
      childTaskId: childTaskIds[0],
      dryRun: false,
      allowRealCost: true,
    }),
  });
  assert(failedStart.res.ok, `segment start submit failed: ${failedStart.res.status}`);
  await waitForTaskStatus(childTaskIds[0], 'failed');

  const parentDetail = await fetchJson(`${baseUrl}/api/tasks/${parentTaskId}`);
  assert(parentDetail.res.ok, `parent detail failed: ${parentDetail.res.status}`);
  const result = parentDetail.json.task?.result;
  assert(result?.assemblyQueue?.version === 'yh-assembly-queue-v1', 'assemblyQueue missing');
  assert(result.assemblyQueue.childTaskIds.length === 6, 'assemblyQueue child ids missing');
  assert(result?.assemblyPlan?.segments?.length === 6, 'assemblyPlan segments missing');
  const failedSegment = result.assemblyPlan.segments.find(segment => segment.status === 'failed');
  assert(failedSegment?.expectedOutputs?.taskId === childTaskIds[0], 'failed segment child task id mismatch');
  assert(String(failedSegment?.error || '').includes('BYOK 视频调用缺少视频模型'), 'failed segment readable error missing');
  assert(result.assemblyPlan.nextAction, 'assembly nextAction missing');

  results.push({
    check: 'task-center-assembly-fields',
    ok: true,
    parentTaskId,
    segmentCount: result.assemblyPlan.segments.length,
    childTaskCount: result.assemblyQueue.childTaskIds.length,
    failedSegmentIndex: failedSegment.index,
    error: failedSegment.error,
  });
} finally {
  if (lockAcquired) {
    if (originalExists) {
      fs.writeFileSync(tasksFile, originalContent, 'utf8');
    } else if (fs.existsSync(tasksFile)) {
      fs.rmSync(tasksFile, { force: true });
    }
    releaseLock();
  }
  await sleep(1200);
}

const restored = await fetchJson(`${baseUrl}/api/tasks?limit=100`);
const leakedIds = new Set([parentTaskId, ...childTaskIds].filter(Boolean));
const leaked = (restored.json.tasks || []).filter(task => leakedIds.has(task.id));
assert(leaked.length === 0, `task center visibility probe leak detected: ${leaked.map(task => task.id).join(', ')}`);

results.push({
  check: 'probe-restore',
  ok: true,
  leakedProbeTasks: 0,
  totalAfterRestore: restored.json.total,
});

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  tasksFile,
  usedRealKey: false,
  incurredCost: false,
  results,
}, null, 2));
