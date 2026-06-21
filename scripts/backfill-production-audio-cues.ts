import {
  getAllTasksFresh,
  updateTask,
  type BackgroundTask,
} from '../src/lib/task-manager';
import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import { normalizeProductionAssemblyAudioContinuity } from '../src/lib/production-audio-cue-normalizer';

const apply = process.argv.includes('--apply');
const taskIdArg = process.argv.find(arg => arg.startsWith('--taskId='));
const targetTaskId = process.env.HUIYING_AUDIO_BACKFILL_TASK_ID
  || (taskIdArg ? taskIdArg.slice('--taskId='.length).trim() : '');

function hasAssemblyPlan(task: BackgroundTask): task is BackgroundTask & {
  result: NonNullable<BackgroundTask['result']> & { assemblyPlan: ProductionAssemblyPlan };
} {
  return Boolean(task.result?.assemblyPlan?.segments?.length);
}

const tasks = getAllTasksFresh();
const parentTasks = tasks
  .filter(hasAssemblyPlan)
  .filter(task => !targetTaskId || task.id === targetTaskId);
const changedTaskIds: string[] = [];
let filledAudioCueCount = 0;
let filledPreviousAudioCueCount = 0;
let changedSegmentCount = 0;

for (const task of parentTasks) {
  const normalized = normalizeProductionAssemblyAudioContinuity(task.result.assemblyPlan);
  if (!normalized.changed) continue;

  changedTaskIds.push(task.id);
  filledAudioCueCount += normalized.filledAudioCueCount;
  filledPreviousAudioCueCount += normalized.filledPreviousAudioCueCount;
  changedSegmentCount += normalized.changedSegmentIds.length;

  if (apply) {
    updateTask(task.id, {
      result: {
        ...task.result,
        assemblyPlan: normalized.assemblyPlan,
      },
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  apply,
  targetTaskId: targetTaskId || null,
  scannedParentCount: parentTasks.length,
  changedParentCount: changedTaskIds.length,
  changedSegmentCount,
  filledAudioCueCount,
  filledPreviousAudioCueCount,
  changedTaskIds: changedTaskIds.slice(0, 20),
}, null, 2));
