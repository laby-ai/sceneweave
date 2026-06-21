import fs from 'node:fs';
import path from 'node:path';

const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts');

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function readTasks() {
  if (!fs.existsSync(tasksFile)) throw new Error(`tasks file missing: ${tasksFile}`);
  const parsed = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('tasks file is not an array');
  return parsed;
}

function timestampOf(task: any) {
  return Number(task?.lastUpdatedAt || task?.createdAt || 0);
}

function isCompleteHandoffParent(task: any) {
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

function selectParent(tasks: any[], parentTaskId?: string) {
  if (parentTaskId) {
    const parent = tasks.find(task => task.id === parentTaskId);
    if (!parent) throw new Error(`parent task missing: ${parentTaskId}`);
    return parent;
  }

  return tasks
    .filter(task => task?.result?.assemblyPlan?.segments?.length > 1)
    .filter(isCompleteHandoffParent)
    .sort((a, b) => timestampOf(b) - timestampOf(a))[0] || null;
}

function artifactPath(childTaskId: string, segmentOrder: number) {
  return path.join(artifactsDir, `huiying-handoff-segment-${segmentOrder}-${childTaskId}.mp4`);
}

async function download(url: string, outputPath: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return buffer.length;
}

async function main() {
  const tasks = readTasks();
  const parent = selectParent(tasks, argValue('parentTaskId'));
  if (!parent) throw new Error('no complete handoff parent found');
  const segments = parent.result.assemblyPlan.segments.slice(0, 2);
  const synced = [];

  for (const [index, segment] of segments.entries()) {
    const childTaskId = segment?.childTaskId || segment?.expectedOutputs?.taskId;
    if (!childTaskId) throw new Error(`segment ${index + 1} missing childTaskId`);
    const child = tasks.find(task => task.id === childTaskId);
    if (!child) throw new Error(`child task missing: ${childTaskId}`);
    const videoUrl = child?.result?.videoUrl || child?.result?.segments?.[0]?.videoUrl || segment?.expectedOutputs?.videoUrl;
    if (!videoUrl) throw new Error(`segment ${index + 1} missing videoUrl`);

    const outputPath = artifactPath(childTaskId, index + 1);
    const existed = fs.existsSync(outputPath);
    const bytes = existed ? fs.statSync(outputPath).size : await download(videoUrl, outputPath);
    synced.push({
      segmentOrder: index + 1,
      childTaskId,
      existed,
      bytes,
      artifactPath: outputPath,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    parentTaskId: parent.id,
    synced,
  }, null, 2));
}

main().catch(error => {
  console.log(JSON.stringify({
    ok: false,
    usedRealKey: false,
    incurredCost: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
