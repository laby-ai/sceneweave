import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '太空档案馆即将坠入黑洞，剪辑师必须用六个镜头拼出被删除的一分钟记忆。';

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
      script: 'qa-production-assembly-queue',
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
  createdTaskId = director.json.taskId;
  assert(typeof createdTaskId === 'string' && createdTaskId.length > 0, 'taskId missing');

  await sleep(1200);

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId, persist: true }),
  });

  assert(assembly.res.ok, `POST /api/production/assembly-plan failed: ${assembly.res.status}`);
  assert(assembly.json.success === true, 'assembly-plan success mismatch');
  assert(assembly.json.assemblyPlan.segmentCount === 6, 'expected six assembly segments');
  assert(assembly.json.assemblyPlan.totalDuration >= 60, 'assembly total duration below 60 seconds');
  assert(assembly.json.assemblyPlan.readiness?.pass === true, 'assembly readiness should pass before queue');
  assert(assembly.json.assemblyPlan.segments.every(segment => segment.shotFrameContract?.readiness?.pass === true), 'assembly segments missing shot frame contracts before queue');

  await sleep(1200);

  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId }),
  });

  assert(queue.res.ok, `POST /api/production/assembly-plan/queue failed: ${queue.res.status}`);
  assert(queue.json.success === true, 'assembly queue success mismatch');
  assert(queue.json.usedRealKey === false, 'assembly queue unexpectedly used real key');
  assert(queue.json.incurredCost === false, 'assembly queue unexpectedly incurred cost');
  assert(queue.json.queuedSegmentCount === assembly.json.assemblyPlan.segmentCount, 'queued segment count mismatch');
  assert(queue.json.childTaskIds.length === queue.json.queuedSegmentCount, 'child task id count mismatch');
  assert(queue.json.segments.every(segment => typeof segment.taskId === 'string' && segment.taskId.length > 0), 'segment taskId missing');
  assert(queue.json.segments[0].dependencyTaskId === null, 'first queued segment should not depend on previous task');
  for (let index = 1; index < queue.json.segments.length; index += 1) {
    assert(queue.json.segments[index].dependencyTaskId === queue.json.segments[index - 1].taskId, `segment ${index} dependencyTaskId should point to previous child task`);
  }

  childTaskIds = queue.json.childTaskIds;

  results.push({
    check: 'assembly-queue-create',
    ok: true,
    parentTaskId: createdTaskId,
    queuedSegmentCount: queue.json.queuedSegmentCount,
    childTaskCount: childTaskIds.length,
    usedRealKey: queue.json.usedRealKey,
    incurredCost: queue.json.incurredCost,
  });

  await sleep(1200);

  const detail = await fetchJson(`${baseUrl}/api/tasks/${createdTaskId}`);
  assert(detail.res.ok, `GET /api/tasks/{taskId} failed: ${detail.res.status}`);
  const persistedQueue = detail.json.task?.result?.assemblyQueue;
  const persistedPlan = detail.json.task?.result?.assemblyPlan;
  assert(persistedQueue?.version === 'yh-assembly-queue-v1', 'persisted assemblyQueue missing');
  assert(persistedQueue.childTaskIds.length === childTaskIds.length, 'persisted child task count mismatch');
  assert(persistedPlan.readiness?.pass === true, 'persisted plan readiness missing after queue');
  assert(persistedPlan.segments.every(segment => childTaskIds.includes(segment.expectedOutputs?.taskId)), 'persisted segment task ids mismatch');
  assert(persistedPlan.segments.every(segment => segment.shotFrameContract?.version === 'yh-shot-frame-contract-v1'), 'persisted queued segments missing shot frame contracts');

  results.push({
    check: 'assembly-queue-persisted',
    ok: true,
    parentStatus: detail.json.task.status,
    persistedChildTaskCount: persistedQueue.childTaskIds.length,
    planStatus: persistedPlan.status,
    readiness: persistedPlan.readiness.pass,
    shotFrameContracts: persistedPlan.segments.length,
  });

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(canvas.res.ok, `GET production canvas after queue failed: ${canvas.res.status}`);
  assert(canvas.json.success === true, 'production canvas after queue success mismatch');
  const assemblySegmentNodes = (canvas.json.canvas?.nodes || []).filter(node => node?.data?.assetKind === 'assemblySegment');
  assert(assemblySegmentNodes.length === childTaskIds.length, `assembly segment node count mismatch: ${assemblySegmentNodes.length}/${childTaskIds.length}`);
  assert(assemblySegmentNodes.every(node => childTaskIds.includes(node.data?.childTaskId)), 'assembly segment nodes missing child task ids');
  assert(assemblySegmentNodes.every(node => node.data?.productionTaskId === createdTaskId), 'assembly segment nodes missing parent task id');
  assert(assemblySegmentNodes.every(node => node.data?.productionSource === 'assemblyPlan.segments'), 'assembly segment nodes source mismatch');

  results.push({
    check: 'assembly-segments-visible-on-canvas',
    ok: true,
    parentTaskId: createdTaskId,
    assemblySegmentNodeCount: assemblySegmentNodes.length,
    canvasNodeCount: canvas.json.canvas.summary.nodeCount,
  });

  const list = await fetchJson(`${baseUrl}/api/tasks?type=video&limit=100`);
  assert(list.res.ok, `GET /api/tasks?type=video failed: ${list.res.status}`);
  const listedChildren = (list.json.tasks || []).filter(task => childTaskIds.includes(task.id));
  assert(listedChildren.length === childTaskIds.length, 'not all child tasks are visible in task list');
  assert(listedChildren.every(task => task.status === 'pending'), 'child tasks should remain pending');
  assert(listedChildren.every(task => task.config?.workflow === 'production-assembly-segment'), 'child workflow marker missing');
  assert(listedChildren.every(task => task.config?.parentTaskId === createdTaskId), 'child parentTaskId mismatch');
  assert(listedChildren.every(task => task.config?.costGuard === 'queued-only-no-provider-call'), 'child cost guard missing');
  for (const child of listedChildren) {
    const dependency = child.config?.assemblyDependency;
    assert(dependency?.version === 'yh-segment-dependency-v1', `child ${child.id} missing segment dependency contract`);
    assert(dependency.taskId === child.id, `child ${child.id} dependency task id mismatch`);
    assert(dependency.dependencyIndex >= 0, `child ${child.id} dependency index missing`);
    if (dependency.dependencyIndex === 0) {
      assert(dependency.dependencyTaskId === null, `first child ${child.id} should not depend on previous task`);
      assert(dependency.requiresPreviousLastFrame === false, `first child ${child.id} should not require previous last frame`);
    } else {
      const previous = queue.json.segments[dependency.dependencyIndex - 1];
      assert(dependency.dependencyTaskId === previous.taskId, `child ${child.id} should depend on previous child task`);
      assert(dependency.dependencyResourceId === previous.id, `child ${child.id} should depend on previous segment resource`);
      assert(dependency.requiresPreviousLastFrame === true, `child ${child.id} should require previous last frame`);
      assert(String(dependency.continuityPrompt || '').includes('开头1-2秒'), `child ${child.id} continuity prompt missing handoff rule`);
    }
  }

  results.push({
    check: 'child-tasks-visible',
    ok: true,
    visibleChildTasks: listedChildren.length,
    statuses: [...new Set(listedChildren.map(task => task.status))],
    dependencyContracts: listedChildren.length,
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
const leakedIds = new Set([createdTaskId, ...childTaskIds].filter(Boolean));
const leaked = (restored.json.tasks || []).filter(task => leakedIds.has(task.id));
assert(leaked.length === 0, `assembly queue probe task leak detected: ${leaked.map(task => task.id).join(', ')}`);

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
