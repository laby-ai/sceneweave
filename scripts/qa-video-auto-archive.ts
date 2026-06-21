import fs from 'node:fs';
import path from 'node:path';

import { buildProductionCanvas } from '../src/lib/production-canvas';
import { archiveCompletedVideoTaskById } from '../src/lib/production-video-task-archive-service';
import { completeTask, createTask, getTaskFresh, startTask } from '../src/lib/task-manager';
import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import type { ProductionProject } from '../src/lib/production-project';

const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd: number | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  lockFd = fs.openSync(lockFile, 'wx');
  fs.writeFileSync(lockFd, JSON.stringify({
    pid: process.pid,
    script: 'qa-video-auto-archive',
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

function restoreTasksFile(content: string) {
  const tempFile = `${tasksFile}.video-auto-archive.restore.${process.pid}.tmp`;
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

acquireLock();
const originalExists = fs.existsSync(tasksFile);
const originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

try {
  const taskId = createTask('video', {
    prompt: 'QA 自动归档：品牌经理用绘影把碎片素材剪成增长广告',
    duration: '20',
    ratio: '16:9',
    resolution: '720p',
    isSegmented: true,
    segmentCount: 2,
    segmentDuration: 10,
    sceneType: 'drama',
  });
  startTask(taskId);
  completeTask(taskId, {
    videoUrl: '/generated/videos/qa-auto-archive-final.mp4',
    duration: 20,
    ratio: '16:9',
    resolution: '720p',
    provider: 'qa',
    isSegmented: true,
    segmentCount: 2,
    segments: [
      {
        index: 0,
        taskId: `${taskId}-segment-0`,
        status: 'completed',
        prompt: '第1段：品牌经理看到投放报表下滑并拿起碎片素材',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: 'https://example.invalid/qa-auto-archive-segment-0.mp4',
        lastFrameUrl: 'https://example.invalid/qa-auto-archive-last-frame-0.png',
      },
      {
        index: 1,
        taskId: `${taskId}-segment-1`,
        status: 'completed',
        prompt: '第2段：增长曲线在大屏上恢复，团队确认新版方案',
        duration: 10,
        ratio: '16:9',
        videoModel: 'qa-video-model',
        videoUrl: 'https://example.invalid/qa-auto-archive-segment-1.mp4',
        lastFrameUrl: 'https://example.invalid/qa-auto-archive-last-frame-1.png',
      },
    ],
  });

  const archived = archiveCompletedVideoTaskById(taskId);
  const task = getTaskFresh(taskId);
  const result = task?.result;
  const productionProject = result?.productionProject as ProductionProject | undefined;
  const assemblyPlan = result?.assemblyPlan as ProductionAssemblyPlan | undefined;

  assert(archived.segmentAssetCount === 2, 'archived segment count mismatch');
  assert(productionProject, 'productionProject missing after archive');
  assert(assemblyPlan, 'assemblyPlan missing after archive');
  assert(productionProject.assets.filter(asset => asset.kind === 'videoSegment').length === 2, 'videoSegment assets missing');
  assert(assemblyPlan.segments.every(segment => segment.status === 'completed' && segment.expectedOutputs?.videoUrl), 'assemblyPlan segments not completed');

  const canvas = buildProductionCanvas({
    productionProject,
    assemblyPlan,
    taskId,
  });
  assert(
    canvas.nodes.some(node => node.type === 'video' && node.data?.productionAssetKind === 'videoSegment'),
    'canvas missing videoSegment node',
  );

  console.log(JSON.stringify({
    ok: true,
    taskId,
    productionProjectId: archived.productionProjectId,
    segmentAssetCount: archived.segmentAssetCount,
    assemblyStatus: archived.assemblyStatus,
    canvasHasVideoSegment: true,
    usedRealKey: false,
    incurredCost: false,
  }, null, 2));
} finally {
  if (originalExists && originalContent !== null) {
    restoreTasksFile(originalContent);
  } else if (fs.existsSync(tasksFile)) {
    fs.rmSync(tasksFile, { force: true });
  }
  releaseLock();
}
