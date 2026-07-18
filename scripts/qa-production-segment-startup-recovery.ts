import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sceneweave-segment-startup-recovery-'));
const tasksFile = path.join(fixtureDir, 'tasks.json');
const now = Date.now();
const workspace = 'guest-creation-startup-recovery-fixture';
const owner = {
  tenantId: 'paper-host-guest',
  memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
};

const tasks = [
  {
    id: 'parent-task',
    type: 'storyboard',
    status: 'completed',
    config: { workflow: 'production-project' },
    progress: 100,
    result: {
      productionProject: {
        id: 'startup-recovery-project',
        ratio: '16:9',
        style: '现实短剧',
      },
      assemblyPlan: {
        version: 'yh-production-assembly-plan-v1',
        productionProjectId: 'startup-recovery-project',
        sourceTaskId: 'parent-task',
        totalDuration: 5,
        segmentCount: 1,
        status: 'running',
        readiness: { pass: true, issues: [], nextAction: '片段可排队。' },
        segments: [{
          id: 'startup-recovery-segment-1',
          index: 0,
          shotId: 'shot-1',
          duration: 5,
          prompt: '角色从桌边拿起红色录音笔。',
          status: 'running',
          dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
          expectedInputs: {
            firstFrameUrl: null,
            previousLastFrameUrl: null,
            sourceSegmentId: null,
            sourceAssetId: null,
            continuityPrompt: '第一段建立角色、场景和关键道具。',
          },
          expectedOutputs: {
            videoUrl: null,
            lastFrameUrl: null,
            taskId: 'segment-not-submitted',
          },
          retryPolicy: { maxRetries: 2, retryable: true, fallback: '只重试失败片段。' },
        }],
        recovery: { persistEachSegment: true },
        nextAction: '继续未完成片段。',
      },
    },
    createdAt: now - 120_000,
    completedAt: now - 60_000,
    lastUpdatedAt: now - 60_000,
    owner,
  },
  {
    id: 'segment-not-submitted',
    type: 'video',
    status: 'running',
    config: {
      workflow: 'production-assembly-segment',
      parentTaskId: 'parent-task',
      assemblySegmentIndex: 0,
      noAutoStart: true,
    },
    progress: 24,
    stage: '准备提交供应商',
    createdAt: now - 60_000,
    startedAt: now - 30_000,
    lastUpdatedAt: now - 20_000,
    owner,
  },
  {
    id: 'segment-provider-submitted',
    type: 'video',
    status: 'running',
    config: {
      workflow: 'production-assembly-segment',
      parentTaskId: 'parent-task',
      assemblySegmentIndex: 1,
      noAutoStart: true,
    },
    progress: 62,
    stage: '供应商生成中',
    result: { providerTaskId: 'provider-job-existing' },
    createdAt: now - 60_000,
    startedAt: now - 30_000,
    lastUpdatedAt: now - 20_000,
    owner,
  },
  {
    id: 'generic-running-task',
    type: 'video',
    status: 'running',
    config: { workflow: 'single-video' },
    progress: 50,
    createdAt: now - 60_000,
    startedAt: now - 30_000,
    lastUpdatedAt: now - 20_000,
    owner,
  },
  {
    id: 'completed-segment',
    type: 'video',
    status: 'completed',
    config: { workflow: 'production-assembly-segment' },
    progress: 100,
    result: { videoUrl: 'https://example.invalid/success.mp4' },
    createdAt: now - 60_000,
    completedAt: now - 10_000,
    lastUpdatedAt: now - 10_000,
    owner,
  },
];

async function main() {
  fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
  process.env.HUIYING_TASKS_FILE = tasksFile;

  const { getAllTasks } = await import('../src/lib/task-manager');
  const recovered = new Map(getAllTasks().map(task => [task.id, task]));

  const notSubmitted = recovered.get('segment-not-submitted');
  assert.equal(notSubmitted?.status, 'pending', '未提交 provider 的片段应在重启后回到待执行队列');
  assert.equal(notSubmitted?.progress, 0);
  assert.equal(notSubmitted?.error, undefined);
  assert.match(notSubmitted?.stage || '', /恢复|队列/);

  const providerSubmitted = recovered.get('segment-provider-submitted');
  assert.equal(providerSubmitted?.status, 'failed', '已有 provider job 的片段不得自动重投');
  assert.equal(providerSubmitted?.result?.providerTaskId, 'provider-job-existing');
  assert.equal(providerSubmitted?.error, 'task_interrupted_with_provider_job');
  assert.match(providerSubmitted?.stage || '', /续查/);

  const generic = recovered.get('generic-running-task');
  assert.equal(generic?.status, 'failed', '非分段任务继续沿用保守的重启失败策略');
  assert.equal(generic?.error, 'task_interrupted_by_restart');

  const completed = recovered.get('completed-segment');
  assert.equal(completed?.status, 'completed');
  assert.equal(completed?.result?.videoUrl, 'https://example.invalid/success.mp4');

  const [{ NextRequest }, assemblyQueue] = await Promise.all([
    import('next/server'),
    import('../src/app/api/production/assembly-plan/queue/route'),
  ]);
  const queueResponse = await assemblyQueue.POST(new NextRequest('http://localhost/api/production/assembly-plan/queue', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': workspace,
    },
    body: JSON.stringify({ taskId: 'parent-task' }),
  }));
  const queue = await queueResponse.json() as {
    success?: boolean;
    childTaskIds?: string[];
    segments?: Array<{ taskId?: string; status?: string }>;
  };
  assert.equal(queueResponse.status, 200);
  assert.equal(queue.success, true);
  assert.deepEqual(queue.childTaskIds, ['segment-not-submitted'], '恢复后必须复用原片段任务，不能创建重复任务');
  assert.equal(queue.segments?.[0]?.status, 'queued');

  const segmentStartSource = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/production-segment-start.ts'),
    'utf8',
  );
  assert.match(
    segmentStartSource,
    /providerTaskId = submitResult\.taskId;[\s\S]*?updateTask\(childTaskId,[\s\S]*?providerTaskId: submitResult\.taskId,[\s\S]*?updateTaskProgress/,
    '供应商任务号必须先写入片段任务，再进入轮询阶段，避免重启后重复提交',
  );

  console.log(JSON.stringify({
    success: true,
    recoveredWithoutProvider: notSubmitted?.status,
    preservedProviderJob: providerSubmitted?.result?.providerTaskId === 'provider-job-existing',
    genericPolicy: generic?.status,
    completedPreserved: completed?.status,
    queueReusedOriginalTask: queue.childTaskIds?.[0] === 'segment-not-submitted',
    providerJobPersistedBeforePolling: true,
  }, null, 2));
}

main().finally(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
