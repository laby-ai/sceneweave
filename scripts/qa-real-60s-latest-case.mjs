#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const taskId = '6433ac17-4cb2-4f28-9f36-dee20acaba6e';
const videoPath = 'public/generated/videos/huiying-merge-1781840204419-c85e763a3e8628.mp4';
const posterPath = 'public/home/huiying-last-train-60s-poster.jpg';
const reviewPath = `artifacts/real-60s-runs/${taskId}-semantic-review.json`;
const contactSheetPath = `artifacts/real-60s-runs/${taskId}-contact/contact.jpg`;
const homePath = 'src/app/DreamboxHome.tsx';
const canvasHref = `/node-editor?taskId=${taskId}&case=last-train-60s`;

function pass(name, weight, ok, detail = {}) {
  return { name, weight, pass: Boolean(ok), ...detail };
}

function fileBytes(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.statSync(absolutePath).size : 0;
}

function parseDuration(relativePath) {
  const run = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', relativePath], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
  });
  if (run.status !== 0) return null;
  const start = run.stdout.indexOf('{');
  if (start < 0) return null;
  return JSON.parse(run.stdout.slice(start)).durationSeconds;
}

const review = fs.existsSync(path.join(root, reviewPath))
  ? JSON.parse(fs.readFileSync(path.join(root, reviewPath), 'utf8'))
  : null;
const home = fs.existsSync(path.join(root, homePath))
  ? fs.readFileSync(path.join(root, homePath), 'utf8')
  : '';
const durationSeconds = parseDuration(videoPath);

const checks = [
  pass('real-60s-video-present', 20, fileBytes(videoPath) > 50_000_000, {
    video: videoPath,
    bytes: fileBytes(videoPath),
  }),
  pass('real-60s-duration-parseable', 20, Number.isFinite(durationSeconds) && durationSeconds >= 58 && durationSeconds <= 63, {
    durationSeconds,
  }),
  pass('real-60s-poster-present', 15, fileBytes(posterPath) > 50_000, {
    poster: posterPath,
    bytes: fileBytes(posterPath),
  }),
  pass('real-60s-contact-sheet-present', 10, fileBytes(contactSheetPath) > 50_000, {
    contactSheet: contactSheetPath,
    bytes: fileBytes(contactSheetPath),
  }),
  pass('real-60s-semantic-review-present', 15, Boolean(review) && review.taskId === taskId && review.scores?.storyReadableWithoutText < 80, {
    review: reviewPath,
    storyReadableWithoutText: review?.scores?.storyReadableWithoutText,
  }),
  pass('homepage-real-60s-case-visible', 15, home.includes('最后一班列车 60s') && home.includes('/generated/videos/huiying-merge-1781840204419-c85e763a3e8628.mp4') && home.includes('/home/huiying-last-train-60s-poster.jpg'), {
    homepage: homePath,
  }),
  pass('homepage-real-60s-opens-task-canvas', 10, home.includes(canvasHref) && home.includes("target: 'canvas'"), {
    homepage: homePath,
    canvasHref,
  }),
];

const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
const passedScore = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
const score = Math.round((passedScore / maxScore) * 100);
const failed = checks.filter(check => !check.pass).map(check => check.name);

const result = {
  ok: failed.length === 0,
  score,
  threshold: 95,
  usedRealKey: false,
  incurredCost: false,
  taskId,
  source: {
    video: videoPath,
    poster: posterPath,
    review: reviewPath,
    contactSheet: contactSheetPath,
    homepage: homePath,
    canvasHref,
  },
  conclusion: failed.length === 0
    ? 'Latest real 60s generation is visible as a homepage case and has duration/review evidence.'
    : 'Latest real 60s generation is not fully productized; fix failed checks before claiming homepage/material sedimentation.',
  checks,
  failed,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok || score < result.threshold) {
  process.exit(1);
}
