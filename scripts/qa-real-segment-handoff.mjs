#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: path.resolve('.env.local'), override: false, quiet: true });
loadDotenv({ override: false, quiet: true });

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'Usage: pnpm run qa:real-segment-handoff',
    '',
    'Runs a real multi-segment Ark handoff QA only when all required env gates are present.',
    '',
    'Required env:',
    '  HUIYING_ALLOW_REAL_VIDEO_COST=true',
    '  HUIYING_REAL_ARK_API_KEY or ARK_API_KEY',
    '  HUIYING_REAL_ARK_VIDEO_MODEL or ARK_VIDEO_MODEL',
    '',
    'Optional env:',
    '  HUIYING_REAL_ARK_API_BASE',
    '  HUIYING_HANDOFF_SECONDS',
    '  HUIYING_HANDOFF_SEGMENT_SECONDS',
    '  HUIYING_HANDOFF_SEGMENT_LIMIT',
    '  HUIYING_HANDOFF_PROMPT',
    '  HUIYING_HANDOFF_GENERATE_AUDIO=true',
    '',
    'Safety:',
    '  --help and -h never start a real request or acquire the real-run lock.',
  ].join('\n'));
  process.exit(0);
}

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.real-segment-handoff.lock`;
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts');
const allowRealCost = process.env.HUIYING_ALLOW_REAL_VIDEO_COST === 'true';
const requestedSeconds = clampNumber(Number(process.env.HUIYING_HANDOFF_SECONDS || '12'), 10, 30);
const segmentDuration = clampNumber(Number(process.env.HUIYING_HANDOFF_SEGMENT_SECONDS || '6'), 5, 10);
const requestedSegmentLimit = clampNumber(Number(process.env.HUIYING_HANDOFF_SEGMENT_LIMIT || '2'), 2, 5);
const generateAudio = process.env.HUIYING_HANDOFF_GENERATE_AUDIO === 'true';
const handoffStyle = process.env.HUIYING_HANDOFF_STYLE || '现实悬疑预告片';
const handoffSceneType = process.env.HUIYING_HANDOFF_SCENE_TYPE || 'drama';
const handoffRatio = process.env.HUIYING_HANDOFF_RATIO || '16:9';

const ark = {
  apiBase: process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '',
  videoModel: process.env.HUIYING_REAL_ARK_VIDEO_MODEL || process.env.ARK_VIDEO_MODEL || '',
};
const storageConfig = {
  endpointUrl: process.env.HUIYING_OBJECT_STORAGE_ENDPOINT_URL || '',
  bucketName: process.env.HUIYING_OBJECT_STORAGE_BUCKET_NAME || '',
  accessKeyId: process.env.HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY || '',
};
const publicFrameBaseUrl = process.env.HUIYING_PUBLIC_ASSET_BASE_URL || process.env.HUIYING_PROJECT_DOMAIN_DEFAULT || '';
const base64FrameHandoffReady = String(process.env.HUIYING_DISABLE_BASE64_FRAME_HANDOFF || '').trim().toLowerCase() !== 'true';

const prompt = process.env.HUIYING_HANDOFF_PROMPT || [
  '极简现实悬疑预告片：雨夜便利店只剩一个年轻店员。',
  '柜台上的红色计时器突然从60秒倒数，门外有人敲门。',
  '第一段必须交代店员、红色计时器和门外敲门声；第二段必须直接承接第一段最后画面，店员拿起计时器冲向门口，计时器归零前门缝透出强光。',
].join('');

let lockFd = null;
let realRequestStarted = false;

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function redactSensitive(value) {
  return String(value)
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(x-yh-api-key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

function isPublicHttpsUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return ![
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^169\.254\./,
      /^172\.(1[6-9]|2\d|3[0-1])\./,
      /^0\.0\.0\.0$/,
      /^\[?::1\]?$/,
      /^\[?fc[0-9a-f]{2}:/i,
      /^\[?fd[0-9a-f]{2}:/i,
    ].some(pattern => pattern.test(url.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-real-segment-handoff',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`真实分段 handoff QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
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

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${redactSensitive(text.slice(0, 240))}`);
  }
  return { response, json };
}

function runDurationProbe(filePath) {
  const result = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', filePath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`媒体时长解析失败：${result.stderr || result.stdout}`);
  }
  const text = result.stdout.slice(result.stdout.indexOf('{'));
  return JSON.parse(text).durationSeconds;
}

function runTrackProbe(filePath) {
  const result = spawnSync(process.execPath, ['scripts/check-mp4-tracks.mjs', filePath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`媒体音轨解析失败：${result.stderr || result.stdout}`);
  }
  const text = result.stdout.slice(result.stdout.indexOf('{'));
  return JSON.parse(text);
}

async function pollTask(taskId, timeoutMs = 12 * 60 * 1000) {
  const startedAt = Date.now();
  const timeline = [];
  let lastSignature = '';

  while (Date.now() - startedAt < timeoutMs) {
    const { response, json } = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) {
      throw new Error(`任务查询失败 ${taskId}: HTTP ${response.status}`);
    }
    const task = json?.task;
    if (!task) throw new Error(`任务查询未返回 task: ${taskId}`);

    const signature = `${task.status}|${task.progress}|${task.stage}`;
    if (signature !== lastSignature) {
      timeline.push({
        atSec: Math.round((Date.now() - startedAt) / 1000),
        status: task.status,
        progress: task.progress,
        stage: task.stage,
      });
      lastSignature = signature;
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return { task, elapsedMs: Date.now() - startedAt, timeline };
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error(`任务轮询超时 ${taskId}: ${Math.round(timeoutMs / 1000)}s`);
}

async function downloadVideo(url, targetPath) {
  const resolvedUrl = new URL(url, baseUrl).toString();
  const response = await fetch(resolvedUrl);
  if (!response.ok) throw new Error(`下载视频失败：HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, buffer);
  return buffer.length;
}

async function buildProductionPlan() {
  const director = await fetchJson(`${baseUrl}/api/smart/director-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: requestedSeconds,
      segmentDuration,
      style: handoffStyle,
      sceneType: handoffSceneType,
      ratio: handoffRatio,
    }),
  });
  if (!director.response.ok || !director.json?.success) {
    throw new Error(`导演链路失败：HTTP ${director.response.status} ${redactSensitive(JSON.stringify(director.json || {}))}`);
  }

  await new Promise(resolve => setTimeout(resolve, 1200));

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: director.json.taskId, persist: true }),
  });
  if (!assembly.response.ok || !assembly.json?.success) {
    throw new Error(`assembly-plan 失败：HTTP ${assembly.response.status} ${redactSensitive(JSON.stringify(assembly.json || {}))}`);
  }

  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: director.json.taskId }),
  });
  if (!queue.response.ok || !queue.json?.success) {
    throw new Error(`assembly queue 失败：HTTP ${queue.response.status} ${redactSensitive(JSON.stringify(queue.json || {}))}`);
  }

  return {
    parentTaskId: director.json.taskId,
    productionProject: director.json.productionProject,
    initialSegmentCount: assembly.json.assemblyPlan.segmentCount,
    childTaskIds: queue.json.childTaskIds,
  };
}

async function startRealSegment(childTaskId) {
  const response = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': ark.apiBase,
      'x-yh-api-key': ark.apiKey,
      'x-yh-video-model': ark.videoModel,
    },
    body: JSON.stringify({
      childTaskId,
      dryRun: false,
      allowRealCost: true,
      generateAudio,
    }),
  });
  if (!response.response.ok || !response.json?.success) {
    throw new Error(`真实片段启动失败：HTTP ${response.response.status} ${redactSensitive(JSON.stringify(response.json || {}))}`);
  }
  realRequestStarted = true;
  return response.json;
}

async function getParentTask(parentTaskId) {
  const { response, json } = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(parentTaskId)}`);
  if (!response.ok || !json?.task) throw new Error(`父任务查询失败：HTTP ${response.status}`);
  return json.task;
}

function segmentSummary(task, index) {
  const segment = task.result?.assemblyPlan?.segments?.find(item => item.index === index);
  if (!segment) throw new Error(`父任务缺少 segment ${index}`);
  return {
    index,
    status: segment.status,
    videoUrlPresent: Boolean(segment.expectedOutputs?.videoUrl),
    lastFrameUrlPresent: Boolean(segment.expectedOutputs?.lastFrameUrl),
    providerTaskIdPresent: Boolean(segment.expectedOutputs?.providerTaskId),
    firstFrameUrlPresent: Boolean(segment.expectedInputs?.firstFrameUrl),
    firstFrameMatchesPrevious: index === 0
      ? null
      : segment.expectedInputs?.firstFrameUrl === task.result.assemblyPlan.segments[index - 1]?.expectedOutputs?.lastFrameUrl,
    sourceSegmentId: segment.expectedInputs?.sourceSegmentId || null,
    sourceAssetId: segment.expectedInputs?.sourceAssetId || null,
  };
}

function computePunchThroughMetrics({ children, segmentSnapshots }) {
  const totalSegments = children.length;
  const generated = children.filter(child => child.status === 'completed' && child.segmentResult?.videoUrl).length;
  const tailAcquired = children.filter(child => child.segmentResult?.lastFrameUrl).length;
  const tailWritten = segmentSnapshots.filter(segment => segment.lastFrameUrlPresent).length;
  const downstreamSegments = segmentSnapshots.filter(segment => segment.index > 0);
  const firstFrameUsed = downstreamSegments.filter(segment => (
    segment.firstFrameUrlPresent && segment.firstFrameMatchesPrevious
  )).length;
  return {
    generatedSegmentRate: totalSegments ? Number((generated / totalSegments).toFixed(3)) : 0,
    tailFrameAcquisitionRate: totalSegments ? Number((tailAcquired / totalSegments).toFixed(3)) : 0,
    tailFrameWritebackRate: totalSegments ? Number((tailWritten / totalSegments).toFixed(3)) : 0,
    nextSegmentFirstFrameUsageRate: downstreamSegments.length
      ? Number((firstFrameUsed / downstreamSegments.length).toFixed(3))
      : 0,
    generatedSegments: generated,
    tailFramesAcquired: tailAcquired,
    tailFramesWritten: tailWritten,
    nextSegmentsUsingPreviousTailFrame: firstFrameUsed,
    downstreamSegmentCount: downstreamSegments.length,
    segmentCount: totalSegments,
  };
}

function safeSegmentResult(result) {
  if (!result || typeof result !== 'object') return null;
  return {
    index: result.index,
    taskId: result.taskId || null,
    providerTaskIdPresent: Boolean(result.providerTaskId),
    status: result.status || null,
    videoUrlPresent: Boolean(result.videoUrl),
    lastFrameUrlPresent: Boolean(result.lastFrameUrl),
    lastFrameUrlKind: typeof result.lastFrameUrl === 'string' && result.lastFrameUrl.startsWith('data:')
      ? 'data-url'
      : result.lastFrameUrl ? 'url' : null,
    lastFrameSource: result.lastFrameSource || null,
  };
}

async function main() {
  acquireLock();
  try {
    if (!allowRealCost) throw new Error('缺少 HUIYING_ALLOW_REAL_VIDEO_COST=true 显式费用授权');
    if (!ark.apiKey || !ark.videoModel) throw new Error('缺少本地 Ark API Key 或视频模型配置');
    const missingStorage = Object.entries(storageConfig)
      .filter(([, value]) => !value)
      .map(([key]) => ({
        endpointUrl: 'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
        bucketName: 'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
        accessKeyId: 'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
        secretAccessKey: 'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
      })[key]);
    const objectStorageReady = missingStorage.length === 0;
    const publicFrameReady = isPublicHttpsUrl(publicFrameBaseUrl);
    if (!objectStorageReady && !publicFrameReady && !base64FrameHandoffReady) {
      throw new Error(`缺少可用尾帧回传通道：对象存储缺少 ${missingStorage.join(', ')}，HUIYING_PUBLIC_ASSET_BASE_URL 不是 HTTPS 公网地址，且 base64 frame handoff 被禁用；真实分段 handoff 已在提交视频前停止。`);
    }

    const plan = await buildProductionPlan();
    const segmentLimit = Math.min(requestedSegmentLimit, plan.childTaskIds.length);
    if (segmentLimit < 2) {
      throw new Error(`需要至少 2 个片段子任务，实际 ${plan.childTaskIds.length}`);
    }

    const childIds = plan.childTaskIds.slice(0, segmentLimit);
    const starts = [];
    const children = [];
    const segmentSnapshots = [];

    for (const [order, childTaskId] of childIds.entries()) {
      if (order > 0) {
        const parentBeforeStart = await getParentTask(plan.parentTaskId);
        const beforeStart = segmentSummary(parentBeforeStart, order);
        if (!beforeStart.firstFrameUrlPresent || !beforeStart.firstFrameMatchesPrevious) {
          throw new Error(`第 ${order + 1} 段启动前未承接上一段尾帧：${JSON.stringify(beforeStart)}`);
        }
      }

      starts.push(await startRealSegment(childTaskId));
      const finished = await pollTask(childTaskId);
      if (finished.task.status !== 'completed') {
        throw new Error(`第 ${order + 1} 段未完成：${finished.task.status} ${redactSensitive(finished.task.error || '')}`);
      }

      const parentAfterSegment = await getParentTask(plan.parentTaskId);
      segmentSnapshots.push(segmentSummary(parentAfterSegment, order));
      const nextIndex = order + 1;
      if (nextIndex < childIds.length) {
        const nextSnapshot = segmentSummary(parentAfterSegment, nextIndex);
        if (!nextSnapshot.firstFrameUrlPresent || !nextSnapshot.firstFrameMatchesPrevious) {
          throw new Error(`第 ${order + 1} 段尾帧未写入第 ${nextIndex + 1} 段首帧：${JSON.stringify(nextSnapshot)}`);
        }
      }

      const videoUrl = finished.task.result?.videoUrl;
      if (!videoUrl) throw new Error(`第 ${order + 1} 段缺少 videoUrl`);
      const artifactPath = path.join(artifactsDir, `huiying-handoff-segment-${order + 1}-${childTaskId}.mp4`);
      const bytes = await downloadVideo(videoUrl, artifactPath);
      const trackProbe = runTrackProbe(artifactPath);
      if (generateAudio && !trackProbe.hasAudio) {
        throw new Error(`第 ${order + 1} 段请求了有声生成，但产物没有音轨。`);
      }
      children.push({
        childTaskId,
        status: finished.task.status,
        elapsedSeconds: Math.round(finished.elapsedMs / 1000),
        artifactPath,
        bytes,
        durationSeconds: runDurationProbe(artifactPath),
        hasAudio: trackProbe.hasAudio,
        audioTrackCount: trackProbe.audioTrackCount,
        videoTrackCount: trackProbe.videoTrackCount,
        timeline: finished.timeline,
        segmentResult: finished.task.result?.segments?.[0] || null,
      });
    }

    const parentAfterSecond = await getParentTask(plan.parentTaskId);
    const punchThroughMetrics = computePunchThroughMetrics({
      children,
      segmentSnapshots,
    });

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      usedRealKey: true,
      incurredCost: true,
      requestedSeconds,
      segmentDuration,
      segmentLimit,
      generateAudio,
      style: handoffStyle,
      sceneType: handoffSceneType,
      ratio: handoffRatio,
      parentTaskId: plan.parentTaskId,
      productionProjectId: plan.productionProject?.id,
      initialSegmentCount: plan.initialSegmentCount,
      childTaskIds: childIds,
      starts: starts.map(item => ({
        childTaskId: item.childTaskId,
        segmentIndex: item.segmentIndex,
        duration: item.duration,
        usedRealKey: item.usedRealKey,
        incurredCost: item.incurredCost,
      })),
      handoffEvidence: {
        channel: objectStorageReady ? 'object-storage' : publicFrameReady ? 'public-frame-handoff' : 'base64-data-url',
        segmentSnapshots,
        finalParentStatus: parentAfterSecond.status,
      },
      punchThroughMetrics,
      children: children.map(child => ({
        ...child,
        segmentResult: safeSegmentResult(child.segmentResult),
      })),
    }, null, 2));
  } finally {
    releaseLock();
  }
}

main().catch(error => {
  releaseLock();
  console.error(JSON.stringify({
    ok: false,
    error: redactSensitive(error instanceof Error ? error.message : String(error)),
    usedRealKey: realRequestStarted,
    incurredCost: realRequestStarted,
  }, null, 2));
  process.exit(1);
});
