#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts');

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    usedRealKey: false,
    incurredCost: false,
    error: message,
    ...details,
  }, null, 2));
  process.exit(1);
}

function readTasks() {
  if (!fs.existsSync(tasksFile)) {
    fail('tasks file missing', { tasksFile });
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    if (!Array.isArray(parsed)) fail('tasks file is not an array', { tasksFile });
    return parsed;
  } catch (error) {
    fail('tasks file is not valid JSON', {
      tasksFile,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function timestampOf(task) {
  return Number(task?.lastUpdatedAt || task?.createdAt || 0);
}

function findRealHandoffParentCandidates(tasks) {
  return tasks
    .filter(task => task?.result?.assemblyPlan?.segments?.length > 1)
    .filter(task => task.result.assemblyPlan.segments.some(segment =>
      segment?.expectedOutputs?.providerTaskId || segment?.expectedOutputs?.videoUrl,
    ))
    .sort((a, b) => timestampOf(b) - timestampOf(a));
}

function parseDuration(filePath) {
  const result = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', filePath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  const raw = result.stdout || result.stderr || '';
  let json = null;
  try {
    json = JSON.parse(raw.slice(raw.indexOf('{')));
  } catch {
    fail('duration probe returned non-json', { filePath, raw: raw.slice(0, 300) });
  }
  if (result.status !== 0 || !json.ok) {
    fail('duration probe failed', { filePath, probe: json });
  }
  return json;
}

function parseTracks(filePath) {
  const result = spawnSync(process.execPath, ['scripts/check-mp4-tracks.mjs', filePath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  const raw = result.stdout || result.stderr || '';
  let json = null;
  try {
    json = JSON.parse(raw.slice(raw.indexOf('{')));
  } catch {
    fail('track probe returned non-json', { filePath, raw: raw.slice(0, 300) });
  }
  if (result.status !== 0 || !json.ok) {
    fail('track probe failed', { filePath, probe: json });
  }
  return json;
}

function artifactForChild(childTaskId, segmentOrder) {
  const expected = path.join(artifactsDir, `huiying-handoff-segment-${segmentOrder}-${childTaskId}.mp4`);
  if (fs.existsSync(expected)) return expected;
  const candidates = fs.existsSync(artifactsDir)
    ? fs.readdirSync(artifactsDir)
      .filter(name => name.includes(childTaskId) && name.endsWith('.mp4'))
      .map(name => path.join(artifactsDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];
  return candidates[0] || expected;
}

const tasks = readTasks();
const parentCandidates = findRealHandoffParentCandidates(tasks);
const skippedCandidates = [];
let parent = null;
let selectedChildren = null;
let selectedChecks = null;
let selectedFirstLastFrame = null;
let selectedSecondFirstFrame = null;
let selectedChildTaskIds = null;
let selectedFirstAudioCue = null;
let selectedSecondPreviousAudioCue = null;

function inspectParentCandidate(candidate) {
  const segments = candidate.result.assemblyPlan.segments.slice(0, 2);
  if (segments.length < 2) {
    return {
      ok: false,
      parentTaskId: candidate.id,
      reason: 'candidate has fewer than two segments',
      childTaskIds: [],
    };
  }

  const [firstSegment, secondSegment] = segments;
  const firstLastFrame = firstSegment?.expectedOutputs?.lastFrameUrl || null;
  const secondFirstFrame = secondSegment?.expectedInputs?.firstFrameUrl || null;
  const firstAudioCue = firstSegment?.expectedOutputs?.audioCue || firstSegment?.audioState?.audioCue || null;
  const secondPreviousAudioCue = secondSegment?.expectedInputs?.previousAudioCue || null;
  const childTaskIds = segments.map(segment => segment?.childTaskId || segment?.expectedOutputs?.taskId || null);
  const children = [];

  for (const [index, childTaskId] of childTaskIds.entries()) {
    if (!childTaskId) {
      return {
        ok: false,
        parentTaskId: candidate.id,
        reason: `segment ${index + 1} missing childTaskId`,
        childTaskIds,
      };
    }
    const child = tasks.find(task => task.id === childTaskId);
    if (!child) {
      return {
        ok: false,
        parentTaskId: candidate.id,
        reason: `child task missing for segment ${index + 1}`,
        childTaskIds,
      };
    }

    const artifactPath = artifactForChild(childTaskId, index + 1);
    if (!fs.existsSync(artifactPath)) {
      return {
        ok: false,
        parentTaskId: candidate.id,
        reason: `local artifact missing for segment ${index + 1}`,
        childTaskIds,
        artifactPath,
      };
    }
    const duration = parseDuration(artifactPath);
    const tracks = parseTracks(artifactPath);
    const result = child.result || {};
    children.push({
      childTaskId,
      status: child.status,
      providerTaskIdPresent: Boolean(result.providerTaskId || result.segments?.[0]?.providerTaskId),
      videoUrlPresent: Boolean(result.videoUrl || result.segments?.[0]?.videoUrl),
      lastFrameUrlPresent: Boolean(result.lastFrameUrl || result.segments?.[0]?.lastFrameUrl),
      localTailFrameExtracted: Boolean(result.lastFrameExtraction?.extracted),
      uploadSource: result.lastFrameExtraction?.uploadSource || null,
      artifactPath,
      bytes: duration.bytes,
      durationSeconds: duration.durationSeconds,
      hasAudio: Boolean(tracks.hasAudio),
      audioTrackCount: tracks.audioTrackCount || 0,
      videoTrackCount: tracks.videoTrackCount || 0,
      audioCuePresent: Boolean(
        result.audioCue
        || result.segments?.[0]?.audioCue
        || segments[index]?.expectedOutputs?.audioCue
      ),
      expectedHasAudio: segments[index]?.expectedOutputs?.hasAudio ?? null,
    });
  }

  const checks = [
    {
      name: 'parent-completed',
      pass: candidate.status === 'completed',
    },
    {
      name: 'both-segments-completed',
      pass: firstSegment?.status === 'completed' && secondSegment?.status === 'completed',
    },
    {
      name: 'provider-task-id-coverage',
      pass: children.every(child => child.providerTaskIdPresent),
      critical: false,
      present: children.filter(child => child.providerTaskIdPresent).length,
      total: children.length,
    },
    {
      name: 'segment-videos-present',
      pass: children.every(child => child.videoUrlPresent),
    },
    {
      name: 'tail-frames-present',
      pass: children.every(child => child.lastFrameUrlPresent),
    },
    {
      name: 'tail-frames-locally-extracted',
      pass: children.every(child => child.localTailFrameExtracted),
    },
    {
      name: 'first-last-frame-written-to-parent',
      pass: Boolean(firstLastFrame),
    },
    {
      name: 'second-first-frame-uses-first-last-frame',
      pass: Boolean(firstLastFrame) && secondFirstFrame === firstLastFrame,
    },
    {
      name: 'artifact-durations-parseable',
      pass: children.every(child => child.durationSeconds >= 4 && child.durationSeconds <= 12),
    },
    {
      name: 'artifacts-have-audio-tracks',
      pass: children.every(child => child.hasAudio && child.audioTrackCount >= 1),
    },
    {
      name: 'audio-cues-written-to-parent',
      pass: segments.every(segment => Boolean(segment?.expectedOutputs?.audioCue)),
    },
    {
      name: 'second-segment-uses-previous-audio-cue',
      pass: Boolean(firstAudioCue) && secondPreviousAudioCue === firstAudioCue,
    },
  ];
  const failed = checks.filter(check => check.critical !== false && !check.pass);
  const nonCriticalFailed = checks.filter(check => check.critical === false && !check.pass);
  return {
    ok: failed.length === 0,
    parentTaskId: candidate.id,
    reason: failed.map(check => check.name).join(', ') || null,
    nonCriticalWarnings: nonCriticalFailed.map(check => check.name),
    childTaskIds,
    children,
    checks,
    firstLastFrame,
    secondFirstFrame,
    firstAudioCue,
    secondPreviousAudioCue,
  };
}

for (const candidate of parentCandidates) {
  const inspected = inspectParentCandidate(candidate);
  if (inspected.ok) {
    parent = candidate;
    selectedChildren = inspected.children;
    selectedChecks = inspected.checks;
    selectedFirstLastFrame = inspected.firstLastFrame;
    selectedSecondFirstFrame = inspected.secondFirstFrame;
    selectedFirstAudioCue = inspected.firstAudioCue;
    selectedSecondPreviousAudioCue = inspected.secondPreviousAudioCue;
    selectedChildTaskIds = inspected.childTaskIds;
    break;
  }
  skippedCandidates.push({
    parentTaskId: inspected.parentTaskId,
    reason: inspected.reason,
    childTaskIds: inspected.childTaskIds,
    artifactPath: inspected.artifactPath,
  });
}

if (!parent) {
  fail('no complete real handoff parent found', {
    tasksFile,
    candidateCount: parentCandidates.length,
    skippedCandidates: skippedCandidates.slice(0, 5),
  });
}

const segments = parent.result.assemblyPlan.segments.slice(0, 2);
if (segments.length < 2) fail('latest handoff parent has fewer than two segments', { parentTaskId: parent.id });

const firstLastFrame = selectedFirstLastFrame;
const secondFirstFrame = selectedSecondFirstFrame;
const firstAudioCue = selectedFirstAudioCue;
const secondPreviousAudioCue = selectedSecondPreviousAudioCue;
const childTaskIds = selectedChildTaskIds;
const children = selectedChildren;
const checks = selectedChecks;

const failed = checks.filter(check => check.critical !== false && !check.pass);
const nonCriticalFailed = checks.filter(check => check.critical === false && !check.pass);
const output = {
  ok: failed.length === 0,
  usedRealKey: false,
  incurredCost: false,
  tasksFile,
  parentTaskId: parent.id,
  candidateCount: parentCandidates.length,
  skippedCandidates: skippedCandidates.slice(0, 5),
  childTaskIds,
  handoffComplete: Boolean(firstLastFrame && secondFirstFrame === firstLastFrame),
  audioHandoffComplete: Boolean(firstAudioCue && secondPreviousAudioCue === firstAudioCue),
  channel: children[0]?.uploadSource || null,
  checks,
  failed: failed.map(check => check.name),
  nonCriticalWarnings: nonCriticalFailed.map(check => check.name),
  providerTaskIdCoverageRate: children.length
    ? children.filter(child => child.providerTaskIdPresent).length / children.length
    : 0,
  audioTrackCoverageRate: children.length
    ? children.filter(child => child.hasAudio && child.audioTrackCount >= 1).length / children.length
    : 0,
  audioCueWritebackRate: segments.length
    ? segments.filter(segment => Boolean(segment?.expectedOutputs?.audioCue)).length / segments.length
    : 0,
  downstreamAudioCueUsageRate: segments.slice(1).length
    ? segments.slice(1).filter(segment => (
      Boolean(segment?.expectedInputs?.previousAudioCue)
      && Boolean(segment?.expectedInputs?.audioContinuityPrompt)
    )).length / segments.slice(1).length
    : 0,
  children,
};

console.log(JSON.stringify(output, null, 2));

if (!output.ok) {
  process.exit(1);
}
