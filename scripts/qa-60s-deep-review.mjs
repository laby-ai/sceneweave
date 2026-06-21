#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewPath = path.join(root, 'artifacts/60s-semantic-review/deep-review.json');
const contactSheetPath = path.join(root, 'artifacts/60s-semantic-review/deep-12f/contact.jpg');

function pass(name, weight, ok, detail = {}) {
  return { name, weight, pass: Boolean(ok), ...detail };
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function loadReview() {
  if (!fs.existsSync(reviewPath)) return null;
  return JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
}

const review = loadReview();
const frameReview = Array.isArray(review?.frameReview) ? review.frameReview : [];
const scores = review?.scores || {};
const prescription = Array.isArray(review?.nextGenerationPrescription) ? review.nextGenerationPrescription : [];
const blockingIssues = Array.isArray(review?.blockingIssues) ? review.blockingIssues : [];

const checks = [
  pass('deep-review-json-present', 10, Boolean(review), {
    review: 'artifacts/60s-semantic-review/deep-review.json',
  }),
  pass('deep-contact-sheet-present', 10, fs.existsSync(contactSheetPath) && fs.statSync(contactSheetPath).size > 100000, {
    contactSheet: 'artifacts/60s-semantic-review/deep-12f/contact.jpg',
    bytes: fs.existsSync(contactSheetPath) ? fs.statSync(contactSheetPath).size : 0,
  }),
  pass('twelve-frame-coverage', 15, frameReview.length >= 12 && frameReview.every(frame => Number.isFinite(frame.timeSec))),
  pass('each-frame-has-visible-and-issue', 15, frameReview.every(frame => nonEmpty(frame.visible) && nonEmpty(frame.storyFunction) && nonEmpty(frame.readabilityIssue))),
  pass('review-scores-cover-story-readability', 15, [
    'protagonistConsistency',
    'sceneContinuity',
    'propContinuity',
    'threatTargetReadability',
    'dangerSourceReadability',
    'operationResultReadability',
    'endingHookReadability',
    'storyReadableWithoutText',
  ].every(key => Number.isFinite(scores[key]))),
  pass('review-keeps-quality-gap-visible', 15, scores.storyReadableWithoutText < 70 && blockingIssues.length >= 4),
  pass('next-generation-prescription-actionable', 15, prescription.length >= 5 && prescription.every(item => /必须|要|加入|显示|出现|拍成/.test(item))),
  pass('verdict-does-not-overclaim-current-video', 5, /不能作为优秀短剧预告片样例|先按 prescription 修正 10\/30s/.test(review?.verdict || '')),
];

const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
const score = Math.round((checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0) / maxScore) * 100);
const failed = checks.filter(check => !check.pass).map(check => check.name);

const result = {
  ok: failed.length === 0,
  score,
  threshold: 90,
  usedRealKey: false,
  incurredCost: false,
  source: {
    review: 'artifacts/60s-semantic-review/deep-review.json',
    contactSheet: 'artifacts/60s-semantic-review/deep-12f/contact.jpg',
  },
  conclusion: failed.length === 0
    ? '60s deep review is grounded in a 12-frame contact sheet and has actionable next-generation fixes.'
    : '60s deep review is incomplete; do not use it as generation guidance until failed checks are fixed.',
  checks,
  failed,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok || result.score < result.threshold) {
  process.exit(1);
}
