import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const componentPath = path.resolve('src/components/task-center.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

function getVideoSegmentAssets(task) {
  const assets = task?.result?.productionProject?.assets;
  if (!Array.isArray(assets)) return [];
  return assets.filter(asset => asset.kind === 'videoSegment' && typeof asset.metadata?.videoUrl === 'string');
}

function getFinalVideoAssets(task) {
  const assets = task?.result?.productionProject?.assets;
  if (!Array.isArray(assets)) return [];
  return assets.filter(asset => asset.kind === 'finalVideo' && typeof asset.metadata?.videoUrl === 'string');
}

function describeUrlOrigin(url) {
  try {
    return new URL(url, baseUrl).origin;
  } catch {
    return 'unparseable';
  }
}

const source = fs.readFileSync(componentPath, 'utf8');
const requiredMarkers = [
  '已归档视频片段',
  '已归档最终成片',
  '真实视频片段资产',
  '真实最终成片资产',
  'getProductionFinalVideoAssets',
  'providerTaskId',
  'lastFrameUrl',
  'formatSegmentDuration',
];

for (const marker of requiredMarkers) {
  assert(source.includes(marker), `task center source missing marker: ${marker}`);
}

const tasksRes = await fetchJson(`${baseUrl}/api/tasks?limit=100`);
assert(tasksRes.res.ok, `tasks list failed: ${tasksRes.res.status}`);
const tasks = Array.isArray(tasksRes.json?.tasks) ? tasksRes.json.tasks : [];
const archivedTask = tasks.find(task => getVideoSegmentAssets(task).length > 0 && getFinalVideoAssets(task).length > 0);
assert(archivedTask, 'no task with productionProject.assets videoSegment and finalVideo found');

const segmentAssets = getVideoSegmentAssets(archivedTask);
const finalVideoAssets = getFinalVideoAssets(archivedTask);
assert(segmentAssets.length > 0, 'archived task has no videoSegment assets');
assert(finalVideoAssets.length > 0, 'archived task has no finalVideo assets');
for (const asset of segmentAssets) {
  assert(asset.metadata.videoUrl, `videoSegment ${asset.id} missing videoUrl`);
  assert(asset.metadata.segmentId || asset.metadata.shotId, `videoSegment ${asset.id} missing segment or shot identity`);
}
for (const asset of finalVideoAssets) {
  assert(asset.metadata.videoUrl, `finalVideo ${asset.id} missing videoUrl`);
  assert(Array.isArray(asset.metadata.segmentAssetIds), `finalVideo ${asset.id} missing segmentAssetIds`);
  assert(asset.metadata.segmentAssetIds.length === segmentAssets.length, `finalVideo ${asset.id} segmentAssetIds mismatch`);
}

const detailRes = await fetchJson(`${baseUrl}/api/tasks/${archivedTask.id}`);
assert(detailRes.res.ok, `task detail failed: ${detailRes.res.status}`);
const detailSegments = getVideoSegmentAssets(detailRes.json?.task);
const detailFinalVideos = getFinalVideoAssets(detailRes.json?.task);
assert(detailSegments.length === segmentAssets.length, 'task detail videoSegment count mismatch');
assert(detailFinalVideos.length === finalVideoAssets.length, 'task detail finalVideo count mismatch');

let canvasHasVideoSegment = false;
let canvasHasFinalVideo = false;
try {
  const canvasRes = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(archivedTask.id)}`);
  if (canvasRes.res.ok) {
    const serialized = JSON.stringify(canvasRes.json);
    canvasHasVideoSegment = serialized.includes('videoSegment') || serialized.includes('视频片段');
    canvasHasFinalVideo = serialized.includes('finalVideo') || serialized.includes('最终成片');
  }
} catch (error) {
  canvasHasVideoSegment = false;
  canvasHasFinalVideo = false;
}
assert(canvasHasVideoSegment, 'production canvas does not expose archived video segment nodes');
assert(canvasHasFinalVideo, 'production canvas does not expose finalVideo nodes');

const casesRes = await fetchJson(`${baseUrl}/api/production/case-assets?limit=10`);
assert(casesRes.res.ok, `case assets failed: ${casesRes.res.status}`);
const cases = Array.isArray(casesRes.json?.cases) ? casesRes.json.cases : [];
assert(cases.some(item => item.taskId === archivedTask.id && item.source === 'productionProject.assets.finalVideo'), 'case assets missing finalVideo source for archived task');

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  usedRealKey: false,
  incurredCost: false,
  taskId: archivedTask.id,
  videoSegmentAssetCount: segmentAssets.length,
  finalVideoAssetCount: finalVideoAssets.length,
  firstVideoUrlPresent: Boolean(segmentAssets[0].metadata.videoUrl),
  firstVideoUrlOrigin: describeUrlOrigin(segmentAssets[0].metadata.videoUrl),
  finalVideoUrlPresent: Boolean(finalVideoAssets[0].metadata.videoUrl),
  finalVideoUrlOrigin: describeUrlOrigin(finalVideoAssets[0].metadata.videoUrl),
  canvasHasVideoSegment,
  canvasHasFinalVideo,
  caseAssetsHasFinalVideo: true,
  sourceMarkers: requiredMarkers,
}, null, 2));
