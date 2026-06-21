import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '雨夜的地下剪辑室里，导演发现每个分镜都会改变现实，她必须用六个镜头拼出一分钟真相。';

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
      script: 'qa-production-assembly-plan',
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
      style: '黑色悬疑短剧',
      sceneType: 'drama',
      ratio: '16:9',
    }),
  });

  assert(director.res.ok, `POST /api/smart/director-chain failed: ${director.res.status}`);
  assert(director.json.success === true, 'director-chain success mismatch');
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
  assert(assembly.json.usedRealKey === false, 'assembly-plan unexpectedly used real key');
  assert(assembly.json.incurredCost === false, 'assembly-plan unexpectedly incurred cost');
  assert(assembly.json.persisted === true, 'assembly-plan was not persisted');
  assert(assembly.json.assemblyPlan.reference?.primary === 'ArcReel', 'assembly reference mismatch');
  assert(assembly.json.assemblyPlan.segmentCount === director.json.productionProject.storyboard.shotCount, 'segment count does not match storyboard shot count');
  assert(assembly.json.assemblyPlan.totalDuration >= 60, 'assembly total duration below 60 seconds');
  assert(assembly.json.assemblyPlan.segments.every(segment => segment.status === 'queued'), 'segments should start queued');
  assert(assembly.json.assemblyPlan.segments.every(segment => segment.expectedOutputs?.videoUrl === null), 'segments should not fake video URLs');
  assert(assembly.json.assemblyPlan.segments.every(segment =>
    segment.audioState?.audioCue
    && segment.audioState?.soundDesign
    && segment.expectedOutputs?.audioCue === segment.audioState.audioCue
    && typeof segment.expectedOutputs?.hasAudio !== 'undefined'
  ), 'segments missing audioState or expectedOutputs audio cue');
  assert(assembly.json.assemblyPlan.segments.slice(1).every(segment =>
    segment.expectedInputs?.audioContinuityPrompt
    && segment.expectedInputs?.previousAudioCue === null
  ), 'non-first segments should wait for previous audio cue before generation');
  assert(assembly.json.assemblyPlan.recovery?.persistEachSegment === true, 'segment persistence policy missing');
  assert(assembly.json.assemblyPlan.bridgePlan?.version === 'yh-segment-bridge-plan-v1', 'segment bridge plan missing');
  assert(assembly.json.assemblyPlan.bridgePlan.bridges.length === assembly.json.assemblyPlan.segmentCount, 'bridge count mismatch');
  assert(assembly.json.assemblyPlan.boundaryBridgePlan?.version === 'yh-boundary-bridge-plan-v1', 'boundary bridge plan missing');
  assert(assembly.json.assemblyPlan.boundaryBridgePlan.boundaries.length === Math.max(0, assembly.json.assemblyPlan.segmentCount - 1), 'boundary bridge count mismatch');
  assert(assembly.json.assemblyPlan.boundaryBridgePlan.boundaries.every(boundary =>
    boundary.previousSegmentId
    && boundary.nextSegmentId
    && boundary.bridgePrompt
    && boundary.targetOpeningContract
    && boundary.bridgeVideoUrl === null
    && boundary.newCameraImageUrl === null
  ), 'boundary bridge plan missing source/target/prompt slots');
  assert(assembly.json.assemblyPlan.readiness?.version === 'yh-assembly-readiness-v1', 'assembly readiness missing');
  assert(assembly.json.assemblyPlan.readiness.pass === true, 'assembly readiness should pass before queue');
  assert(assembly.json.assemblyPlan.readiness.blockerCount === 0, 'assembly readiness should have no blockers');
  assert(assembly.json.assemblyPlan.segments.every(segment => segment.prompt.includes('【预告片节拍】') && segment.prompt.includes('【连续性检查】')), 'segments missing trailer beat or continuity check');
  assert(assembly.json.assemblyPlan.segments.every(segment =>
    segment.prompt.includes('【观众检查点】')
    && segment.prompt.includes('【上一段画面记忆】')
    && segment.prompt.includes('【下一段触发点】')
    && segment.prompt.includes('【视觉冲突证据】')
    && segment.prompt.includes('【结尾钩子证据】')
  ), 'segments missing viewer checkpoint or frame handoff markers');
  assert(assembly.json.assemblyPlan.segments.every(segment =>
    segment.shotFrameContract?.version === 'yh-shot-frame-contract-v1'
    && segment.shotFrameContract.readiness?.pass === true
    && segment.shotFrameContract.firstFrame?.visibleCharacterIds?.length > 0
    && segment.shotFrameContract.lastFrame?.visibleCharacterIds?.length > 0
    && segment.shotFrameContract.firstFrame?.requiredAssetIds?.length >= 2
    && segment.shotFrameContract.lastFrame?.requiredAssetIds?.length >= 2
    && segment.shotFrameContract.motionDescription
    && segment.shotFrameContract.visualStoryEvidence?.conflictEvidence
    && segment.shotFrameContract.visualStoryEvidence?.endingHookEvidence
    && segment.shotFrameContract.visualStoryEvidence?.viewerReadabilityTest
  ), 'segments missing ViMAX-style shotFrameContract');
  assert(assembly.json.assemblyPlan.segments.every(segment =>
    segment.storySegmentContract?.version === 'yh-story-segment-contract-v1'
    && segment.storySegmentContract.reference?.primary === 'Toonflow-app'
    && segment.storySegmentContract.videoDesc?.visualCausality
    && segment.storySegmentContract.storyState?.currentGoal
    && segment.storySegmentContract.storyState?.visibleStateChange
    && segment.storySegmentContract.audioContract?.audioCue
    && segment.storySegmentContract.readiness?.pass === true
  ), 'segments missing Toonflow-style StorySegmentContract');
  assert(assembly.json.assemblyPlan.segments.slice(1).every(segment =>
    segment.shotFrameContract.handoff?.requiresPreviousLastFrame === true
    && segment.shotFrameContract.handoff.previousShotId
  ), 'non-first segments should require previous last frame handoff');
  assert(assembly.json.assemblyPlan.segments.slice(1).every(segment =>
    segment.storySegmentContract.dependencyContract?.requiresPreviousLastFrame === true
    && segment.storySegmentContract.audioContract?.requiresAudioContinuity === true
  ), 'non-first segments should require story/audio continuity contract');
  assert(assembly.json.assemblyPlan.bridgePlan.bridges.every(bridge =>
    bridge.viewerCheckpoint && bridge.previousFrameMemory && bridge.nextFrameTrigger
  ), 'bridge plan missing viewer checkpoint or frame handoff fields');
  assert(assembly.json.assemblyPlan.segments.slice(1).every(segment =>
    segment.expectedInputs?.boundaryBridgeId
    && segment.expectedInputs?.boundaryBridgePrompt
    && segment.expectedInputs?.bridgeStrategy === 'transition-bridge'
  ), 'non-first segments missing boundary bridge input plan');

  results.push({
    check: 'assembly-plan-create',
    ok: true,
    taskId: createdTaskId,
    segmentCount: assembly.json.assemblyPlan.segmentCount,
    totalDuration: assembly.json.assemblyPlan.totalDuration,
    bridgeCount: assembly.json.assemblyPlan.bridgePlan.bridges.length,
    boundaryBridgeCount: assembly.json.assemblyPlan.boundaryBridgePlan.boundaries.length,
    readiness: assembly.json.assemblyPlan.readiness.pass,
    shotFrameContractCount: assembly.json.assemblyPlan.segments.filter(segment => segment.shotFrameContract?.version === 'yh-shot-frame-contract-v1').length,
    storySegmentContractCount: assembly.json.assemblyPlan.segments.filter(segment => segment.storySegmentContract?.version === 'yh-story-segment-contract-v1').length,
    visualStoryEvidenceCount: assembly.json.assemblyPlan.segments.filter(segment => segment.shotFrameContract?.visualStoryEvidence?.conflictEvidence).length,
    audioStateCount: assembly.json.assemblyPlan.segments.filter(segment => segment.audioState?.audioCue).length,
    reference: assembly.json.assemblyPlan.reference.primary,
  });

  const detail = await fetchJson(`${baseUrl}/api/tasks/${createdTaskId}`);
  assert(detail.res.ok, `GET /api/tasks/{taskId} failed: ${detail.res.status}`);
  assert(detail.json.task?.result?.assemblyPlan?.version === 'yh-assembly-plan-v1', 'task result assemblyPlan missing');
  assert(detail.json.task.result.assemblyPlan.segments.length === assembly.json.assemblyPlan.segmentCount, 'persisted segment count mismatch');
  assert(detail.json.task.result.assemblyPlan.readiness?.pass === true, 'persisted assembly readiness missing');
  assert(detail.json.task.result.assemblyPlan.segments.every(segment => segment.shotFrameContract?.readiness?.pass === true), 'persisted shotFrameContract missing');

  results.push({
    check: 'assembly-plan-persisted',
    ok: true,
    taskStatus: detail.json.task.status,
    persistedSegmentCount: detail.json.task.result.assemblyPlan.segments.length,
  });

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(canvas.res.ok, `GET production canvas failed: ${canvas.res.status}`);
  const videoNode = (canvas.json.canvas?.nodes || []).find(node => node.type === 'video');
  assert(videoNode?.data?.assemblyPlan?.segmentCount === assembly.json.assemblyPlan.segmentCount, 'canvas video node missing assemblyPlan');
  assert((canvas.json.canvas?.nodes || []).some(node => node?.data?.assetKind === 'trailerBeatSheet'), 'canvas missing trailerBeatSheet node');
  const bridgeNode = (canvas.json.canvas?.nodes || []).find(node => node?.data?.assetKind === 'segmentBridgePlan');
  assert(bridgeNode, 'canvas missing segmentBridgePlan node');
  assert(String(bridgeNode?.data?.prompt || '').includes('观众检查点'), 'canvas bridge node missing viewer checkpoint prompt');

  results.push({
    check: 'assembly-plan-visible-in-canvas',
    ok: true,
    videoNodeHasAssemblyPlan: true,
    canvasNodeCount: canvas.json.canvas.nodes.length,
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
assert(leaked.length === 0, `assembly-plan probe task leak detected: ${createdTaskId}`);

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
