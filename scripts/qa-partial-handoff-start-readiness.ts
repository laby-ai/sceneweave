import fs from 'node:fs';
import path from 'node:path';

import { startProductionAssemblySegment } from '../src/lib/production-segment-start';

const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');

function readTasks() {
  if (!fs.existsSync(tasksFile)) return [];
  const parsed = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function timestampOf(task: any) {
  return Number(task?.lastUpdatedAt || task?.createdAt || 0);
}

function hasCompleteHandoff(task: any) {
  const first = task?.result?.assemblyPlan?.segments?.[0];
  const second = task?.result?.assemblyPlan?.segments?.[1];
  const lastFrameUrl = first?.expectedOutputs?.lastFrameUrl;
  return Boolean(
    first?.status === 'completed'
    && second?.status === 'completed'
    && lastFrameUrl
    && second?.expectedInputs?.firstFrameUrl === lastFrameUrl
  );
}

function findLatestPartialParent(tasks: any[]) {
  return tasks
    .filter(task => task?.result?.assemblyPlan?.segments?.length > 1)
    .filter(task => {
      const segments = task.result.assemblyPlan.segments;
      return segments.some((segment: any) => segment?.expectedOutputs?.providerTaskId || segment?.expectedOutputs?.videoUrl);
    })
    .filter(task => !hasCompleteHandoff(task))
    .sort((a, b) => timestampOf(b) - timestampOf(a))[0] || null;
}

function redactFrame(value: unknown) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('data:')) return 'data-url';
  return value.slice(0, 120);
}

const tasks = readTasks();
const parent = findLatestPartialParent(tasks);

if (!parent) {
  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    tasksFile,
    partialParentFound: false,
    message: 'No partial handoff parent found.',
  }, null, 2));
  process.exit(0);
}

const segments = parent.result.assemblyPlan.segments;
const startableSegment = segments.find((segment: any, index: number) => {
  if (index === 0) return false;
  const previous = segments[index - 1];
  return Boolean(
    previous?.expectedOutputs?.lastFrameUrl
    && segment?.expectedInputs?.firstFrameUrl === previous.expectedOutputs.lastFrameUrl
    && segment?.expectedOutputs?.taskId
    && segment?.status !== 'completed'
  );
});

if (!startableSegment?.expectedOutputs?.taskId) {
  console.log(JSON.stringify({
    ok: false,
    usedRealKey: false,
    incurredCost: false,
    tasksFile,
    partialParentFound: true,
    parentTaskId: parent.id,
    error: 'latest partial parent has no startable next segment with first-frame handoff',
  }, null, 2));
  process.exit(1);
}

try {
  const result = startProductionAssemblySegment({
    childTaskId: startableSegment.expectedOutputs.taskId,
  });
  console.log(JSON.stringify({
    ok: result.success === true
      && result.dryRun === true
      && result.startPayload.readiness.pass === true
      && Boolean(result.startPayload.firstFrameImage),
    usedRealKey: false,
    incurredCost: false,
    tasksFile,
    partialParentFound: true,
    parentTaskId: result.parentTaskId,
    childTaskId: result.childTaskId,
    segmentIndex: result.segmentIndex,
    duration: result.duration,
    usesShotFrameContract: result.startPayload.usesShotFrameContract,
    readiness: result.startPayload.readiness,
    firstFrameImage: redactFrame(result.startPayload.firstFrameImage),
    previousLastFrameImage: redactFrame(result.startPayload.previousLastFrameImage),
    promptPreview: result.startPayload.promptPreview.slice(0, 240),
    nextAction: result.nextAction,
  }, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    usedRealKey: false,
    incurredCost: false,
    tasksFile,
    partialParentFound: true,
    parentTaskId: parent.id,
    childTaskId: startableSegment.expectedOutputs.taskId,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
