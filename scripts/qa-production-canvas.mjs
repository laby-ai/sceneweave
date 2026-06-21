import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '未来片场里，导演用一张会发光的分镜板找回失踪的主角，最终剪出一支一分钟悬疑短片。';

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
      script: 'qa-production-canvas',
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

function nodeTypeSet(nodes) {
  return new Set((nodes || []).map(node => node.type));
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
      style: '黑色科幻悬疑短片',
      sceneType: 'film',
      ratio: '16:9',
    }),
  });

  assert(director.res.ok, `POST /api/smart/director-chain failed: ${director.res.status}`);
  assert(director.json.success === true, 'director-chain success mismatch');
  assert(director.json.usedRealKey === false, 'director-chain unexpectedly used real key');
  createdTaskId = director.json.taskId;
  assert(typeof createdTaskId === 'string' && createdTaskId.length > 0, 'taskId missing');

  // The task manager keeps a short server-side cache. Wait past that TTL so
  // follow-up API reads cannot observe a stale pre-probe task file.
  await sleep(1200);

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId, persist: true }),
  });
  assert(assembly.res.ok, `POST /api/production/assembly-plan failed: ${assembly.res.status}`);
  assert(assembly.json.success === true, 'assembly-plan success mismatch');
  assert(assembly.json.assemblyPlan?.bridgePlan?.version === 'yh-segment-bridge-plan-v1', 'assembly bridgePlan missing before canvas');

  await sleep(1200);

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(canvas.res.ok, `GET /api/node-editor/production-canvas failed: ${canvas.res.status}`);
  assert(canvas.json.success === true, 'canvas success mismatch');
  assert(canvas.json.usedRealKey === false, 'canvas unexpectedly used real key');
  assert(canvas.json.incurredCost === false, 'canvas unexpectedly incurred cost');

  const nodes = canvas.json.canvas?.nodes || [];
  const edges = canvas.json.canvas?.edges || [];
  const types = nodeTypeSet(nodes);
  for (const expectedType of ['script', 'agent', 'character', 'scene', 'storyboard', 'video', 'quality']) {
    assert(types.has(expectedType), `canvas missing node type: ${expectedType}`);
  }

  const storyboardNode = nodes.find(node => node.type === 'storyboard');
  assert(Array.isArray(storyboardNode?.data?.storyboard), 'storyboard rows missing on storyboard node');
  assert(storyboardNode.data.storyboard.length >= 1, 'storyboard rows empty');
  const readabilityNode = nodes.find(node => node?.data?.assetKind === 'storyReadability');
  assert(readabilityNode?.type === 'quality', 'story readability node missing from canvas');
  assert(Number(readabilityNode?.data?.score) >= 80, 'story readability node score below threshold');
  const trailerNode = nodes.find(node => node?.data?.assetKind === 'trailerBeatSheet');
  assert(trailerNode, 'canvas missing trailerBeatSheet node');
  assert(Number(trailerNode?.data?.beatCount) >= 5, 'trailerBeatSheet node should expose trailer beats');
  const bridgeNode = nodes.find(node => node?.data?.assetKind === 'segmentBridgePlan');
  assert(bridgeNode, 'canvas missing segmentBridgePlan node');
  assert(Number(bridgeNode?.data?.bridgeCount) === canvas.json.canvas.summary.storyboardShotCount, 'segmentBridgePlan should cover every storyboard shot');
  assert(String(bridgeNode?.data?.prompt || '').includes('观众检查点'), 'segmentBridgePlan node missing viewer checkpoint details');
  assert(String(bridgeNode?.data?.prompt || '').includes('上一帧记忆'), 'segmentBridgePlan node missing previous frame memory');
  assert(String(bridgeNode?.data?.prompt || '').includes('下一段触发'), 'segmentBridgePlan node missing next frame trigger');
  const readinessNode = nodes.find(node => node?.data?.assetKind === 'assemblyReadiness');
  assert(readinessNode?.type === 'quality', 'canvas missing assemblyReadiness node');
  assert(readinessNode.data?.pass === true, 'assemblyReadiness node should pass for probe');
  assert(readinessNode.data?.blockerCount === 0, 'assemblyReadiness node should have no blockers');
  assert(String(readinessNode.data?.prompt || '').includes('首帧'), 'assemblyReadiness node should explain shot frame contract');
  const assemblySegmentNodes = nodes.filter(node => node?.data?.assetKind === 'assemblySegment');
  assert(assemblySegmentNodes.length === canvas.json.canvas.summary.storyboardShotCount, 'assemblySegment nodes should cover every shot before video assets exist');
  assert(assemblySegmentNodes.every(node => node.data?.shotFrameContract?.version === 'yh-shot-frame-contract-v1'), 'assemblySegment nodes missing shot frame contract');
  assert(assemblySegmentNodes.every(node => node.data?.shotFrameReadiness?.pass === true), 'assemblySegment shot frame readiness should pass');
  assert(assemblySegmentNodes.slice(1).every(node => node.data?.shotFrameContract?.handoff?.requiresPreviousLastFrame === true), 'non-first assemblySegment nodes should require previous last frame');
  assert(canvas.json.storyReadability?.pass === true, 'canvas response story readability should pass');
  assert(canvas.json.canvas.summary.storyReadabilityPass === true, 'canvas summary missing passing readability gate');
  assert(canvas.json.canvas.summary.totalDuration >= 60, 'canvas total duration below 60 seconds');
  assert(edges.length >= nodes.length - 1, `expected connected canvas, nodes=${nodes.length}, edges=${edges.length}`);
  assert(canvas.json.canvas.reference?.primary === 'Toonflow-app', 'canvas reference mismatch');

  results.push({
    check: 'production-canvas-by-task',
    ok: true,
    taskId: createdTaskId,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypes: Array.from(types).sort(),
    storyReadabilityScore: canvas.json.storyReadability.score,
    trailerBeatCount: trailerNode.data.beatCount,
    bridgeCount: bridgeNode.data.bridgeCount,
    readinessPass: readinessNode.data.pass,
    assemblySegmentNodeCount: assemblySegmentNodes.length,
    shotFrameContracts: assemblySegmentNodes.length,
    storyboardShotCount: canvas.json.canvas.summary.storyboardShotCount,
    totalDuration: canvas.json.canvas.summary.totalDuration,
  });

  const latestCanvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas`);
  assert(latestCanvas.res.ok, `GET latest production-canvas failed: ${latestCanvas.res.status}`);
  assert(latestCanvas.json.taskId === createdTaskId, 'latest production canvas did not pick the probe task');

  results.push({
    check: 'production-canvas-latest',
    ok: true,
    taskId: latestCanvas.json.taskId,
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
assert(leaked.length === 0, `production-canvas probe task leak detected: ${createdTaskId}`);

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
