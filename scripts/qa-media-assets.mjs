import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const homePath = path.resolve('src/app/DreamboxHome.tsx');
const homeComponentsDir = path.resolve('src/components/home');

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

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const source = [
  readIfExists(homePath),
  ...fs.readdirSync(homeComponentsDir)
    .filter(name => name.endsWith('.tsx'))
    .map(name => readIfExists(path.join(homeComponentsDir, name))),
].join('\n');
const markers = [
  'mediaSubSection',
  "media === 'assets'",
  '真实制作资产',
  'finalVideoCaseAssets',
  'segmentCaseAssets',
  '真实成片资产',
  '真实片段资产',
  '复用到视频',
  '来源任务',
];

for (const marker of markers) {
  assert(source.includes(marker), `DreamboxHome missing media asset marker: ${marker}`);
}

const response = await fetchJson(`${baseUrl}/api/production/case-assets?limit=12`);
assert(response.res.ok, `case-assets endpoint failed: ${response.res.status}`);
assert(response.json?.success === true, 'case-assets success flag missing');
const cases = Array.isArray(response.json?.cases) ? response.json.cases : [];
const finalVideos = cases.filter(item => item.source === 'productionProject.assets.finalVideo');
const segments = cases.filter(item => item.source === 'productionProject.assets.videoSegment');
assert(finalVideos.length > 0, 'media assets have no finalVideo cases');
assert(segments.length > 0, 'media assets have no videoSegment cases');

for (const item of [...finalVideos, ...segments]) {
  assert(item.taskId, `case ${item.id} missing taskId`);
  assert(item.projectTitle, `case ${item.id} missing projectTitle`);
  assert(item.videoUrl, `case ${item.id} missing videoUrl`);
  assert(item.posterUrl, `case ${item.id} missing posterUrl`);
  assert(item.durationLabel, `case ${item.id} missing durationLabel`);
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  usedRealKey: false,
  incurredCost: false,
  finalVideoCount: finalVideos.length,
  videoSegmentCount: segments.length,
  firstFinalVideo: {
    taskId: finalVideos[0].taskId,
    durationLabel: finalVideos[0].durationLabel,
    hasVideoUrl: Boolean(finalVideos[0].videoUrl),
  },
  sourceMarkers: markers,
}, null, 2));
