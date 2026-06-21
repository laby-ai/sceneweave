import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '雨夜的旧剧院里，一名年轻剪辑师发现胶片中反复出现同一个未来镜头，她必须在天亮前把真相剪成一支一分钟短片。';

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
      script: 'qa-production-flow',
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
const results = [];
let createdTaskId = null;

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;
  const dryRun = await fetchJson(`${baseUrl}/api/production/dry-run`, {
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

  assert(dryRun.res.ok, `POST /api/production/dry-run failed: ${dryRun.res.status}`);
  assert(dryRun.json.success === true, 'dry-run success mismatch');
  assert(dryRun.json.usedRealKey === false, 'dry-run unexpectedly used real key');
  assert(dryRun.json.incurredCost === false, 'dry-run unexpectedly incurred cost');
  assert(typeof dryRun.json.taskId === 'string' && dryRun.json.taskId.length > 0, 'dry-run taskId missing');
  assert(Array.isArray(dryRun.json.shots) && dryRun.json.shots.length >= 4, 'dry-run shots missing');
  assert(dryRun.json.flow?.totalDuration >= 60, 'dry-run total duration below 60 seconds');
  assert(dryRun.json.flow?.stages?.some((stage) => stage.id === 'task' && stage.status === 'completed'), 'task stage missing');
  assert(dryRun.json.productionProject?.id, 'productionProject missing');
  assert(Array.isArray(dryRun.json.productionProject.assets), 'productionProject assets missing');
  assert(Array.isArray(dryRun.json.productionProject.stages), 'productionProject stages missing');
  assert(dryRun.json.productionProject.assets.some((asset) => asset.kind === 'script'), 'script asset missing');
  assert(dryRun.json.productionProject.assets.some((asset) => asset.kind === 'character'), 'character asset missing');
  assert(dryRun.json.productionProject.assets.some((asset) => asset.kind === 'scene'), 'scene asset missing');
  assert(dryRun.json.productionProject.assets.some((asset) => asset.kind === 'storyboard'), 'storyboard asset missing');
  assert(dryRun.json.productionProject.assets.some((asset) => asset.kind === 'task'), 'task asset missing');
  assert(dryRun.json.productionProject.assets.some((asset) => asset.kind === 'deliverable'), 'deliverable asset missing');
  assert(dryRun.json.productionProject.stages.some((stage) => stage.id === 'assembly'), 'assembly stage missing');
  assert(dryRun.json.productionProject.storyboard?.shotCount === dryRun.json.shots.length, 'productionProject shotCount mismatch');
  createdTaskId = dryRun.json.taskId;

  results.push({
    check: 'production-dry-run',
    ok: true,
    taskId: createdTaskId,
    shotCount: dryRun.json.shots.length,
    totalDuration: dryRun.json.flow.totalDuration,
    productionProjectId: dryRun.json.productionProject.id,
    assetKinds: dryRun.json.productionProject.assets.map((asset) => asset.kind),
    stageIds: dryRun.json.flow.stages.map((stage) => `${stage.id}:${stage.status}`),
  });

  const detail = await fetchJson(`${baseUrl}/api/tasks/${createdTaskId}`);
  assert(detail.res.ok, `GET /api/tasks/{taskId} failed: ${detail.res.status}`);
  assert(detail.json.task?.status === 'completed', 'task detail status mismatch');
  assert(detail.json.task?.type === 'storyboard', 'task type mismatch');
  assert(detail.json.task?.result?.productionFlow?.shotCount === dryRun.json.shots.length, 'productionFlow shotCount mismatch');
  assert(Array.isArray(detail.json.task?.result?.shots), 'task result shots missing');
  assert(detail.json.task?.result?.productionProject?.id === dryRun.json.productionProject.id, 'task result productionProject missing');

  results.push({
    check: 'task-detail',
    ok: true,
    status: detail.json.task.status,
    type: detail.json.task.type,
    resultShotCount: detail.json.task.result.shots.length,
    productionAssetCount: detail.json.task.result.productionProject.assets.length,
    productionStageCount: detail.json.task.result.productionProject.stages.length,
  });

  const list = await fetchJson(`${baseUrl}/api/tasks?type=storyboard&limit=20`);
  assert(list.res.ok, `GET /api/tasks?type=storyboard failed: ${list.res.status}`);
  assert((list.json.tasks || []).some((task) => task.id === createdTaskId), 'dry-run task missing from task list');
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
assert(leaked.length === 0, `production dry-run task leak detected: ${createdTaskId}`);

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
