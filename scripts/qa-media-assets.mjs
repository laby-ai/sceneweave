import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const homePath = path.resolve('src/app/DreamboxHome.tsx');
const homeComponentsDir = path.resolve('src/components/home');
const assetsLibraryPath = path.resolve('src/components/assets/assets-library.tsx');
const mediaLibraryRoutePath = path.resolve('src/app/api/assets/media-library/route.ts');
const mediaFileRoutePath = path.resolve('src/app/api/assets/media-file/route.ts');
const videoPosterRoutePath = path.resolve('src/app/api/assets/video-poster/route.ts');
const taskContextPath = path.resolve('src/contexts/TaskContext.tsx');
const mediaIndexPath = path.resolve('..', 'outputs', 'media-addresses', 'past-image-video-addresses-20260627.csv');

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
  readIfExists(assetsLibraryPath),
  readIfExists(mediaLibraryRoutePath),
  readIfExists(mediaFileRoutePath),
  readIfExists(videoPosterRoutePath),
  readIfExists(taskContextPath),
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
  '/api/assets/media-library',
  '/api/assets/media-file',
  '/api/assets/video-poster',
  'homeHistoricalAssets',
  'historicalAssets',
  "router.push('/canvas')",
  'saveTasksBestEffort',
  'PERSISTED_TASK_LIMIT',
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
const mediaIndexText = readIfExists(mediaIndexPath);
const historicalVideoCount = (mediaIndexText.match(/"video",/g) || []).length;
assert(finalVideos.length > 0 || historicalVideoCount > 0, 'media assets have no finalVideo cases or historical video index');
assert(segments.length > 0 || historicalVideoCount > 0, 'media assets have no videoSegment cases or historical video index');

for (const item of [...finalVideos, ...segments]) {
  assert(item.taskId, `case ${item.id} missing taskId`);
  assert(item.projectTitle, `case ${item.id} missing projectTitle`);
  assert(item.videoUrl, `case ${item.id} missing videoUrl`);
  assert(item.posterUrl, `case ${item.id} missing posterUrl`);
  assert(item.durationLabel, `case ${item.id} missing durationLabel`);
}

const historicalResponse = await fetchJson(`${baseUrl}/api/assets/media-library?limit=24`);
assert(historicalResponse.res.ok, `media-library endpoint failed: ${historicalResponse.res.status}`);
assert(historicalResponse.json?.success === true, 'media-library success flag missing');
const historicalAssets = Array.isArray(historicalResponse.json?.assets) ? historicalResponse.json.assets : [];
assert(historicalAssets.some(item => item.kind === 'video'), 'media-library returned no historical videos');
assert(historicalAssets.some(item => item.kind === 'image'), 'media-library returned no historical images');
assert(historicalAssets.length <= 24, 'media-library ignored requested limit');
const lowQualityHistorical = historicalAssets.filter(item => /apple-touch|brand|clipboard|favicon|icon|logo|placeholder|screenshot|thumb/i.test(`${item.title} ${item.originalPath}`));
assert(lowQualityHistorical.length === 0, `media-library returned obvious low-quality assets: ${lowQualityHistorical.map(item => item.title).join(', ')}`);
const unrelatedFolders = historicalAssets.filter(item =>
  /edited-course|video_parts|skill_course|llmwiki|topiclink|codex-codex|seedream_runs|ppt|research|screenshots/i.test(item.originalPath || ''),
);
assert(
  unrelatedFolders.length === 0,
  `media-library returned unrelated folder assets: ${unrelatedFolders.map(item => item.title).join(', ')}`,
);
const disallowedLegacyAssets = historicalAssets.filter(item =>
  /prompt-only|boundary/i.test(`${item.title} ${item.originalPath || ''}`),
);
assert(
  disallowedLegacyAssets.length === 0,
  `media-library returned disallowed legacy/generated assets: ${disallowedLegacyAssets.map(item => item.title).join(', ')}`,
);
const recalledMainlineVideos = historicalAssets.filter(item =>
  item.kind === 'video' && /rainline|liming|zhibing|kill-line|vimax|enterprise-ai|five-dynasties|seedance/i.test(`${item.title} ${item.originalPath || ''}`),
);
assert(
  recalledMainlineVideos.length >= 8,
  `media-library did not restore enough recalled SceneWeave/VIMAX videos: ${recalledMainlineVideos.length}`,
);
assert(historicalAssets.every(item => item.curated === true), 'media-library did not mark historical assets as curated');
assert(!readIfExists(assetsLibraryPath).includes("router.push('/node-editor')"), 'assets library still routes primary canvas button to /node-editor');

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  usedRealKey: false,
  incurredCost: false,
  finalVideoCount: finalVideos.length,
  videoSegmentCount: segments.length,
  historicalAssetCount: historicalAssets.length,
  historicalVideoCount: historicalAssets.filter(item => item.kind === 'video').length,
  historicalImageCount: historicalAssets.filter(item => item.kind === 'image').length,
  recalledMainlineVideoCount: recalledMainlineVideos.length,
  firstFinalVideo: {
    taskId: finalVideos[0]?.taskId ?? null,
    durationLabel: finalVideos[0]?.durationLabel ?? null,
    hasVideoUrl: Boolean(finalVideos[0]?.videoUrl),
  },
  sourceMarkers: markers,
}, null, 2));
