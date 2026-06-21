#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');

const root = process.cwd();
const videoPath = path.join(root, 'public/generated/videos/huiying-case-videotape-60s.mp4');
const outputDir = path.join(root, 'artifacts/60s-semantic-review');
const contactSheetPath = path.join(outputDir, 'huiying-case-videotape-60s-contact.jpg');
const currentJsonPath = path.join(outputDir, 'current.json');
const labelsPath = path.join(outputDir, 'huiying-case-videotape-60s-labels.json');
const homePath = path.join(root, 'src/app/DreamboxHome.tsx');
const storyGatePath = path.join(root, 'scripts/qa-story-aware-video-gate.mjs');
const arcReelStoryboardPath = path.join(root, 'references/_git-clones/ArcReel/lib/storyboard_sequence.py');

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
}

function runDurationProbe() {
  const result = run(process.execPath, ['scripts/check-video-duration.mjs', videoPath]);
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || '').trim() };
  }
  return JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
}

function ensureContactSheet() {
  fs.mkdirSync(outputDir, { recursive: true });
  const result = run(ffmpegPath, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    videoPath,
    '-vf',
    'fps=1/10,scale=240:-1,tile=7x1',
    '-frames:v',
    '1',
    contactSheetPath,
  ]);
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || '').trim() };
  }
  const stat = fs.statSync(contactSheetPath);
  return { ok: stat.size > 10000, path: path.relative(root, contactSheetPath).replaceAll(path.sep, '/'), bytes: stat.size };
}

function sampleFrameHashes() {
  const result = run(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    videoPath,
    '-map',
    '0:v:0',
    '-an',
    '-vf',
    'fps=1/10,scale=32:18,format=gray',
    '-frames:v',
    '7',
    '-f',
    'framemd5',
    '-',
  ]);
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || '').trim(), sampleCount: 0, uniqueCount: 0 };
  }
  const hashes = result.stdout
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(',').pop()?.trim())
    .filter(Boolean);
  return {
    ok: hashes.length >= 6 && new Set(hashes).size >= 5,
    sampleCount: hashes.length,
    uniqueCount: new Set(hashes).size,
  };
}

function runLabelsReview() {
  if (!fs.existsSync(labelsPath)) {
    return { ok: false, score: 0, labelsPresent: false };
  }
  const result = run(process.execPath, ['scripts/qa-60s-semantic-labels.mjs']);
  const raw = result.stdout || result.stderr || '';
  try {
    const json = JSON.parse(raw.slice(raw.indexOf('{')));
    return {
      ...json,
      ok: result.status === 0 && Boolean(json.ok),
      exitCode: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      score: 0,
      labelsPresent: false,
      exitCode: result.status,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function check(name, weight, pass, detail = {}) {
  return { name, weight, pass: Boolean(pass), ...detail };
}

const duration = fs.existsSync(videoPath) ? runDurationProbe() : { ok: false, error: 'video missing' };
const contactSheet = duration.ok ? ensureContactSheet() : { ok: false, error: 'duration probe failed first' };
const frameHashes = duration.ok ? sampleFrameHashes() : { ok: false, error: 'duration probe failed first', sampleCount: 0, uniqueCount: 0 };
const labelsReview = runLabelsReview();
const homeText = read(homePath);
const storyGateText = read(storyGatePath);
const arcReelStoryboardText = read(arcReelStoryboardPath);

const checks = [
  check('60s-duration-is-parseable', 10, duration.ok && duration.durationSeconds >= 58 && duration.durationSeconds <= 63, {
    durationSeconds: duration.durationSeconds || null,
  }),
  check('contact-sheet-generated', 10, contactSheet.ok, contactSheet),
  check('sampled-frames-have-visual-change', 10, frameHashes.ok, frameHashes),
  check('home-case-has-readable-story-anchor', 10, /便利店录像带 60s/.test(homeText) && /真实短剧|剧场/.test(homeText)),
  check(
    'story-aware-60s-prompt-demands-visible-causality',
    10,
    /观众即使不看字幕/.test(storyGateText)
      && /被威胁对象是谁或什么/.test(storyGateText)
      && /危险源是什么/.test(storyGateText)
      && /主角操作后的结果是什么/.test(storyGateText)
      && /结尾新问题是什么/.test(storyGateText)
      && /发现线索、威胁对象、危险源、主动操作、操作结果、结尾新问题/.test(storyGateText)
      && /跨段衔接硬要求/.test(storyGateText),
  ),
  check(
    'arcreel-previous-storyboard-reference-pattern-read',
    10,
    /PREVIOUS_STORYBOARD_REFERENCE_LABEL/.test(arcReelStoryboardText)
      && /dependency_resource_id/.test(arcReelStoryboardText)
      && /segment_break/.test(arcReelStoryboardText),
  ),
  check('human-or-model-semantic-labels-present', 10, labelsReview.ok && labelsReview.labelsPresent, {
    labelScore: labelsReview.score,
    labels: labelsReview.labels,
  }),
  check('semantic-label-story-readability', 30, labelsReview.ok && labelsReview.storyReadableWithoutText, {
    labelScore: labelsReview.score,
    reason: labelsReview.conclusion,
  }),
];

const maxScore = checks.reduce((sum, item) => sum + item.weight, 0);
const score = Math.round((checks.filter(item => item.pass).reduce((sum, item) => sum + item.weight, 0) / maxScore) * 100);
const qualityGapChecks = ['human-or-model-semantic-labels-present', 'semantic-label-story-readability'];
const hardFailed = checks.filter(item => !item.pass && !qualityGapChecks.includes(item.name));
const qualityGaps = checks.filter(item => !item.pass && qualityGapChecks.includes(item.name));
const result = {
  ok: hardFailed.length === 0 && score >= 70,
  score,
  threshold: 70,
  usedRealKey: false,
  incurredCost: false,
  requiresHumanOrVisionModelReview: !labelsReview.labelsPresent,
  source: {
    video: 'public/generated/videos/huiying-case-videotape-60s.mp4',
    contactSheet: path.relative(root, contactSheetPath).replaceAll(path.sep, '/'),
    arcReelReference: 'references/_git-clones/ArcReel/lib/storyboard_sequence.py',
  },
  conclusion: labelsReview.labelsPresent
    ? labelsReview.conclusion
    : '60s 当前只能确认时长、关键帧可抽取、画面有变化和结构约束存在；尚不能自动证明观众能看懂完整人物目标、冲突、转折和结尾。',
  labelsReview,
  checks,
  qualityGaps: qualityGaps.map(item => item.name),
  hardFailed: hardFailed.map(item => item.name),
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(currentJsonPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
