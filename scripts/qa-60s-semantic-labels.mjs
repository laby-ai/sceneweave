#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewDir = path.join(root, 'artifacts/60s-semantic-review');
const labelsPath = path.join(reviewDir, 'huiying-case-videotape-60s-labels.json');
const templatePath = path.join(reviewDir, 'huiying-case-videotape-60s-labels.template.json');

function writeTemplate() {
  fs.mkdirSync(reviewDir, { recursive: true });
  const template = {
    version: 'yh-60s-semantic-labels-v1',
    source: {
      video: 'public/generated/videos/huiying-case-videotape-60s.mp4',
      contactSheet: 'artifacts/60s-semantic-review/huiying-case-videotape-60s-contact.jpg',
    },
    reviewer: {
      type: 'human-or-vision-model',
      name: '',
      reviewedAt: '',
    },
    expectedStory: {
      protagonist: '',
      goal: '',
      conflict: '',
      turningPoint: '',
      endingHook: '',
    },
    frames: [0, 10, 20, 30, 40, 50].map((timeSec, index) => ({
      index,
      timeSec,
      visibleCharacters: [],
      visibleScene: '',
      visiblePropOrScreen: '',
      visibleAction: '',
      visibleGoalEvidence: '',
      visibleConflictEvidence: '',
      visibleTurnEvidence: '',
      visibleEndingEvidence: '',
      continuityFromPrevious: index === 0 ? 'first-frame' : '',
      readabilityIssue: '',
    })),
    overall: {
      protagonistConsistent: false,
      sceneConsistent: false,
      propOrScreenConsistent: false,
      goalReadableWithoutText: false,
      conflictReadableWithoutText: false,
      turningPointReadableWithoutText: false,
      endingHookReadableWithoutText: false,
      segmentContinuityReadable: false,
      notes: '',
    },
  };
  fs.writeFileSync(templatePath, `${JSON.stringify(template, null, 2)}\n`);
}

function loadLabels() {
  if (!fs.existsSync(labelsPath)) {
    writeTemplate();
    return null;
  }
  return JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
}

function assertArray(value) {
  return Array.isArray(value) ? value : [];
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const labels = loadLabels();
if (!labels) {
  console.log(JSON.stringify({
    ok: false,
    score: 0,
    labelsPresent: false,
    usedRealKey: false,
    incurredCost: false,
    template: path.relative(root, templatePath).replaceAll(path.sep, '/'),
    error: 'semantic labels missing; fill template or provide vision-model labels',
  }, null, 2));
  process.exit(1);
}

const frames = assertArray(labels.frames);
const overall = labels.overall || {};
const checks = [
  { name: 'schema-version', weight: 5, pass: labels.version === 'yh-60s-semantic-labels-v1' },
  { name: 'reviewer-present', weight: 5, pass: nonEmpty(labels.reviewer?.name) && nonEmpty(labels.reviewer?.reviewedAt) },
  { name: 'six-frame-labels', weight: 10, pass: frames.length >= 6 },
  { name: 'frame-actions-labeled', weight: 10, pass: frames.every(frame => nonEmpty(frame.visibleAction)) },
  { name: 'frame-continuity-labeled', weight: 10, pass: frames.every(frame => nonEmpty(frame.continuityFromPrevious)) },
  { name: 'protagonist-consistent', weight: 10, pass: Boolean(overall.protagonistConsistent) },
  { name: 'scene-consistent', weight: 10, pass: Boolean(overall.sceneConsistent) },
  { name: 'prop-or-screen-consistent', weight: 10, pass: Boolean(overall.propOrScreenConsistent) },
  { name: 'goal-readable-without-text', weight: 10, pass: Boolean(overall.goalReadableWithoutText) },
  { name: 'conflict-readable-without-text', weight: 10, pass: Boolean(overall.conflictReadableWithoutText) },
  { name: 'turning-point-readable-without-text', weight: 5, pass: Boolean(overall.turningPointReadableWithoutText) },
  { name: 'ending-hook-readable-without-text', weight: 5, pass: Boolean(overall.endingHookReadableWithoutText) },
];

const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
const score = Math.round((checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0) / maxScore) * 100);
const blockingIssues = checks
  .filter(check => !check.pass && ['schema-version', 'reviewer-present', 'six-frame-labels', 'frame-actions-labeled'].includes(check.name))
  .map(check => check.name);
const criticalStoryChecks = [
  'goal-readable-without-text',
  'conflict-readable-without-text',
  'turning-point-readable-without-text',
  'ending-hook-readable-without-text',
];
const failedCriticalStoryChecks = checks
  .filter(check => criticalStoryChecks.includes(check.name) && !check.pass)
  .map(check => check.name);
const storyReadableWithoutText = score >= 80 && failedCriticalStoryChecks.length === 0;

const result = {
  ok: blockingIssues.length === 0,
  score,
  threshold: 80,
  labelsPresent: true,
  storyReadableWithoutText,
  usedRealKey: false,
  incurredCost: false,
  labels: path.relative(root, labelsPath).replaceAll(path.sep, '/'),
  checks,
  blockingIssues,
  failedCriticalStoryChecks,
  conclusion: storyReadableWithoutText
    ? '60s contact sheet labels indicate the story is readable without relying on prompt text.'
    : '60s contact sheet labels still show weak visual story readability, especially goal/conflict/turning/ending visibility.',
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
