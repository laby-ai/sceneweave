import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

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
      script: 'qa-video-byok',
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

async function fetchText(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json, text };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = [];
let lockAcquired = false;
let originalExists = false;
let originalContent = null;
let missingModelTaskId = null;

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const privateBase = await fetchText(`${baseUrl}/api/video/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': 'http://127.0.0.1:9',
      'x-yh-api-key': 'dummy-key',
    },
    body: JSON.stringify({
      prompt: 'F5 QA private api base probe',
      duration: 6,
    }),
  });

  assert(privateBase.res.status === 400, `private API Base status mismatch: ${privateBase.res.status}`);
  assert(
    String(privateBase.json?.error || '').includes('API Base 不允许指向 localhost'),
    'private API Base error message mismatch'
  );
  results.push({
    check: 'private-api-base-blocked',
    ok: true,
    status: privateBase.res.status,
    provider: privateBase.json.provider,
    error: privateBase.json.error,
  });

  const missingModel = await fetchText(`${baseUrl}/api/video/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': 'https://ark.cn-beijing.volces.com/api/v3',
      'x-yh-api-key': 'dummy-key',
    },
    body: JSON.stringify({
      prompt: 'F5 QA Ark BYOK missing video model probe',
      duration: 6,
    }),
  });

  assert(missingModel.res.ok, `missing video model task submit failed: ${missingModel.res.status}`);
  assert(missingModel.json?.success === true, 'missing video model submit success mismatch');
  assert(typeof missingModel.json?.taskId === 'string', 'missing video model taskId missing');
  missingModelTaskId = missingModel.json.taskId;
  results.push({
    check: 'ark-video-task-created-without-real-call',
    ok: true,
    taskId: missingModelTaskId,
    segmentCount: missingModel.json.segmentCount,
    segmentDuration: missingModel.json.segmentDuration,
  });

  await sleep(1200);
  const detail = await fetchText(`${baseUrl}/api/tasks/${missingModelTaskId}`);
  assert(detail.res.ok, `GET missing model task failed: ${detail.res.status}`);
  assert(detail.json?.task?.status === 'failed', 'missing video model task should fail');
  assert(
    String(detail.json?.task?.error || '').includes('BYOK 视频调用缺少视频模型'),
    'missing video model error mismatch'
  );
  assert(!String(detail.json?.task?.error || '').includes('MINIMAX_API_KEY'), 'Ark BYOK path fell back to Minimax');
  results.push({
    check: 'ark-video-missing-model-readable-failure',
    ok: true,
    status: detail.json.task.status,
    progress: detail.json.task.progress,
    stage: detail.json.task.stage,
    error: detail.json.task.error,
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

const restored = await fetchText(`${baseUrl}/api/tasks?limit=20`);
const leaked = missingModelTaskId
  ? (restored.json.tasks || []).filter((task) => task.id === missingModelTaskId)
  : [];
assert(leaked.length === 0, `video BYOK probe task leak detected: ${missingModelTaskId}`);
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
