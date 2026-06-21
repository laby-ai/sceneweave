import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const homePath = path.resolve('src/app/DreamboxHome.tsx');
const mediaSectionPath = path.resolve('src/components/home/dreambox-media-section.tsx');
const canvasBridgePath = path.resolve('src/hooks/useProductionCanvasBridge.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

const source = [
  fs.readFileSync(homePath, 'utf8'),
  fs.readFileSync(mediaSectionPath, 'utf8'),
  fs.readFileSync(canvasBridgePath, 'utf8'),
].join('\n');
const markers = [
  '/api/production/export?taskId=',
  'cut-draft-json',
  '进入画布',
  '导出草稿',
];

for (const marker of markers) {
  assert(source.includes(marker), `DreamboxHome missing export marker: ${marker}`);
}

const casesResponse = await fetchJson(`${baseUrl}/api/production/case-assets?limit=12`);
assert(casesResponse.res.ok, `case-assets endpoint failed: ${casesResponse.res.status}`);
const cases = Array.isArray(casesResponse.json?.cases) ? casesResponse.json.cases : [];
const finalVideo = cases.find(item => item.source === 'productionProject.assets.finalVideo' && item.taskId);
assert(finalVideo, 'no finalVideo case with taskId available for export QA');

const exportResponse = await fetchJson(
  `${baseUrl}/api/production/export?taskId=${encodeURIComponent(finalVideo.taskId)}&format=cut-draft-json`,
);
assert(exportResponse.res.ok, `production export endpoint failed: ${exportResponse.res.status}`);
assert(exportResponse.json?.success === true, 'production export success flag missing');
assert(exportResponse.json?.format === 'cut-draft-json', 'production export format mismatch');

const draft = exportResponse.json?.exportPackage;
assert(draft?.version === 'yh-cut-draft-json-v1', 'cut draft version mismatch');
assert(draft?.reference?.primary === 'ArcReel', 'cut draft reference missing ArcReel');
assert(Array.isArray(draft?.assets?.finalVideos) && draft.assets.finalVideos.length > 0, 'cut draft missing final videos');
assert(Array.isArray(draft?.assets?.videoSegments) && draft.assets.videoSegments.length > 0, 'cut draft missing video segments');
assert(draft?.exportReadiness?.hasFinalVideo === true, 'cut draft should be ready with finalVideo');
assert(Array.isArray(draft?.storyboard?.shots) && draft.storyboard.shots.length > 0, 'cut draft missing storyboard shots');
assert(Array.isArray(draft?.assemblyPlan?.segments) && draft.assemblyPlan.segments.length > 0, 'cut draft missing assembly segments');
assert(
  draft.assets.videoSegments.every(segment => segment.audioCue && segment.storyStateCue),
  'cut draft videoSegments must preserve audioCue and storyStateCue for editing handoff',
);
assert(
  draft.assemblyPlan.segments.every(segment => segment.expectedInputs && segment.expectedOutputs),
  'cut draft assembly segments must preserve expectedInputs and expectedOutputs',
);
assert(
  draft.assemblyPlan.segments.every(segment => segment.audioCue && segment.storyStateCue),
  'cut draft assembly segments must preserve story/audio cues',
);
assert(
  draft.assemblyPlan.segments
    .filter(segment => segment.index > 0)
    .every(segment => segment.storyContinuityPrompt && segment.audioContinuityPrompt),
  'non-first cut draft segments must preserve story/audio continuity prompts',
);

const canvasResponse = await fetchJson(
  `${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(finalVideo.taskId)}`,
);
assert(canvasResponse.res.ok, `production canvas endpoint failed: ${canvasResponse.res.status}`);
assert(canvasResponse.json?.success === true, 'production canvas success flag missing');
const canvasNodes = Array.isArray(canvasResponse.json?.canvas?.nodes) ? canvasResponse.json.canvas.nodes : [];
assert(canvasNodes.some(node => node?.data?.assetKind === 'finalVideo'), 'canvas missing finalVideo node');
assert(canvasNodes.some(node => node?.data?.assetKind === 'videoSegment'), 'canvas missing videoSegment node');

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  usedRealKey: false,
  incurredCost: false,
  taskId: finalVideo.taskId,
  exportVersion: draft.version,
  finalVideoCount: draft.assets.finalVideos.length,
  videoSegmentCount: draft.assets.videoSegments.length,
  segmentAudioCueCount: draft.assets.videoSegments.filter(segment => segment.audioCue).length,
  segmentStoryStateCueCount: draft.assets.videoSegments.filter(segment => segment.storyStateCue).length,
  storyboardShotCount: draft.storyboard.shots.length,
  assemblySegmentCount: draft.assemblyPlan.segments.length,
  canvasNodeCount: canvasNodes.length,
  sourceMarkers: markers,
}, null, 2));
