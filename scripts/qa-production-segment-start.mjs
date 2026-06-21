import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '轨道影院即将关闭，导演用六个片段找回第一位观众留下的一分钟影像。';

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
      script: 'qa-production-segment-start',
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
  assert(director.res.ok, `POST /api/smart/director-chain failed: ${director.res.status}`);
  assert(director.json.success === true, 'director-chain success mismatch');
  parentTaskId = director.json.taskId;

  await sleep(1200);
  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: parentTaskId, persist: true }),
  });
  assert(assembly.res.ok, `POST /api/production/assembly-plan failed: ${assembly.res.status}`);
  assert(assembly.json.assemblyPlan.segmentCount === 6, 'expected six assembly segments');

  await sleep(1200);
  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: parentTaskId }),
  });
  assert(queue.res.ok, `POST /api/production/assembly-plan/queue failed: ${queue.res.status}`);
  childTaskIds = queue.json.childTaskIds;
  assert(childTaskIds.length === 6, 'expected six child tasks');

  const firstChildTaskId = childTaskIds[0];
  const dryRun = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childTaskId: firstChildTaskId }),
  });
  assert(dryRun.res.ok, `dry-run segment start failed: ${dryRun.res.status}`);
  assert(dryRun.json.success === true, 'dry-run success mismatch');
  assert(dryRun.json.dryRun === true, 'dry-run flag mismatch');
  assert(dryRun.json.usedRealKey === false, 'dry-run unexpectedly used real key');
  assert(dryRun.json.incurredCost === false, 'dry-run unexpectedly incurred cost');
  assert(dryRun.json.startPayload?.usesShotFrameContract === true, 'dry-run should expose shot-frame start payload');
  assert(
    dryRun.json.startPayload?.contractVersion === 'yh-shot-frame-contract-v1',
    `dry-run contract version mismatch: ${JSON.stringify(dryRun.json.startPayload)}`
  );
  assert(
    String(dryRun.json.startPayload?.promptPreview || '').includes('【首帧合约】')
      && String(dryRun.json.startPayload?.promptPreview || '').includes('【尾帧合约】'),
    'dry-run prompt preview should include first/last-frame contract'
  );

  const dryDetail = await fetchJson(`${baseUrl}/api/tasks/${firstChildTaskId}`);
  assert(dryDetail.res.ok, `GET dry-run child task failed: ${dryDetail.res.status}`);
  assert(dryDetail.json.task.status === 'pending', 'dry-run should leave child task pending');
  assert(
    String(dryDetail.json.task.stage || '').includes('启动前检查'),
    `dry-run stage mismatch: stage=${JSON.stringify(dryDetail.json.task.stage)}, message=${JSON.stringify(dryDetail.json.task.message)}`
  );
  assert(
    dryDetail.json.task.config?.segmentStartPayload?.usesShotFrameContract === true,
    'dry-run child task should persist segmentStartPayload'
  );
  assert(
    dryDetail.json.task.config?.segmentStartPayload?.contractVersion === 'yh-shot-frame-contract-v1',
    'dry-run child task should persist shot-frame contract version'
  );

  results.push({
    check: 'segment-start-dry-run',
    ok: true,
    parentTaskId,
    childTaskId: firstChildTaskId,
    status: dryDetail.json.task.status,
    stage: dryDetail.json.task.stage,
    startPayloadVersion: dryDetail.json.task.config.segmentStartPayload.version,
    contractVersion: dryDetail.json.task.config.segmentStartPayload.contractVersion,
  });

  const secondChildTaskId = childTaskIds[1];
  const blockedSecond = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      childTaskId: secondChildTaskId,
    }),
  });
  assert(blockedSecond.res.status === 409, `second segment should be blocked before previous handoff: ${blockedSecond.res.status}`);
  assert(
    JSON.stringify(blockedSecond.json).includes('上一段') || JSON.stringify(blockedSecond.json).includes('StorySegmentContract'),
    'blocked second segment should explain previous-segment/story contract readiness'
  );

  const missingModel = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': 'https://ark.cn-beijing.volces.com/api/v3',
      'x-yh-api-key': 'dummy-key',
    },
    body: JSON.stringify({
      childTaskId: firstChildTaskId,
      dryRun: false,
      allowRealCost: true,
    }),
  });
  assert(missingModel.res.ok, `missing-model segment start submit failed: ${missingModel.res.status}`);
  assert(missingModel.json.success === true, 'missing-model start success mismatch');
  assert(missingModel.json.usedRealKey === true, 'missing-model start should enter BYOK guarded path');

  const failedChild = await waitForTaskStatus(firstChildTaskId, 'failed');
  assert(String(failedChild.error || '').includes('BYOK 视频调用缺少视频模型'), 'missing model failure not preserved on child task');
  assert(!String(failedChild.error || '').includes('MINIMAX_API_KEY'), 'segment start fell back to Minimax');

  await sleep(1200);
  const parentDetail = await fetchJson(`${baseUrl}/api/tasks/${parentTaskId}`);
  assert(parentDetail.res.ok, `GET parent task failed: ${parentDetail.res.status}`);
  const failedSegment = parentDetail.json.task?.result?.assemblyPlan?.segments?.find(segment => segment.index === 0);
  assert(failedSegment?.status === 'failed', 'parent assembly segment did not fail');
  assert(String(failedSegment?.error || '').includes('BYOK 视频调用缺少视频模型'), 'parent assembly segment error mismatch');

  results.push({
    check: 'segment-start-missing-model-failure',
    ok: true,
    childTaskId: firstChildTaskId,
    childStatus: failedChild.status,
    parentSegmentStatus: failedSegment.status,
    error: failedChild.error,
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
assert(leaked.length === 0, `segment start probe task leak detected: ${leaked.map(task => task.id).join(', ')}`);

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
