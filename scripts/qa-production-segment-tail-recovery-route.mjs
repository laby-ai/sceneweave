import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
const sampleVideoUrl = `${baseUrl}/home/huiying-ark-test-clip.mp4`;
const guestWorkspace = 'guest-creation-tail-recovery-owner-20260722';
const foreignWorkspace = 'guest-creation-tail-recovery-foreign-20260722';
const owner = {
  tenantId: 'paper-host-guest',
  memberId: `guest-${createHash('sha256').update(guestWorkspace).digest('hex').slice(0, 32)}`,
};
const authHeaders = {
  'x-paper-host-embed': 'creation-agent',
  'x-paper-host-guest-workspace': guestWorkspace,
};
let lockFd = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function now() {
  return Date.now();
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

function ensureTaskDir() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
}

function acquireLock() {
  ensureTaskDir();
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-production-segment-tail-recovery-route',
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

function readTasks() {
  if (!fs.existsSync(tasksFile)) return [];
  return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
}

function writeTasks(tasks) {
  ensureTaskDir();
  const tempFile = `${tasksFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(tasks, null, 2), 'utf8');
  fs.renameSync(tempFile, tasksFile);
}

function createTask({ id, type, status, config, result, error }) {
  const timestamp = now();
  return {
    id,
    type,
    status,
    config,
    progress: status === 'completed' ? 100 : status === 'failed' ? 45 : 0,
    stage: status === 'failed' ? '等待尾帧恢复' : undefined,
    message: status === 'failed' ? '片段视频已生成，但尾帧未写回。' : undefined,
    result,
    error,
    createdAt: timestamp,
    startedAt: timestamp,
    lastUpdatedAt: timestamp,
    owner,
  };
}

async function waitForRecoveredParent(parentTaskId, timeoutMs = 12000) {
  const started = Date.now();
  let last = null;

  while (Date.now() - started < timeoutMs) {
    const detail = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(parentTaskId)}`, {
      headers: authHeaders,
    });
    if (detail.res.ok) {
      last = detail.json.task;
      const first = last?.result?.assemblyPlan?.segments?.find(segment => segment.index === 0);
      const second = last?.result?.assemblyPlan?.segments?.find(segment => segment.index === 1);
      if (first?.status === 'completed' && first?.expectedOutputs?.lastFrameUrl && second?.expectedInputs?.firstFrameUrl) {
        return last;
      }
    }
    await sleep(400);
  }

  throw new Error(`parent ${parentTaskId} did not receive recovered tail frame; last=${JSON.stringify(last)?.slice(0, 400)}`);
}

let lockAcquired = false;
let originalExists = false;
let originalContent = null;
const parentTaskId = `qa-tail-parent-${Date.now()}`;
const firstChildTaskId = `qa-tail-child-0-${Date.now()}`;
const secondChildTaskId = `qa-tail-child-1-${Date.now()}`;

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const videoProbe = await fetch(sampleVideoUrl, { method: 'GET' });
  assert(videoProbe.ok, `sample video is not reachable: ${videoProbe.status}`);
  await videoProbe.body?.cancel?.();

  const existingTasks = readTasks();
  const parentTask = createTask({
    id: parentTaskId,
    type: 'storyboard',
    status: 'failed',
    config: { prompt: 'tail recovery route QA parent' },
    result: {
      productionProject: {
        id: 'qa-route-project',
        title: 'Tail Recovery Route QA',
        ratio: '16:9',
        assets: [],
      },
      assemblyPlan: {
        version: 'qa',
        productionProjectId: 'qa-route-project',
        sourceTaskId: parentTaskId,
        totalDuration: 12,
        segmentCount: 2,
        status: 'failed',
        segments: [
          {
            id: 'route-seg-1',
            index: 0,
            shotId: 'route-shot-1',
            duration: 6,
            prompt: '第一段生成完成但尾帧缺失',
            status: 'failed',
            error: 'segment-tail-frame-missing',
            expectedInputs: {},
            expectedOutputs: {
              taskId: firstChildTaskId,
              providerTaskId: 'route-provider-1',
              videoUrl: sampleVideoUrl,
              lastFrameUrl: null,
            },
          },
          {
            id: 'route-seg-2',
            index: 1,
            shotId: 'route-shot-2',
            duration: 6,
            prompt: '第二段等待第一段尾帧作为首帧',
            status: 'queued',
            error: null,
            expectedInputs: {},
            expectedOutputs: {
              taskId: secondChildTaskId,
              providerTaskId: null,
              videoUrl: null,
              lastFrameUrl: null,
            },
          },
        ],
        recovery: { resumeFromSegmentIndex: 0 },
        nextAction: 'recover tail frame',
      },
      assemblyQueue: {
        version: 'qa',
        sourceTaskId: parentTaskId,
        status: 'failed',
        queuedSegmentCount: 2,
        childTaskIds: [firstChildTaskId, secondChildTaskId],
        updatedAt: new Date().toISOString(),
      },
    },
    error: 'segment-tail-frame-missing',
  });
  const firstChildTask = createTask({
    id: firstChildTaskId,
    type: 'video',
    status: 'failed',
    config: {
      workflow: 'production-assembly-segment',
      parentTaskId,
      assemblySegmentIndex: 0,
      ratio: '16:9',
    },
    result: {
      videoUrl: sampleVideoUrl,
      providerTaskId: 'route-provider-1',
    },
    error: 'segment-tail-frame-missing',
  });
  const secondChildTask = createTask({
    id: secondChildTaskId,
    type: 'video',
    status: 'pending',
    config: {
      workflow: 'production-assembly-segment',
      parentTaskId,
      assemblySegmentIndex: 1,
      ratio: '16:9',
    },
    result: {},
  });

  writeTasks([...existingTasks, parentTask, firstChildTask, secondChildTask]);
  await sleep(1300);

  const anonymous = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/recover-tail-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childTaskId: firstChildTaskId }),
  });
  assert(anonymous.res.status === 401, `anonymous recovery must return 401, received ${anonymous.res.status}`);

  const foreign = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/recover-tail-frame`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': foreignWorkspace,
    },
    body: JSON.stringify({ childTaskId: firstChildTaskId }),
  });
  assert(foreign.res.status === 404, `cross-member recovery must return 404, received ${foreign.res.status}`);

  const recovery = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/recover-tail-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ childTaskId: firstChildTaskId }),
  });
  assert(recovery.res.ok, `recover-tail-frame route failed: ${recovery.res.status} ${JSON.stringify(recovery.json)}`);
  assert(recovery.json.success === true, 'recover-tail-frame route should succeed');
  assert(recovery.json.usedRealKey === false, 'route recovery must not use real key');
  assert(recovery.json.incurredCost === false, 'route recovery must not incur cost');
  assert(recovery.json.nextSegmentFirstFrameUrl, 'route recovery should return next segment first frame');

  const recoveredParent = await waitForRecoveredParent(parentTaskId);
  const recoveredChild = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(firstChildTaskId)}`, {
    headers: authHeaders,
  });
  assert(recoveredChild.res.ok, `GET recovered child failed: ${recoveredChild.res.status}`);
  assert(recoveredChild.json.task.status === 'completed', 'recovered child should be completed');
  assert(recoveredChild.json.task.result?.lastFrameUrl, 'recovered child should have lastFrameUrl');
  assert(recoveredChild.json.task.result?.lastFrameExtraction?.uploaded === true, 'recovered tail frame should be transferable');

  const firstSegment = recoveredParent.result.assemblyPlan.segments.find(segment => segment.index === 0);
  const secondSegment = recoveredParent.result.assemblyPlan.segments.find(segment => segment.index === 1);
  assert(firstSegment?.status === 'completed', 'first segment should be completed after API recovery');
  assert(firstSegment?.expectedOutputs?.lastFrameUrl === recoveredChild.json.task.result.lastFrameUrl, 'parent should write back recovered lastFrameUrl');
  assert(secondSegment?.expectedInputs?.firstFrameUrl === recoveredChild.json.task.result.lastFrameUrl, 'next segment should receive firstFrameUrl');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    tasksFile,
    usedRealKey: false,
    incurredCost: false,
    parentTaskId,
    childTaskId: firstChildTaskId,
    route: '/api/production/assembly-plan/segment/recover-tail-frame',
    checks: [
      'api-recovers-tail-frame-from-partial-video',
      'child-task-completed-with-last-frame',
      'parent-segment-last-frame-writeback',
      'next-segment-first-frame-writeback',
      'anonymous-recovery-returns-401',
      'cross-member-recovery-fails-closed',
    ],
    uploadSource: recoveredChild.json.task.result.lastFrameExtraction?.uploadSource,
  }, null, 2));
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
