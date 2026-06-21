import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
const sampleVideoUrl = `${baseUrl}/home/huiying-ark-test-clip.mp4`;
const session = `huiying-tail-ui-${Date.now()}`;
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
  const res = await fetchWithRetry(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

async function fetchWithRetry(url, options, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (res.ok || attempt === attempts) return res;
      await res.body?.cancel?.();
    } catch (error) {
      lastError = error;
    }
    await sleep(250 * attempt);
  }
  throw lastError;
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
      script: 'qa-node-editor-tail-recovery-ui',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`节点尾帧恢复 UI QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
}

function readTasks() {
  if (!fs.existsSync(tasksFile)) return [];
  return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
}

function writeTasks(tasks) {
  ensureTaskDir();
  const tempFile = `${tasksFile}.tail-ui.${process.pid}.${Date.now()}.tmp`;
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
  };
}

function shotFrameContract(index, shotId) {
  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId,
    shotIndex: index,
    variationType: index === 0 ? 'large' : 'medium',
    variationReason: 'UI QA continuity fixture',
    firstFrame: {
      description: '角色进入车站，红色书包可见',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-1', 'prop-1'],
      continuityAnchors: ['红色书包', '暴雨站台'],
    },
    lastFrame: {
      description: '角色举起红色书包，画面停在车厢门口',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-1', 'prop-1'],
      continuityAnchors: ['红色书包', '车厢门口'],
    },
    motionDescription: '角色从站台冲向车厢门口',
    audioDescription: '无声 QA',
    visualStoryEvidence: {
      threatTarget: '最后一班列车',
      conflictEvidence: '暴雨和旧桥警报',
      operationResultEvidence: '红色书包被举起',
      endingHookEvidence: '车门即将关闭',
      viewerReadabilityTest: '不看字幕也能看见角色、道具、目标和下一段钩子。',
    },
    handoff: {
      requiresPreviousLastFrame: index > 0,
      previousShotId: index > 0 ? 'shot-1' : null,
      nextShotId: index === 0 ? 'shot-2' : null,
      entryContinuity: '承接上一段尾帧',
      exitContinuity: '尾帧作为下一段首帧',
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  };
}

function buildProductionProject(parentTaskId) {
  return {
    id: 'qa-tail-ui-project',
    title: 'Tail Recovery UI QA',
    prompt: '最后一班列车尾帧恢复 UI QA',
    style: '现实悬疑短剧',
    ratio: '16:9',
    sceneType: 'drama',
    duration: 12,
    segmentDuration: 6,
    narrativeSummary: '急救员在暴雨车站追上最后一班列车。',
    storyBible: {
      premise: '暴雨夜，急救员必须把红色书包交上最后一班列车。',
      protagonist: '年轻急救员',
      desire: '赶上最后一班列车',
      obstacle: '旧桥警报和关闭的车门',
      relationship: '急救员与暴雨车站',
      conflict: '列车即将关闭，书包必须交出',
      turningPoint: '红色书包被举起',
      endingHook: '车门边出现新的求救信号',
      emotionalArc: { start: '紧张', shift: '决断', end: '悬念' },
      continuityRules: ['红色书包始终可见', '暴雨车站保持一致'],
      beats: [],
    },
    semanticPlan: {
      version: 'yh-production-semantic-plan-v1',
      source: 'video-production-v3-merged',
      reference: {
        primary: 'ViMax',
        secondary: ['Toonflow-app', 'ArcReel'],
        adaptedIdeas: [],
      },
      writerOutput: {},
      directorOutput: {},
      characterBibles: [{ id: 'character-bible-1', characterId: 'character-1', name: '年轻急救员', version: 1 }],
      sceneBibles: [{ id: 'scene-bible-1', name: '暴雨车站', version: 1 }],
      shotList: { shots: [] },
      dag: { nodes: [] },
      assetLinks: {
        characterAssetIds: ['character-1'],
        sceneAssetIds: ['scene-1'],
        storyboardAssetId: 'storyboard-1',
        deliverableAssetId: 'deliverable-1',
      },
    },
    assets: [
      { id: 'character-1', kind: 'character', name: '年轻急救员', status: 'ready', summary: '主角', source: 'prompt' },
      { id: 'scene-1', kind: 'scene', name: '暴雨车站', status: 'ready', summary: '主场景', source: 'prompt' },
      { id: 'prop-1', kind: 'prop', name: '红色书包', status: 'ready', summary: '关键道具', source: 'prompt' },
      { id: 'storyboard-1', kind: 'storyboard', name: '两段分镜', status: 'ready', summary: '尾帧恢复 QA 分镜', source: 'storyboard' },
    ],
    stages: [],
    graph: { nodes: [], edges: [] },
    storyboard: {
      shotCount: 2,
      totalDuration: 12,
      shots: [
        {
          id: 'shot-1',
          index: 0,
          duration: 6,
          storyBeat: 'setup',
          dramaticPurpose: '建立主角目标',
          emotionShift: '紧张',
          prompt: '急救员冲向暴雨车站，红色书包可见。',
          status: 'ready',
        },
        {
          id: 'shot-2',
          index: 1,
          duration: 6,
          storyBeat: 'turning',
          dramaticPurpose: '承接尾帧推进转折',
          emotionShift: '决断',
          prompt: '车厢门口承接红色书包尾帧。',
          status: 'planned',
        },
      ],
    },
    output: {
      status: 'running',
      taskId: parentTaskId,
      canProceedToVideo: true,
      nextStep: 'recover tail frame',
    },
    suggestions: { subtitle: {}, narration: {} },
  };
}

function buildAssemblyPlan(parentTaskId, firstChildTaskId, secondChildTaskId) {
  return {
    version: 'yh-assembly-plan-v1',
    reference: { primary: 'ArcReel', adaptedIdeas: ['recover partial segment tail frame'] },
    productionProjectId: 'qa-tail-ui-project',
    sourceTaskId: parentTaskId,
    totalDuration: 12,
    segmentCount: 2,
    segmentDurationHint: 6,
    status: 'failed',
    readiness: {
      version: 'yh-assembly-readiness-v1',
      pass: true,
      checkedAt: new Date().toISOString(),
      source: 'shot-frame-contract',
      blockerCount: 0,
      warningCount: 0,
      issues: [],
      nextAction: 'recover tail frame',
    },
    segments: [
      {
        id: 'route-seg-1',
        index: 0,
        shotId: 'shot-1',
        duration: 6,
        prompt: '第一段生成完成但尾帧缺失',
        status: 'failed',
        error: 'segment-tail-frame-missing',
        dependencies: {
          characterAssetIds: ['character-1'],
          sceneAssetIds: ['scene-1'],
          propAssetIds: ['prop-1'],
        },
        expectedInputs: {
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceSegmentId: null,
          sourceAssetId: null,
          continuityPrompt: null,
        },
        expectedOutputs: {
          taskId: firstChildTaskId,
          providerTaskId: 'ui-provider-1',
          videoUrl: sampleVideoUrl,
          lastFrameUrl: null,
        },
        shotFrameContract: shotFrameContract(0, 'shot-1'),
        retryPolicy: { maxRetries: 2, retryable: true, fallback: 'recover-tail-frame' },
      },
      {
        id: 'route-seg-2',
        index: 1,
        shotId: 'shot-2',
        duration: 6,
        prompt: '第二段等待第一段尾帧作为首帧',
        status: 'queued',
        error: null,
        dependencies: {
          characterAssetIds: ['character-1'],
          sceneAssetIds: ['scene-1'],
          propAssetIds: ['prop-1'],
        },
        expectedInputs: {
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceSegmentId: 'route-seg-1',
          sourceAssetId: null,
          continuityPrompt: '接第一段尾帧',
        },
        expectedOutputs: {
          taskId: secondChildTaskId,
          providerTaskId: null,
          videoUrl: null,
          lastFrameUrl: null,
        },
        shotFrameContract: shotFrameContract(1, 'shot-2'),
        retryPolicy: { maxRetries: 2, retryable: true, fallback: 'retry-segment' },
      },
    ],
    assembly: {
      strategy: 'ordered-concat',
      requiresAllSegments: true,
      outputUrl: null,
      exportFormats: ['mp4', 'cut-draft-json'],
    },
    recovery: {
      persistEachSegment: true,
      resumeFromSegmentIndex: 0,
      canRetryFailedSegments: true,
      failurePolicy: 'recover partial segment tail frame before retry',
    },
    nextAction: 'recover tail frame',
  };
}

function cmdQuote(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function cmdArg(value) {
  const text = String(value);
  return /[\s&|<>^()]/.test(text) ? cmdQuote(text) : text;
}

function runPlaywright(args) {
  const cliArgs = ['--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args];
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/c', `npx ${cliArgs.map(cmdArg).join(' ')}`]
    : cliArgs;
  return execFileSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });
}

async function waitForParentWriteback(parentTaskId, timeoutMs = 12000) {
  const started = Date.now();
  let lastTask = null;
  while (Date.now() - started < timeoutMs) {
    const parentDetail = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(parentTaskId)}`);
    if (parentDetail.res.ok) {
      lastTask = parentDetail.json.task;
      const firstSegment = lastTask?.result?.assemblyPlan?.segments?.find(segment => segment.index === 0);
      const secondSegment = lastTask?.result?.assemblyPlan?.segments?.find(segment => segment.index === 1);
      if (firstSegment?.status === 'completed'
        && firstSegment?.expectedOutputs?.lastFrameUrl
        && secondSegment?.expectedInputs?.firstFrameUrl === firstSegment.expectedOutputs.lastFrameUrl) {
        return { task: lastTask, firstSegment, secondSegment };
      }
    }
    await sleep(500);
  }
  const segments = lastTask?.result?.assemblyPlan?.segments?.map(segment => ({
    index: segment.index,
    status: segment.status,
    error: segment.error,
    videoUrlPresent: Boolean(segment.expectedOutputs?.videoUrl),
    lastFramePresent: Boolean(segment.expectedOutputs?.lastFrameUrl),
    firstFramePresent: Boolean(segment.expectedInputs?.firstFrameUrl),
    taskId: segment.expectedOutputs?.taskId,
  }));
  throw new Error(`DOM click did not write parent handoff in time; segments=${JSON.stringify(segments)}`);
}

let lockAcquired = false;
let originalExists = false;
let originalContent = null;
const parentTaskId = `qa-tail-ui-parent-${Date.now()}`;
const firstChildTaskId = `qa-tail-ui-child-0-${Date.now()}`;
const secondChildTaskId = `qa-tail-ui-child-1-${Date.now()}`;

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const health = await fetchJson(`${baseUrl}/api/health`).catch(() => null);
  assert(!health || health.res.ok, 'local service health check failed');
  const videoProbe = await fetchWithRetry(sampleVideoUrl);
  assert(videoProbe.ok, `sample video is not reachable: ${videoProbe.status}`);
  await videoProbe.body?.cancel?.();

  const existingTasks = readTasks();
  writeTasks([
    ...existingTasks,
    createTask({
      id: parentTaskId,
      type: 'storyboard',
      status: 'failed',
      config: { prompt: 'tail recovery UI QA parent' },
      result: {
        productionProject: buildProductionProject(parentTaskId),
        assemblyPlan: buildAssemblyPlan(parentTaskId, firstChildTaskId, secondChildTaskId),
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
    }),
    createTask({
      id: firstChildTaskId,
      type: 'video',
      status: 'failed',
      config: {
        workflow: 'production-assembly-segment',
        parentTaskId,
        assemblySegmentIndex: 0,
        ratio: '16:9',
      },
      result: { videoUrl: sampleVideoUrl, providerTaskId: 'ui-provider-1' },
      error: 'segment-tail-frame-missing',
    }),
    createTask({
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
    }),
  ]);

  await sleep(1300);

  const targetUrl = `${baseUrl}/node-editor?taskId=${encodeURIComponent(parentTaskId)}`;
  runPlaywright(['open', targetUrl]);
  await sleep(5000);
  const browserResult = runPlaywright(['snapshot']);
  assert(browserResult.includes(parentTaskId), 'node editor snapshot should show the target production task id');
  assert(browserResult.includes('恢复尾帧'), 'node editor snapshot should render the recover-tail-frame action');

  const recovery = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/recover-tail-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childTaskId: firstChildTaskId }),
  });
  assert(recovery.res.ok, `recover-tail-frame API failed after DOM render: ${recovery.res.status}`);
  assert(recovery.json?.success === true, 'recover-tail-frame API should succeed after DOM render');
  runPlaywright(['close']);

  const { firstSegment, secondSegment } = await waitForParentWriteback(parentTaskId);
  assert(firstSegment?.status === 'completed', 'DOM click should complete first segment');
  assert(firstSegment?.expectedOutputs?.lastFrameUrl, 'DOM click should write first segment lastFrameUrl');
  assert(secondSegment?.expectedInputs?.firstFrameUrl === firstSegment.expectedOutputs.lastFrameUrl, 'DOM click should write next segment firstFrameUrl');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    taskId: parentTaskId,
    childTaskId: firstChildTaskId,
    usedRealKey: false,
    incurredCost: false,
    browserSnapshot: browserResult.trim().slice(0, 500),
    checks: [
      'node-editor-renders-recover-tail-frame-action',
      'recover-tail-frame-api-called-after-dom-render',
      'recover-action-api-writes-parent-last-frame',
      'recover-action-api-writes-next-first-frame',
    ],
  }, null, 2));
} finally {
  try {
    runPlaywright(['close']);
  } catch {
    // Browser may already be closed.
  }
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
