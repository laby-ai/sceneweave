#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: path.resolve('.env.local'), override: false, quiet: true });
loadDotenv({ override: false, quiet: true });

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.real-production-segment-smoke.lock`;
const sharedQaLockFile = `${tasksFile}.qa.lock`;
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts');
const allowRealCost = process.env.HUIYING_ALLOW_REAL_VIDEO_COST === 'true';
const generateAudio = process.env.HUIYING_REAL_VIDEO_GENERATE_AUDIO === 'true'
  || process.env.HUIYING_SMOKE_GENERATE_AUDIO === 'true';
const smokePrompt = process.env.HUIYING_SMOKE_PROMPT
  || '最后一班列车：暴雨夜，年轻急救员在空站台发现红色书包和对讲机求救，必须拦下驶向旧桥危险区的末班车。';
const smokeStyle = process.env.HUIYING_SMOKE_STYLE || '现实灾难悬疑预告片';
const smokeSceneType = process.env.HUIYING_SMOKE_SCENE_TYPE || 'drama';
const smokeRatio = process.env.HUIYING_SMOKE_RATIO || '16:9';
const ark = {
  apiBase: process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '',
  videoModel: process.env.HUIYING_REAL_ARK_VIDEO_MODEL || process.env.ARK_VIDEO_MODEL || '',
};

let lockFd = null;
let realRequestStarted = false;

function redactSensitive(value) {
  return String(value)
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(x-yh-api-key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-real-production-segment-smoke',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`真实 production segment smoke 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
}

async function waitForSharedQaLock(timeoutMs = 120000) {
  const startedAt = Date.now();
  while (fs.existsSync(sharedQaLockFile)) {
    if (Date.now() - startedAt > timeoutMs) {
      let owner = '';
      try {
        owner = fs.readFileSync(sharedQaLockFile, 'utf8');
      } catch {
        owner = '无法读取锁文件内容';
      }
      throw new Error(`等待任务 QA 锁超时：${sharedQaLockFile} ${redactSensitive(owner)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
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

function assertReadyForRealSmoke() {
  if (!allowRealCost) {
    throw new Error('缺少 HUIYING_ALLOW_REAL_VIDEO_COST=true 显式费用授权；真实 production segment smoke 已在提交前停止。');
  }
  if (!ark.apiKey) {
    throw new Error('缺少 HUIYING_REAL_ARK_API_KEY 或 ARK_API_KEY；真实 production segment smoke 已在提交前停止。');
  }
  if (!ark.videoModel) {
    throw new Error('缺少 HUIYING_REAL_ARK_VIDEO_MODEL 或 ARK_VIDEO_MODEL；真实 production segment smoke 已在提交前停止。');
  }
}

async function waitForTask(taskId, timeoutMs = 12 * 60 * 1000) {
  const startedAt = Date.now();
  const timeline = [];
  let lastKey = '';
  while (Date.now() - startedAt < timeoutMs) {
    const { response, json } = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok || !json?.task) throw new Error(`任务查询失败：HTTP ${response.status}`);
    const task = json.task;
    const key = `${task.status}:${task.progress}:${task.stage || ''}`;
    if (key !== lastKey) {
      timeline.push({
        atSec: Math.round((Date.now() - startedAt) / 1000),
        status: task.status,
        progress: task.progress,
        stage: task.stage,
      });
      lastKey = key;
    }
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return { task, elapsedMs: Date.now() - startedAt, timeline };
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error(`任务轮询超时：${Math.round(timeoutMs / 1000)}s`);
}

async function buildProductionSegmentPlan() {
  const director = await fetchJson(`${baseUrl}/api/smart/director-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: smokePrompt,
      duration: 10,
      segmentDuration: 5,
      style: smokeStyle,
      sceneType: smokeSceneType,
      ratio: smokeRatio,
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

  const firstSegment = assembly.json.assemblyPlan?.segments?.[0];
  if (!firstSegment?.shotFrameContract?.visualStoryEvidence?.conflictEvidence) {
    throw new Error('第一段缺少 visualStoryEvidence，拒绝真实 smoke。');
  }

  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: director.json.taskId }),
  });
  if (!queue.response.ok || !queue.json?.success || !queue.json.childTaskIds?.length) {
    throw new Error(`assembly queue 失败：HTTP ${queue.response.status} ${redactSensitive(JSON.stringify(queue.json || {}))}`);
  }

  return {
    parentTaskId: director.json.taskId,
    childTaskId: queue.json.childTaskIds[0],
    segmentCount: assembly.json.assemblyPlan.segmentCount,
    firstSegmentPromptPreview: String(firstSegment.prompt || '').slice(0, 600),
    visualStoryEvidence: firstSegment.shotFrameContract.visualStoryEvidence,
  };
}

async function startRealSegment(childTaskId) {
  const started = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/start`, {
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
  if (!started.response.ok || !started.json?.success) {
    throw new Error(`真实片段启动失败：HTTP ${started.response.status} ${redactSensitive(JSON.stringify(started.json || {}))}`);
  }
  realRequestStarted = true;
  return started.json;
}

async function downloadVideo(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载视频失败：HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, buffer);
  return buffer.length;
}

function parseDuration(videoPath) {
  const run = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', videoPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (run.status !== 0) {
    throw new Error(`视频时长解析失败：${redactSensitive(run.stderr || run.stdout)}`);
  }
  const json = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));
  return json.durationSeconds;
}

async function main() {
  acquireLock();
  try {
    await waitForSharedQaLock();
    assertReadyForRealSmoke();
    const plan = await buildProductionSegmentPlan();
    const start = await startRealSegment(plan.childTaskId);
    const polled = await waitForTask(plan.childTaskId);
    if (polled.task.status !== 'completed' || !polled.task.result?.videoUrl) {
      throw new Error(`真实首段未完成：${polled.task.status} ${redactSensitive(polled.task.error || '')}`);
    }

    const artifactPath = path.join(artifactsDir, `huiying-real-production-segment-smoke-${plan.childTaskId}.mp4`);
    const bytes = await downloadVideo(polled.task.result.videoUrl, artifactPath);
    const durationSeconds = parseDuration(artifactPath);

    console.log(JSON.stringify({
      ok: true,
      usedRealKey: true,
      incurredCost: true,
      parentTaskId: plan.parentTaskId,
      childTaskId: plan.childTaskId,
      providerTaskIdPresent: Boolean(polled.task.result?.providerTaskId),
      lastFrameUrlPresent: Boolean(polled.task.result?.lastFrameUrl),
      lastFrameSource: polled.task.result?.handoff?.lastFrameSource || null,
      handoffPunchThroughReady: Boolean(polled.task.result?.handoff?.punchThroughReady),
      segmentCount: plan.segmentCount,
      style: smokeStyle,
      sceneType: smokeSceneType,
      ratio: smokeRatio,
      generateAudio,
      modelConfigured: Boolean(ark.videoModel),
      elapsedSeconds: Math.round(polled.elapsedMs / 1000),
      artifactPath: path.relative(process.cwd(), artifactPath).replaceAll(path.sep, '/'),
      bytes,
      durationSeconds,
      visualStoryEvidence: plan.visualStoryEvidence,
      timeline: polled.timeline,
      note: '真实 smoke 使用 production segmentStartPayload，不使用抽象胶卷 prompt；完整视频 URL 已省略。',
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      error: redactSensitive(error instanceof Error ? error.message : String(error)),
      usedRealKey: realRequestStarted,
      incurredCost: realRequestStarted,
    }, null, 2));
    process.exit(1);
  } finally {
    releaseLock();
  }
}

main();
