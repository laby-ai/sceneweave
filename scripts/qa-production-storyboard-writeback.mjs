import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '一个导演在废弃放映厅里追查失踪演员的最后一场戏，发现每次剪掉镜头都会改变现实。';

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
      script: 'qa-production-storyboard-writeback',
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
      style: '黑色电影感悬疑短剧',
      sceneType: 'film',
      ratio: '16:9',
    }),
  });

  assert(director.res.ok, `POST /api/smart/director-chain failed: ${director.res.status}`);
  assert(director.json.success === true, 'director-chain success mismatch');
  assert(director.json.usedRealKey === false, 'director-chain unexpectedly used real key');
  createdTaskId = director.json.taskId;
  assert(typeof createdTaskId === 'string' && createdTaskId.length > 0, 'taskId missing');

  await sleep(1200);

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: createdTaskId,
      persist: true,
    }),
  });
  assert(assembly.res.ok, `POST /api/production/assembly-plan failed: ${assembly.res.status}`);
  assert(assembly.json.success === true, 'assembly-plan success mismatch');
  assert(assembly.json.persisted === true, 'assembly-plan was not persisted before storyboard writeback');
  assert(assembly.json.assemblyPlan?.readiness?.pass === true, 'fresh assembly plan should pass before storyboard writeback');

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(canvas.res.ok, `GET /api/node-editor/production-canvas failed: ${canvas.res.status}`);
  const storyboardNode = (canvas.json.canvas.nodes || []).find(node => node.type === 'storyboard');
  assert(storyboardNode, 'missing storyboard node');
  assert(Array.isArray(storyboardNode.data?.storyboard) && storyboardNode.data.storyboard.length > 0, 'storyboard rows missing');

  const firstShot = storyboardNode.data.storyboard[0];
  const updatedPrompt = `QA 镜头写回验证：${Date.now()}。角色发现被剪掉的镜头仍投在墙面上。`;
  const updatedDuration = Math.max(2, Number(firstShot.duration || 3) + 1);

  const writeback = await fetchJson(
    `${baseUrl}/api/production/projects/${encodeURIComponent(createdTaskId)}/storyboard/${encodeURIComponent(firstShot.id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: updatedPrompt,
        duration: updatedDuration,
        shotType: firstShot.shotType || 'story',
        shotTypeLabel: '写回验证镜头',
        subtitleText: '被剪掉的镜头，还在继续播放。',
        status: 'ready',
      }),
    },
  );

  assert(writeback.res.ok, `PATCH storyboard shot failed: ${writeback.res.status}`);
  assert(writeback.json.success === true, 'storyboard writeback success mismatch');
  assert(writeback.json.usedRealKey === false, 'storyboard writeback unexpectedly used real key');
  assert(writeback.json.incurredCost === false, 'storyboard writeback unexpectedly incurred cost');
  assert(writeback.json.shot?.prompt === updatedPrompt, 'writeback shot prompt mismatch');
  assert(writeback.json.shot?.duration === updatedDuration, 'writeback shot duration mismatch');
  assert((writeback.json.changedFields || []).includes('prompt'), 'writeback did not report prompt change');

  await sleep(1200);

  const refreshedCanvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(refreshedCanvas.res.ok, `GET refreshed canvas failed: ${refreshedCanvas.res.status}`);
  const refreshedStoryboardNode = (refreshedCanvas.json.canvas.nodes || []).find(node => node.type === 'storyboard');
  const refreshedShot = refreshedStoryboardNode?.data?.storyboard?.find(shot => shot.id === firstShot.id);
  assert(refreshedShot, 'refreshed canvas missing patched shot');
  assert(refreshedShot.prompt === updatedPrompt, 'refreshed canvas did not load patched shot prompt');
  assert(refreshedShot.duration === updatedDuration, 'refreshed canvas did not load patched shot duration');

  const detail = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(createdTaskId)}`);
  assert(detail.res.ok, `GET task detail failed: ${detail.res.status}`);
  const staleAssemblyPlan = detail.json.task?.result?.assemblyPlan;
  const staleSegments = (staleAssemblyPlan?.segments || []).filter(segment => segment.artifactReadiness?.stale === true);
  assert(staleAssemblyPlan?.readiness?.pass === false, 'storyboard writeback did not invalidate assembly plan readiness');
  assert(
    staleAssemblyPlan?.readiness?.issues?.some(issue => issue.code === 'artifact-stale-after-project-writeback'),
    'storyboard writeback did not record artifact stale blocker',
  );
  assert(staleSegments.length > 0, 'storyboard writeback did not mark affected segments stale');
  assert(
    staleSegments.every(segment => segment.expectedOutputs?.videoUrl === null && segment.expectedOutputs?.lastFrameUrl === null),
    'stale storyboard segments should clear generated video and last-frame outputs',
  );

  results.push({
    check: 'storyboard-shot-writeback',
    ok: true,
    taskId: createdTaskId,
    productionProjectId: refreshedCanvas.json.canvas.productionProjectId,
    shotId: firstShot.id,
    changedFields: writeback.json.changedFields,
    totalDuration: refreshedCanvas.json.canvas.summary.totalDuration,
    staleSegmentCount: staleSegments.length,
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
  ? (restored.json.tasks || []).filter(task => task.id === createdTaskId)
  : [];
assert(leaked.length === 0, `storyboard writeback probe task leak detected: ${createdTaskId}`);

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
