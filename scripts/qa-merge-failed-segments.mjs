#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const {
  createTask,
  failTask,
  startTask,
  updateTask,
} = await import('../src/lib/task-manager.ts');
const { buildPartialSegmentResult } = await import('../src/lib/segmented-video-task-result.ts');

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  lockFd = fs.openSync(lockFile, 'wx');
  fs.writeFileSync(lockFd, JSON.stringify({
    pid: process.pid,
    script: 'qa-merge-failed-segments',
    startedAt: new Date().toISOString(),
  }));
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
}

function restoreTasksFile(content) {
  const tempFile = `${tasksFile}.merge-segments.restore.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, content, 'utf8');
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.renameSync(tempFile, tasksFile);
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 80);
    }
  }
}

function readTasks() {
  if (!fs.existsSync(tasksFile)) return [];
  return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
}

function findLatestMergeCandidate() {
  const tasks = readTasks();
  return tasks.find(task => {
    const segments = Array.isArray(task?.result?.segments) ? task.result.segments : [];
    const segmentVideoCount = segments.filter(segment => typeof segment?.videoUrl === 'string' && segment.videoUrl).length;
    return task.type === 'video' && task.status === 'failed' && segmentVideoCount >= 2 && !task.result?.videoUrl;
  })?.id || null;
}

function publicVideoUrl(name) {
  return new URL(`/generated/videos/${name}`, baseUrl).toString();
}

function createProbeTask() {
  const taskId = createTask('video', {
    prompt: 'QA 本地合成恢复：品牌经理和调律者两个真实案例片段合成后自动归档',
    duration: '20',
    ratio: '16:9',
    resolution: '720p',
    videoModel: 'qa-video-model',
    isSegmented: true,
    segmentCount: 2,
    segmentDuration: 10,
    sceneType: 'drama',
  });
  startTask(taskId);
  updateTask(taskId, {
    result: buildPartialSegmentResult([
      {
        segmentIndex: 0,
        status: 'completed',
        prompt: '第1段：品牌经理看到投放报表持续下滑。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: publicVideoUrl('huiying-case-marketing-10s.mp4'),
        lastFrameUrl: 'https://example.invalid/merge-qa-last-frame-0.png',
      },
      {
        segmentIndex: 1,
        status: 'completed',
        prompt: '第2段：调律者在海蚀废墟中启动共鸣装置。',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: publicVideoUrl('huiying-case-anime-adventure-10s.mp4'),
        lastFrameUrl: 'https://example.invalid/merge-qa-last-frame-1.png',
      },
    ]),
  });
  failTask(taskId, 'QA 模拟：片段已完成但最终合成失败，等待本地合成恢复。');
  return taskId;
}

function redactSensitive(value) {
  return String(value)
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

function runDurationProbe(source) {
  const run = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', source], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1024 * 1024 * 4,
  });
  if (run.status !== 0) {
    return {
      ok: false,
      status: run.status,
      stderr: redactSensitive(run.stderr || ''),
      stdout: redactSensitive(run.stdout || ''),
    };
  }
  const jsonStart = run.stdout.indexOf('{');
  return {
    ok: true,
    ...JSON.parse(run.stdout.slice(jsonStart)),
  };
}

function resolveLocalVideoPath(videoUrl) {
  if (!videoUrl?.startsWith('/generated/videos/')) return null;
  return path.resolve('public', videoUrl.slice(1));
}

async function main() {
  acquireLock();
  const originalExists = fs.existsSync(tasksFile);
  const originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  try {
    const taskId = process.env.HUIYING_MERGE_TASK_ID || findLatestMergeCandidate() || createProbeTask();
    const before = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
    const beforeTask = before.json?.task;
    if (!before.response.ok || !beforeTask) {
      throw new Error(`任务读取失败：HTTP ${before.response.status}`);
    }

    const beforeSegments = Array.isArray(beforeTask.result?.segments) ? beforeTask.result.segments : [];
    const beforeSegmentVideoCount = beforeSegments.filter(segment => segment?.videoUrl).length;

    const merge = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/merge-segments`, {
      method: 'POST',
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    const after = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
    const afterTask = after.json?.task;
    const videoUrl = afterTask?.result?.videoUrl || merge.json?.videoUrl;
    const localVideoPath = resolveLocalVideoPath(videoUrl);
    const duration = localVideoPath ? runDurationProbe(localVideoPath) : null;
    const videoSegmentAssetCount = Array.isArray(afterTask?.result?.productionProject?.assets)
      ? afterTask.result.productionProject.assets.filter(asset => asset.kind === 'videoSegment').length
      : 0;
    const completedAssemblySegments = Array.isArray(afterTask?.result?.assemblyPlan?.segments)
      ? afterTask.result.assemblyPlan.segments.filter(segment => segment.status === 'completed' && segment.expectedOutputs?.videoUrl).length
      : 0;

    const output = {
      ok: Boolean(
        merge.response.ok
        && merge.json?.success
        && afterTask?.status === 'completed'
        && duration?.ok
        && merge.json?.archivedProduction?.segmentAssetCount === beforeSegmentVideoCount
        && videoSegmentAssetCount === beforeSegmentVideoCount
        && completedAssemblySegments === beforeSegmentVideoCount
      ),
      taskId,
      before: {
        status: beforeTask.status,
        progress: beforeTask.progress,
        segmentVideoCount: beforeSegmentVideoCount,
        hasFinalVideo: Boolean(beforeTask.result?.videoUrl),
      },
      merge: {
        httpStatus: merge.response.status,
        success: Boolean(merge.json?.success),
        usedRealKey: Boolean(merge.json?.usedRealKey),
        incurredCost: Boolean(merge.json?.incurredCost),
        segmentCount: merge.json?.segmentCount,
        bytes: merge.json?.bytes,
        error: merge.json?.error,
        archivedProduction: merge.json?.archivedProduction,
      },
      after: {
        status: afterTask?.status,
        progress: afterTask?.progress,
        hasFinalVideo: Boolean(videoUrl),
        videoKind: videoUrl?.startsWith('/generated/videos/') ? 'local-public' : videoUrl ? 'remote' : 'missing',
        localVideoPath,
        durationSeconds: duration?.durationSeconds,
        hasProductionProject: Boolean(afterTask?.result?.productionProject),
        hasAssemblyPlan: Boolean(afterTask?.result?.assemblyPlan),
        videoSegmentAssetCount,
        completedAssemblySegments,
      },
    };

    console.log(JSON.stringify(output, null, 2));
    if (!output.ok) process.exit(1);
  } finally {
    if (originalExists && originalContent !== null) {
      restoreTasksFile(originalContent);
    } else if (fs.existsSync(tasksFile)) {
      fs.rmSync(tasksFile, { force: true });
    }
    releaseLock();
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    ok: false,
    error: redactSensitive(error instanceof Error ? error.message : String(error)),
    usedRealKey: false,
    incurredCost: false,
  }, null, 2));
  process.exit(1);
});
