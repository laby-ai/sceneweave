import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
const probePrefix = 'codex-f4-qa-';
const now = Date.now();
let lockFd = null;

const runningTaskId = `${probePrefix}running-${now}`;
const failedTaskId = `${probePrefix}failed-${now}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      script: 'qa-task-reliability',
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

function readTasks() {
  if (!fs.existsSync(tasksFile)) return [];
  const raw = fs.readFileSync(tasksFile, 'utf8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeTasks(tasks) {
  ensureTaskDir();
  const tempFile = `${tasksFile}.qa.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(tasks, null, 2), 'utf8');
  fs.renameSync(tempFile, tasksFile);
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

async function readFirstSseChunk(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    const reader = res.body?.getReader();
    if (!reader) throw new Error('SSE response body is empty');

    const chunks = [];
    while (chunks.join('').length < 2000) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
      if (chunks.join('').includes('event: task')) break;
    }
    await reader.cancel().catch(() => undefined);
    return { status: res.status, contentType, body: chunks.join('') };
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let lockAcquired = false;
let originalExists = false;
let originalContent = null;
let preservedTasks = [];

const probeTasks = [
  {
    id: runningTaskId,
    type: 'video',
    status: 'running',
    config: {
      prompt: 'F4 QA running probe: long video generation feedback',
      duration: '60s',
      ratio: '16:9',
    },
    progress: 37,
    stage: '镜头生成中',
    message: '正在生成第 1 个镜头，预计还需要一些时间',
    createdAt: now - 90_000,
    startedAt: now - 80_000,
    lastUpdatedAt: now - 1_000,
  },
  {
    id: failedTaskId,
    type: 'video',
    status: 'failed',
    config: {
      prompt: 'F4 QA failed probe: retry keeps original prompt',
      duration: '10s',
      ratio: '16:9',
    },
    progress: 55,
    stage: '生成失败',
    message: '供应商调用失败',
    error: 'API Base 配置错误：请检查设置页的 API Base、API Key 和模型名称',
    createdAt: now - 70_000,
    startedAt: now - 65_000,
    completedAt: now - 10_000,
    lastUpdatedAt: now - 10_000,
  },
];

const results = [];

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;
  const originalTasks = readTasks();
  preservedTasks = originalTasks.filter((task) => !String(task.id || '').startsWith(probePrefix));
  writeTasks([...probeTasks, ...preservedTasks]);
  await sleep(1200);

  const list = await fetchJson(`${baseUrl}/api/tasks?limit=20`);
  assert(list.res.ok, `GET /api/tasks failed: ${list.res.status}`);
  const listedIds = new Set((list.json.tasks || []).map((task) => task.id));
  assert(listedIds.has(runningTaskId), 'running probe missing from task list');
  assert(listedIds.has(failedTaskId), 'failed probe missing from task list');
  results.push({
    check: 'task-list',
    ok: true,
    cleanupCount: list.json.cleanupCount,
    foundProbeTasks: [runningTaskId, failedTaskId],
  });

  const detail = await fetchJson(`${baseUrl}/api/tasks/${runningTaskId}`);
  assert(detail.res.ok, `GET running task failed: ${detail.res.status}`);
  assert(detail.json.task?.status === 'running', 'running task detail status mismatch');
  assert(detail.json.task?.progress === 37, 'running task progress mismatch');
  results.push({
    check: 'running-detail',
    ok: true,
    status: detail.json.task.status,
    progress: detail.json.task.progress,
    stage: detail.json.task.stage,
  });

  const sse = await readFirstSseChunk(`${baseUrl}/api/tasks/${runningTaskId}/events`);
  assert(sse.status === 200, `SSE status mismatch: ${sse.status}`);
  assert(sse.contentType.includes('text/event-stream'), `SSE content-type mismatch: ${sse.contentType}`);
  assert(sse.body.includes('event: task'), 'SSE task event missing');
  assert(sse.body.includes('waitingHint'), 'SSE waitingHint missing');
  assert(sse.body.includes('nextPollMs'), 'SSE nextPollMs missing');
  results.push({
    check: 'sse-waiting-feedback',
    ok: true,
    contentType: sse.contentType,
    sample: sse.body.replace(/\s+/g, ' ').slice(0, 260),
  });

  const cancel = await fetchJson(`${baseUrl}/api/tasks/${runningTaskId}`, { method: 'DELETE' });
  assert(cancel.res.ok, `DELETE running task failed: ${cancel.res.status}`);
  assert(cancel.json.task?.status === 'cancelled', 'cancelled task status mismatch');
  results.push({
    check: 'cancel-running-task',
    ok: true,
    status: cancel.json.task.status,
    message: cancel.json.message,
  });

  const retry = await fetchJson(`${baseUrl}/api/tasks/${failedTaskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'retry' }),
  });
  assert(retry.res.ok, `POST retry task failed: ${retry.res.status}`);
  assert(retry.json.task?.status === 'pending', 'retried task status mismatch');
  assert(retry.json.task?.config?.retryCount === 1, 'retried task retryCount mismatch');
  assert(retry.json.task?.config?.originalTaskId === failedTaskId, 'retried task originalTaskId mismatch');
  results.push({
    check: 'retry-failed-task',
    ok: true,
    status: retry.json.task.status,
    retryCount: retry.json.task.config.retryCount,
    originalTaskId: retry.json.task.config.originalTaskId,
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

const restored = await fetchJson(`${baseUrl}/api/tasks?limit=20`);
const leakedProbeTasks = (restored.json.tasks || []).filter((task) => String(task.id || '').startsWith(probePrefix));
assert(leakedProbeTasks.length === 0, `probe task leak detected: ${leakedProbeTasks.map((task) => task.id).join(', ')}`);
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
