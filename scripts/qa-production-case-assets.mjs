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
  '/api/production/case-assets',
  'productionCaseAssets',
  'finalVideoCaseAssets',
  'segmentCaseAssets',
  'homeGalleryItems',
  'mediaSubSection',
  "media === 'assets'",
  '真实制作资产',
  '最终成片',
  '视频片段',
  'production-case-asset',
  '真实片段资产',
  '真实成片资产',
];
for (const marker of markers) {
  assert(source.includes(marker), `DreamboxHome missing marker: ${marker}`);
}

const response = await fetchJson(`${baseUrl}/api/production/case-assets?limit=10`);
assert(response.res.ok, `case-assets endpoint failed: ${response.res.status}`);
assert(response.json?.success === true, 'case-assets success flag missing');
assert(response.json?.source === 'productionProject.assets', 'case-assets source mismatch');
assert(Array.isArray(response.json?.cases), 'case-assets cases missing');
assert(response.json.cases.length > 0, 'case-assets returned no cases');
assert(response.json.cases.some(item => item.source === 'productionProject.assets.finalVideo'), 'case-assets returned no finalVideo case');
assert(response.json.cases.some(item => item.source === 'productionProject.assets.videoSegment'), 'case-assets returned no videoSegment case');

for (const item of response.json.cases) {
  assert(
    item.source === 'productionProject.assets.videoSegment' || item.source === 'productionProject.assets.finalVideo',
    `case ${item.id} source mismatch`,
  );
  assert(item.taskId && item.segmentId, `case ${item.id} missing task or segment identity`);
  assert(item.videoUrl, `case ${item.id} missing videoUrl`);
  assert(item.posterUrl, `case ${item.id} missing posterUrl`);
  assert(item.durationLabel, `case ${item.id} missing durationLabel`);
}

const first = response.json.cases[0];
console.log(JSON.stringify({
  ok: true,
  baseUrl,
  usedRealKey: false,
  incurredCost: false,
  caseCount: response.json.cases.length,
  firstCaseId: first.id,
  firstTaskId: first.taskId,
  firstDurationLabel: first.durationLabel,
  firstSource: first.source,
  firstVideoUrlPresent: Boolean(first.videoUrl),
  sourceMarkers: markers,
}, null, 2));
