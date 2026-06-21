import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '雨夜旧剧院里，剪辑师发现一卷胶片能预告未来，她要在天亮前剪出一支一分钟真相短片。';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      script: 'qa-smart-director-chain',
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

let lockAcquired = false;
let originalExists = false;
let originalContent = null;
let createdTaskId = null;
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
      style: '黑色电影感短剧',
      sceneType: 'drama',
      ratio: '16:9',
    }),
  });

  assert(director.res.ok, `POST /api/smart/director-chain failed: ${director.res.status}`);
  assert(director.json.success === true, 'director-chain success mismatch');
  assert(director.json.usedRealKey === false, 'director-chain unexpectedly used real key');
  assert(director.json.incurredCost === false, 'director-chain unexpectedly incurred cost');
  assert(typeof director.json.taskId === 'string' && director.json.taskId.length > 0, 'taskId missing');
  createdTaskId = director.json.taskId;

  const agents = director.json.directorChain?.agents || [];
  const roles = agents.map((agent) => agent.role).sort();
  assert(agents.length === 4, `expected 4 agents, got ${agents.length}`);
  assert(roles.join(',') === 'cinematographer,director,producer,screenwriter', `agent roles mismatch: ${roles.join(',')}`);
  assert(agents.every((agent) => Array.isArray(agent.decisions) && agent.decisions.length >= 2), 'agent decisions incomplete');
  assert(director.json.directorChain?.handoff?.productionProjectId === director.json.productionProject?.id, 'handoff productionProjectId mismatch');
  assert(Array.isArray(director.json.productionProject?.assets), 'productionProject assets missing');
  assert(director.json.productionProject.assets.some((asset) => asset.kind === 'character'), 'character asset missing');
  assert(director.json.productionProject.assets.some((asset) => asset.kind === 'storyboard'), 'storyboard asset missing');
  assert(director.json.productionProject.storyboard?.totalDuration >= 60, 'storyboard total duration below 60 seconds');

  results.push({
    check: 'smart-director-chain',
    ok: true,
    taskId: createdTaskId,
    roles,
    assetKinds: director.json.productionProject.assets.map((asset) => asset.kind),
    totalDuration: director.json.productionProject.storyboard.totalDuration,
  });

  // The task manager keeps a short server-side cache. Wait past that TTL so
  // follow-up API reads cannot observe a stale pre-probe task file.
  await sleep(1200);

  const detail = await fetchJson(`${baseUrl}/api/tasks/${createdTaskId}`);
  assert(detail.res.ok, `GET /api/tasks/{taskId} failed: ${detail.res.status}`);
  assert(detail.json.task?.status === 'completed', 'task detail status mismatch');
  assert(detail.json.task?.config?.workflow === 'smart-director-chain', 'task workflow mismatch');
  assert(detail.json.task?.result?.directorChain?.agents?.length === 4, 'task result directorChain missing');
  assert(detail.json.task?.result?.productionProject?.id === director.json.productionProject.id, 'task result productionProject mismatch');

  results.push({
    check: 'task-detail',
    ok: true,
    status: detail.json.task.status,
    workflow: detail.json.task.config.workflow,
    agentCount: detail.json.task.result.directorChain.agents.length,
  });

  const list = await fetchJson(`${baseUrl}/api/tasks?type=storyboard&limit=20`);
  assert(list.res.ok, `GET /api/tasks?type=storyboard failed: ${list.res.status}`);
  assert((list.json.tasks || []).some((task) => task.id === createdTaskId), 'director-chain task missing from task list');
  results.push({
    check: 'task-list',
    ok: true,
    listed: true,
    total: list.json.total,
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
const leaked = createdTaskId
  ? (restored.json.tasks || []).filter((task) => task.id === createdTaskId)
  : [];
assert(leaked.length === 0, `director-chain probe task leak detected: ${createdTaskId}`);

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
  promptLength: prompt.length,
  results,
}, null, 2));
