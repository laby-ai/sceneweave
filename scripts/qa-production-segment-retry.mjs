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
      script: 'qa-production-segment-retry',
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

  const failedChildTaskId = childTaskIds[1];
  const missingModel = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': 'https://ark.cn-beijing.volces.com/api/v3',
      'x-yh-api-key': 'dummy-key',
    },
    body: JSON.stringify({
      childTaskId: failedChildTaskId,
      dryRun: false,
      allowRealCost: true,
    }),
  });
  assert(missingModel.res.ok, `missing-model segment start submit failed: ${missingModel.res.status}`);
  assert(missingModel.json.success === true, 'missing-model start success mismatch');

  const failedChild = await waitForTaskStatus(failedChildTaskId, 'failed');
  assert(String(failedChild.error || '').includes('BYOK 视频调用缺少视频模型'), 'missing model failure not preserved on child task');

  const failedCanvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(parentTaskId)}`);
  assert(failedCanvas.res.ok, `GET failed production canvas failed: ${failedCanvas.res.status}`);
  const failedSegmentNode = (failedCanvas.json.canvas?.nodes || []).find(node =>
    node?.data?.assetKind === 'assemblySegment' &&
    Number(node?.data?.segmentIndex) === 1
  );
  assert(failedSegmentNode, 'failed assembly segment node missing from canvas');
  assert(failedSegmentNode.data.productionTaskId === parentTaskId, 'failed assembly segment node missing parent task id');
  assert(failedSegmentNode.data.childTaskId === failedChildTaskId, 'failed assembly segment node missing child task id');
  assert(failedSegmentNode.data.segmentStatus === 'failed', 'failed assembly segment node status mismatch');
  assert(failedSegmentNode.data.status === 'error', 'failed assembly segment node should render as error');
  assert(String(failedSegmentNode.data.error || failedSegmentNode.data.prompt || '').includes('BYOK 视频调用缺少视频模型'), 'failed assembly segment node missing readable error');

  results.push({
    check: 'failed-segment-visible-on-canvas',
    ok: true,
    parentTaskId,
    childTaskId: failedChildTaskId,
    nodeId: failedSegmentNode.id,
    segmentStatus: failedSegmentNode.data.segmentStatus,
    nodeStatus: failedSegmentNode.data.status,
  });

  const retry = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentTaskId,
      segmentIndex: 1,
    }),
  });
  assert(retry.res.ok, `segment retry failed: ${retry.res.status}`);
  assert(retry.json.success === true, 'segment retry success mismatch');
  assert(retry.json.usedRealKey === false, 'retry unexpectedly used real key');
  assert(retry.json.incurredCost === false, 'retry unexpectedly incurred cost');
  assert(retry.json.childTaskId === failedChildTaskId, 'retry should reuse existing failed child task');
  assert(retry.json.retryCount >= 1, 'retry count should increment');

  const retriedChild = await fetchJson(`${baseUrl}/api/tasks/${failedChildTaskId}`);
  assert(retriedChild.res.ok, `GET retried child task failed: ${retriedChild.res.status}`);
  assert(retriedChild.json.task.status === 'pending', 'retried child should be pending');
  assert(String(retriedChild.json.task.stage || '').includes('等待重试'), 'retried child stage mismatch');
  assert(!retriedChild.json.task.error, 'retried child should clear error');

  const parentDetail = await fetchJson(`${baseUrl}/api/tasks/${parentTaskId}`);
  assert(parentDetail.res.ok, `GET parent task failed: ${parentDetail.res.status}`);
  const retriedSegment = parentDetail.json.task?.result?.assemblyPlan?.segments?.find(segment => segment.index === 1);
  assert(retriedSegment?.status === 'queued', 'parent segment should be queued after retry');
  assert(retriedSegment?.error === null || retriedSegment?.error === undefined, 'parent segment error should be cleared');
  assert(retriedSegment?.expectedOutputs?.taskId === failedChildTaskId, 'parent segment should keep child task id');
  assert(parentDetail.json.task?.result?.assemblyQueue?.childTaskIds?.includes(failedChildTaskId), 'assemblyQueue should keep retried child task id');

  const retriedCanvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(parentTaskId)}`);
  assert(retriedCanvas.res.ok, `GET retried production canvas failed: ${retriedCanvas.res.status}`);
  const retriedSegmentNode = (retriedCanvas.json.canvas?.nodes || []).find(node =>
    node?.data?.assetKind === 'assemblySegment' &&
    Number(node?.data?.segmentIndex) === 1
  );
  assert(retriedSegmentNode, 'retried assembly segment node missing from canvas');
  assert(retriedSegmentNode.data.childTaskId === failedChildTaskId, 'retried assembly segment node should keep child task id');
  assert(retriedSegmentNode.data.segmentStatus === 'queued', 'retried assembly segment node should be queued');
  assert(retriedSegmentNode.data.status === 'idle', 'retried assembly segment node should render as idle');
  assert(!retriedSegmentNode.data.error, 'retried assembly segment node error should be cleared');

  results.push({
    check: 'segment-retry-requeues-failed-child',
    ok: true,
    parentTaskId,
    childTaskId: failedChildTaskId,
    childStatus: retriedChild.json.task.status,
    parentSegmentStatus: retriedSegment.status,
    canvasSegmentStatus: retriedSegmentNode.data.segmentStatus,
    retryCount: retry.json.retryCount,
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
assert(leaked.length === 0, `segment retry probe task leak detected: ${leaked.map(task => task.id).join(', ')}`);

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
