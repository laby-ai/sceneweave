#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const videoPath = path.join(root, 'public/generated/videos/huiying-case-videotape-60s.mp4');
const homePath = path.join(root, 'src/app/DreamboxHome.tsx');
const trailerBeatSheetPath = path.join(root, 'src/lib/trailer-beat-sheet.ts');
const storyGatePath = path.join(root, 'scripts/qa-story-aware-video-gate.mjs');
const vimaxShotDescriptionPath = path.join(root, 'references/ViMax/interfaces/shot_description.py');
const upgradePlanPath = path.join(root, 'docs/yh-open-source-product-upgrade-plan.md');

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function runDurationProbe(filePath) {
  const result = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', filePath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || '').trim(),
    };
  }
  try {
    return JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function pass(name, weight, ok, detail = {}) {
  return { name, weight, pass: Boolean(ok), ...detail };
}

const homeText = read(homePath);
const trailerBeatSheetText = read(trailerBeatSheetPath);
const storyGateText = read(storyGatePath);
const vimaxShotDescriptionText = read(vimaxShotDescriptionPath);
const upgradePlanText = read(upgradePlanPath);
const durationProbe = fs.existsSync(videoPath)
  ? runDurationProbe(videoPath)
  : { ok: false, error: '60s video file missing' };

const durationSeconds = durationProbe.ok ? durationProbe.durationSeconds : null;
const checks = [
  pass(
    'local-real-60s-media-duration',
    30,
    durationProbe.ok && durationSeconds >= 58 && durationSeconds <= 63,
    {
      durationSeconds,
      bytes: durationProbe.bytes || 0,
      path: 'public/generated/videos/huiying-case-videotape-60s.mp4',
    },
  ),
  pass(
    'homepage-60s-case-visible',
    20,
    /便利店录像带 60s/.test(homeText)
      && /\/generated\/videos\/huiying-case-videotape-60s\.mp4/.test(homeText)
      && /duration:\s*['"]01:00['"]/.test(homeText),
  ),
  pass(
    'vimax-style-first-last-frame-reference-readiness',
    15,
    /ff_desc/.test(vimaxShotDescriptionText)
      && /lf_desc/.test(vimaxShotDescriptionText)
      && /variation_reason/.test(vimaxShotDescriptionText)
      && /motion_desc/.test(vimaxShotDescriptionText),
  ),
  pass(
    'huiying-60s-trailer-beat-density',
    15,
    /'60s-trailer'/.test(trailerBeatSheetText)
      && /structure === '60s-trailer' \? 7/.test(trailerBeatSheetText)
      && /viewerCheckpoint/.test(trailerBeatSheetText)
      && /imageHandoff/.test(trailerBeatSheetText),
  ),
  pass(
    'huiying-segment-bridge-memory',
    10,
    /SegmentBridge/.test(trailerBeatSheetText)
      && /previousFrameMemory/.test(trailerBeatSheetText)
      && /nextFrameTrigger/.test(trailerBeatSheetText)
      && /continuityCheck/.test(trailerBeatSheetText),
  ),
  pass(
    'real-60s-gate-can-be-triggered',
    5,
    /HUIYING_STORY_VIDEO_SECONDS/.test(storyGateText)
      && /requestedSeconds/.test(storyGateText)
      && /clampNumber\(Number\(process\.env\.HUIYING_STORY_VIDEO_SECONDS/.test(storyGateText),
  ),
  pass(
    'documented-60s-evidence',
    5,
    /huiying-case-videotape-60s\.mp4/.test(upgradePlanText)
      && /60\.324s/.test(upgradePlanText)
      && /真实.*60s|60s\+ 成片/.test(upgradePlanText),
  ),
];

const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
const score = Math.round((checks
  .filter(check => check.pass)
  .reduce((sum, check) => sum + check.weight, 0) / maxScore) * 100);
const failed = checks.filter(check => !check.pass).map(check => check.name);

const result = {
  ok: failed.length === 0,
  score,
  threshold: 90,
  usedRealKey: false,
  incurredCost: false,
  source: {
    video: 'public/generated/videos/huiying-case-videotape-60s.mp4',
    homepage: 'src/app/DreamboxHome.tsx',
    vimaxReference: 'references/ViMax/interfaces/shot_description.py',
  },
  conclusion: durationProbe.ok
    ? `本地真实 60s 案例时长 ${durationSeconds}s；本轮门禁验证的是 60s 案例可播放证据、首页沉淀、节拍密度和跨段桥接结构，不消耗真实视频额度。`
    : '本地真实 60s 案例不可解析，不能作为当前 60s 效果基线。',
  checks,
  failed,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok || result.score < result.threshold) {
  process.exit(1);
}
