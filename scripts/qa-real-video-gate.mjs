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
const gateLockFile = `${tasksFile}.real-video-gate.lock`;
const sharedQaLockFile = `${tasksFile}.qa.lock`;
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts');
const allowRealCost = process.env.HUIYING_ALLOW_REAL_VIDEO_COST === 'true';
const requestedSeconds = clampNumber(Number(process.env.HUIYING_REAL_VIDEO_SECONDS || '5'), 5, 70);
const maxAllowedSeconds = clampNumber(Number(process.env.HUIYING_REAL_VIDEO_MAX_SECONDS || '10'), 5, 70);
const generateAudio = process.env.HUIYING_REAL_VIDEO_GENERATE_AUDIO === 'true';
const smokePrompt = process.env.HUIYING_REAL_VIDEO_PROMPT || [
  '现实悬疑短剧片段：深夜地铁末班车即将关门，年轻急救员发现座椅下红色书包里传出微弱呼救声，',
  '她蹲下拉开拉链，车厢广播突然提示前方隧道封锁，远处灯光连续闪烁。镜头必须清楚呈现人物目标、',
  '危险提示、红色书包和下一秒要冲向车门的动作。需要真实环境声：列车低鸣、广播提示音、拉链声和急促呼吸。'
].join('');

const ark = {
  apiBase: process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '',
  videoModel: process.env.HUIYING_REAL_ARK_VIDEO_MODEL || process.env.ARK_VIDEO_MODEL || '',
};

let lockFd = null;

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function acquireGateLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(gateLockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-real-video-gate',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`真实视频门控正在运行或上次异常退出未清理锁文件：${gateLockFile}`);
  }
}

function releaseGateLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(gateLockFile)) {
    fs.rmSync(gateLockFile, { force: true });
  }
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

function runLocalScript(label, runner, scriptPath, args = [], displayArgs = args) {
  const result = spawnSync(runner, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1024 * 1024 * 8,
  });

  return {
    command: `${label}${displayArgs.length ? ` -- ${displayArgs.join(' ')}` : ''}`,
    status: result.status,
    ok: result.status === 0,
    stdout: redactSensitive(result.stdout || ''),
    stderr: redactSensitive(result.stderr || ''),
  };
}

function runNodeScript(scriptPath, args = []) {
  return runLocalScript(`node ${scriptPath}`, process.execPath, scriptPath, args);
}

function runTsxScript(scriptPath, args = []) {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  return runLocalScript(`tsx ${scriptPath}`, process.execPath, tsxCli, [scriptPath, ...args], args);
}

function summarizeCommand(run) {
  const stdoutTail = run.stdout.trim().split(/\r?\n/).slice(-12).join('\n');
  const stderrTail = run.stderr.trim().split(/\r?\n/).slice(-8).join('\n');
  return {
    command: run.command,
    ok: run.ok,
    status: run.status,
    stdoutTail,
    stderrTail,
  };
}

function redactSensitive(value) {
  return String(value)
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(x-yh-api-key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
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

async function pollTask(taskId, timeoutMs = 12 * 60 * 1000) {
  const startedAt = Date.now();
  const timeline = [];
  let lastStatus = null;
  let lastProgress = null;
  let firstNotFoundAt = null;

  while (Date.now() - startedAt < timeoutMs) {
    const { response, json } = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) {
      if (response.status === 404) {
        firstNotFoundAt ||= Date.now();
        timeline.push({
          atSec: Math.round((Date.now() - startedAt) / 1000),
          status: 'not-found-yet',
          progress: null,
          stage: '任务已提交，等待任务中心持久化可读',
          segmentCount: null,
        });
        if (Date.now() - firstNotFoundAt <= 60 * 1000) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
      }
      throw new Error(`任务查询失败：HTTP ${response.status}`);
    }
    firstNotFoundAt = null;

    const task = json?.task;
    if (!task) throw new Error('任务查询未返回 task');

    if (task.status !== lastStatus || task.progress !== lastProgress) {
      timeline.push({
        atSec: Math.round((Date.now() - startedAt) / 1000),
        status: task.status,
        progress: task.progress,
        stage: task.stage,
        segmentCount: task.result?.segments?.length,
      });
      lastStatus = task.status;
      lastProgress = task.progress;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return { task, elapsedMs: Date.now() - startedAt, timeline };
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error(`任务轮询超时：${Math.round(timeoutMs / 1000)}s`);
}

async function downloadVideo(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载视频失败：HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, buffer);
  return buffer.length;
}

function parseDurationFromRun(run) {
  const text = run.stdout.trim();
  const firstJson = text.slice(text.indexOf('{'));
  const json = JSON.parse(firstJson);
  return json.durationSeconds;
}

function parseJsonFromRun(run) {
  const text = run.stdout.trim();
  const firstJson = text.slice(text.indexOf('{'));
  return JSON.parse(firstJson);
}

async function runRealArkStep() {
  const effectiveSeconds = Math.min(requestedSeconds, maxAllowedSeconds);

  const submit = await fetchJson(`${baseUrl}/api/video/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': ark.apiBase,
      'x-yh-api-key': ark.apiKey,
      'x-yh-video-model': ark.videoModel,
    },
    body: JSON.stringify({
      prompt: smokePrompt,
      duration: effectiveSeconds,
      ratio: '16:9',
      resolution: '720p',
      watermark: false,
      videoModel: ark.videoModel,
      backgroundBgm: 'none',
      enableSubtitle: false,
      generateAudio,
      generateVoice: false,
    }),
  });

  if (!submit.response.ok || !submit.json?.taskId) {
    throw new Error(`真实 Ark 提交失败：HTTP ${submit.response.status} ${redactSensitive(JSON.stringify(submit.json || {}))}`);
  }

  const taskId = submit.json.taskId;
  const polled = await pollTask(taskId);
  const task = polled.task;
  const videoUrl = task.result?.videoUrl;
  const segmentUrls = Array.isArray(task.result?.segments)
    ? task.result.segments.map(segment => segment?.videoUrl).filter(Boolean)
    : [];

  if (task.status !== 'completed' || !videoUrl) {
    return {
      ok: false,
      taskId,
      status: task.status,
      progress: task.progress,
      stage: task.stage,
      error: task.error,
      elapsedSeconds: Math.round(polled.elapsedMs / 1000),
      timeline: polled.timeline,
      segmentCount: segmentUrls.length,
    };
  }

  const artifactPath = path.join(artifactsDir, `huiying-real-ark-${effectiveSeconds}s-${taskId}.mp4`);
  const bytes = await downloadVideo(videoUrl, artifactPath);
  const durationRun = runNodeScript('scripts/check-video-duration.mjs', [artifactPath]);
  if (!durationRun.ok) {
    throw new Error(`真实视频已下载但时长解析失败：${durationRun.stderr || durationRun.stdout}`);
  }
  const trackRun = runNodeScript('scripts/check-mp4-tracks.mjs', [artifactPath]);
  if (!trackRun.ok) {
    throw new Error(`真实视频已下载但音视频轨道解析失败：${trackRun.stderr || trackRun.stdout}`);
  }
  const tracks = parseJsonFromRun(trackRun);

  return {
    ok: true,
    taskId,
    requestedSeconds: effectiveSeconds,
    generateAudio,
    promptSummary: smokePrompt.slice(0, 120),
    status: task.status,
    elapsedSeconds: Math.round(polled.elapsedMs / 1000),
    segmentCount: segmentUrls.length,
    artifactPath,
    bytes,
    durationSeconds: parseDurationFromRun(durationRun),
    hasAudio: Boolean(tracks.hasAudio),
    audioTrackCount: tracks.audioTrackCount || 0,
    videoTrackCount: tracks.videoTrackCount || 0,
    timeline: polled.timeline,
  };
}

function realConfigStatus() {
  return {
    hasApiKey: Boolean(ark.apiKey),
    hasVideoModel: Boolean(ark.videoModel),
    hasApiBase: Boolean(ark.apiBase),
    allowRealCost,
    requestedSeconds,
    maxAllowedSeconds,
    generateAudio,
  };
}

async function main() {
  acquireGateLock();
  const startedAt = new Date().toISOString();
  const noCostRuns = [];
  let realStep = null;

  try {
    for (const run of [
      () => runNodeScript('scripts/qa-video-byok.mjs'),
      () => runTsxScript('scripts/qa-segmented-video-recovery.ts'),
      () => runNodeScript('scripts/check-video-duration.mjs', ['artifacts/huiying-ark-61s.mp4']),
    ]) {
      await waitForSharedQaLock();
      const commandRun = run();
      noCostRuns.push(summarizeCommand(commandRun));
      if (!commandRun.ok) {
        const summary = summarizeCommand(commandRun);
        throw new Error(
          [
            `无费用门控失败：${commandRun.command}`,
            summary.stderrTail ? `stderr=${summary.stderrTail}` : '',
            summary.stdoutTail ? `stdout=${summary.stdoutTail}` : '',
          ].filter(Boolean).join(' | ')
        );
      }
    }

    const config = realConfigStatus();
    if (!config.hasApiKey || !config.hasVideoModel || !config.allowRealCost) {
      realStep = {
        skipped: true,
        reason: !config.hasApiKey
          ? '缺少私有 Ark API Key 环境变量'
          : !config.hasVideoModel
            ? '缺少私有 Ark 视频模型环境变量'
            : '缺少 HUIYING_ALLOW_REAL_VIDEO_COST=true 显式费用授权',
        config,
      };
    } else {
      realStep = await runRealArkStep();
    }

    console.log(JSON.stringify({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl,
      tasksFile,
      usedRealKey: Boolean(ark.apiKey && allowRealCost && ark.videoModel && realStep && !realStep.skipped),
      incurredCost: Boolean(ark.apiKey && allowRealCost && ark.videoModel && realStep && !realStep.skipped),
      noCostRuns,
      realStep,
      knownDurationBaseline: {
        label: 'historical 61s request artifact',
        file: 'artifacts/huiying-ark-61s.mp4',
        actualDurationSeconds: 6.074,
        conclusion: '历史 61 秒任务不能证明 1 分钟生成能力',
      },
    }, null, 2));
  } finally {
    releaseGateLock();
  }
}

main().catch(error => {
  releaseGateLock();
  console.error(JSON.stringify({
    ok: false,
    error: redactSensitive(error instanceof Error ? error.message : String(error)),
    baseUrl,
    tasksFile,
    realConfig: realConfigStatus(),
    usedRealKey: false,
    incurredCost: false,
  }, null, 2));
  process.exit(1);
});
