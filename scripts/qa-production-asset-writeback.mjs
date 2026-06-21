import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '一个剪辑师在星际胶片档案馆里修复失踪主角的最后一段影像，发现每个镜头都在改变现实。';

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
      script: 'qa-production-asset-writeback',
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
      style: '宇宙胶片悬疑短剧',
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
  assert(assembly.json.persisted === true, 'assembly-plan was not persisted before writeback');
  assert(assembly.json.assemblyPlan?.readiness?.pass === true, 'fresh assembly plan should pass before asset writeback');

  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId }),
  });
  assert(queue.res.ok, `POST /api/production/assembly-plan/queue failed: ${queue.res.status}`);
  const childTaskIds = queue.json.childTaskIds || [];
  assert(childTaskIds.length > 0, 'assembly queue did not create segment child tasks before asset writeback');

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(canvas.res.ok, `GET /api/node-editor/production-canvas failed: ${canvas.res.status}`);
  assert(canvas.json.success === true, 'canvas success mismatch');
  assert(canvas.json.canvas?.reference?.primary === 'Toonflow-app', 'canvas reference mismatch');

  const editableNode = (canvas.json.canvas.nodes || []).find(node =>
    node.type === 'script' &&
    typeof node.data?.productionAssetId === 'string' &&
    typeof node.data?.prompt === 'string',
  );
  assert(editableNode, 'missing editable production script node');

  const assetId = editableNode.data.productionAssetId;
  const writebackSummary = `QA 写回验证：${Date.now()}，节点内容已从画布回写到 productionProject.assets。`;

  const writeback = await fetchJson(
    `${baseUrl}/api/production/projects/${encodeURIComponent(createdTaskId)}/assets/${encodeURIComponent(assetId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QA 写回剧本资产',
        summary: writebackSummary,
        metadata: {
          qaProbe: 'production-asset-writeback',
          canvasNodeId: editableNode.id,
        },
      }),
    },
  );
  assert(writeback.res.ok, `PATCH production asset failed: ${writeback.res.status}`);
  assert(writeback.json.success === true, 'writeback success mismatch');
  assert(writeback.json.usedRealKey === false, 'writeback unexpectedly used real key');
  assert(writeback.json.incurredCost === false, 'writeback unexpectedly incurred cost');
  assert(writeback.json.asset?.summary === writebackSummary, 'writeback asset summary mismatch');
  assert((writeback.json.changedFields || []).includes('summary'), 'writeback did not report summary change');

  await sleep(1200);

  const refreshedCanvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(refreshedCanvas.res.ok, `GET refreshed canvas failed: ${refreshedCanvas.res.status}`);
  const refreshedNode = (refreshedCanvas.json.canvas.nodes || []).find(node => node.data?.productionAssetId === assetId);
  assert(refreshedNode, 'refreshed canvas missing patched asset node');
  assert(refreshedNode.data.prompt === writebackSummary, 'refreshed canvas did not load patched summary from productionProject');

  const detail = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(createdTaskId)}`);
  assert(detail.res.ok, `GET task detail failed: ${detail.res.status}`);
  const staleAssemblyPlan = detail.json.task?.result?.assemblyPlan;
  const staleSegments = (staleAssemblyPlan?.segments || []).filter(segment => segment.artifactReadiness?.stale === true);
  assert(staleAssemblyPlan?.readiness?.pass === false, 'asset writeback did not invalidate assembly plan readiness');
  assert(
    staleAssemblyPlan?.readiness?.issues?.some(issue => issue.code === 'artifact-stale-after-project-writeback'),
    'asset writeback did not record artifact stale blocker',
  );
  assert(staleSegments.length > 0, 'asset writeback did not mark affected segments stale');
  assert(
    staleSegments.every(segment => segment.expectedOutputs?.videoUrl === null && segment.expectedOutputs?.lastFrameUrl === null),
    'stale segments should clear generated video and last-frame outputs',
  );

  const staleStart = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childTaskId: childTaskIds[0] }),
  });
  assert(staleStart.res.status === 409, `stale segment start should be rejected, got: ${staleStart.res.status}`);
  assert(
    JSON.stringify(staleStart.json).includes('artifact-stale-after-project-writeback'),
    'stale segment start did not expose artifact stale blocker',
  );

  results.push({
    check: 'canvas-node-writeback',
    ok: true,
    taskId: createdTaskId,
    productionProjectId: refreshedCanvas.json.canvas.productionProjectId,
    assetId,
    nodeId: refreshedNode.id,
    changedFields: writeback.json.changedFields,
    staleSegmentCount: staleSegments.length,
    staleStartRejected: true,
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
assert(leaked.length === 0, `asset writeback probe task leak detected: ${createdTaskId}`);

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
