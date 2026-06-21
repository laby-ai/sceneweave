#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readTasks() {
  if (!fs.existsSync(tasksFile)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function latestAssemblyParent(tasks) {
  return tasks
    .filter(task => task?.result?.assemblyPlan?.segments?.length > 1)
    .filter(task => task.result.assemblyPlan.segments.some(segment =>
      segment?.expectedOutputs?.providerTaskId || segment?.expectedOutputs?.videoUrl,
    ))
    .sort((a, b) => Number(b?.lastUpdatedAt || b?.createdAt || 0) - Number(a?.lastUpdatedAt || a?.createdAt || 0))[0] || null;
}

function check(name, pass, details = {}) {
  return { name, pass: Boolean(pass), ...details };
}

const trailerBeatSheet = readText('src/lib/trailer-beat-sheet.ts');
const assemblyPlan = readText('src/lib/production-assembly-plan.ts');
const segmentAssets = readText('src/lib/production-segment-assets.ts');
const segmentStartPayload = readText('src/lib/production-segment-start-payload.ts');
const boundaryBridgeStart = readText('src/lib/production-boundary-bridge-start.ts');
const boundaryBridgeStartRoute = readText('src/app/api/production/assembly-plan/boundary/start/route.ts');
const packageJson = readText('package.json');

const staticChecks = [
  check('boundary-bridge-plan-type', /interface BoundaryBridgePlan/.test(trailerBeatSheet)
    && /yh-boundary-bridge-plan-v1/.test(trailerBeatSheet)),
  check('boundary-bridge-state-slots', /sourceLastFrameUrl/.test(trailerBeatSheet)
    && /bridgeVideoUrl/.test(trailerBeatSheet)
    && /newCameraImageUrl/.test(trailerBeatSheet)
    && /targetOpeningContract/.test(trailerBeatSheet)),
  check('boundary-bridge-builder', /function buildBoundaryBridgePlan/.test(trailerBeatSheet)
    && /transition-bridge/.test(trailerBeatSheet)
    && /newCameraImage/.test(trailerBeatSheet)),
  check('assembly-plan-carries-boundary-bridge-plan', /boundaryBridgePlan\?: BoundaryBridgePlan/.test(assemblyPlan)
    && /buildBoundaryBridgePlan/.test(assemblyPlan)
    && /boundary-bridge-concat/.test(assemblyPlan)),
  check('segment-input-consumes-boundary-bridge', /boundaryBridgeId/.test(assemblyPlan)
    && /boundaryBridgePrompt/.test(assemblyPlan)
    && /bridgeFirstFrameUrl/.test(assemblyPlan)),
  check('writeback-updates-boundary-bridge-readiness', /updateBoundaryBridgePlanAfterSegment/.test(segmentAssets)
    && /next-segment-currently-uses-direct-tail-frame-fallback/.test(segmentAssets)
    && /downstream-boundary-invalidated/.test(segmentAssets)),
  check('provider-payload-consumes-boundary-bridge', /boundaryBridge:/.test(segmentStartPayload)
    && /边界桥接计划/.test(segmentStartPayload)
    && /bridgeStrategy/.test(segmentStartPayload)),
  check('boundary-bridge-start-service', /buildProductionBoundaryBridgeStartPayload/.test(boundaryBridgeStart)
    && /承接上镜/.test(boundaryBridgeStart)
    && /new-camera image/.test(boundaryBridgeStart)
    && /submitVideoWithBYOK/.test(boundaryBridgeStart)
    && /waitForVideoWithBYOK/.test(boundaryBridgeStart)
    && /extractLastFrameForHandoff/.test(boundaryBridgeStart)
    && /production-boundary-bridge/.test(boundaryBridgeStart)
    && /applyBoundaryBridgeArtifactWriteback/.test(boundaryBridgeStart)),
  check('boundary-bridge-route-thin-service-call', /startProductionBoundaryBridge/.test(boundaryBridgeStartRoute)
    && /extractBYOKConnection/.test(boundaryBridgeStartRoute)
    && /allowRealCost/.test(boundaryBridgeStartRoute)
    && !/buildProductionBoundaryBridgeStartPayload/.test(boundaryBridgeStartRoute)),
  check('focused-qa-registered', /qa:boundary-continuity/.test(packageJson)
    && /qa:boundary-bridge-start/.test(packageJson)),
];

const tasks = readTasks();
const parent = latestAssemblyParent(tasks);
const runtimeBoundaries = parent?.result?.assemblyPlan?.boundaryBridgePlan?.boundaries || [];
const runtimeBoundaryCount = runtimeBoundaries.length;
const segmentCount = parent?.result?.assemblyPlan?.segments?.length || 0;
const expectedBoundaryCount = Math.max(0, segmentCount - 1);
const runtimeBridgeReadyCount = runtimeBoundaries.filter(boundary =>
  boundary?.status === 'ready' && boundary?.sourceLastFrameUrl && boundary?.targetFirstFrameUrl,
).length;
const runtimeBridgeGeneratedCount = runtimeBoundaries.filter(boundary =>
  boundary?.status === 'generated'
  && boundary?.bridgeVideoUrl
  && boundary?.newCameraImageUrl,
).length;

const sourceBoundaryMechanismReady = staticChecks.every(item => item.pass);
const output = {
  ok: sourceBoundaryMechanismReady,
  usedRealKey: false,
  incurredCost: false,
  sourceBoundaryMechanismReady,
  staticChecks,
  runtime: {
    tasksFile,
    parentTaskId: parent?.id || null,
    segmentCount,
    expectedBoundaryCount,
    runtimeBoundaryCount,
    runtimeBoundaryPlanCoverageRate: expectedBoundaryCount > 0 ? runtimeBoundaryCount / expectedBoundaryCount : 1,
    runtimeBridgeReadyRate: expectedBoundaryCount > 0 ? runtimeBridgeReadyCount / expectedBoundaryCount : 1,
    runtimeBridgeGeneratedRate: expectedBoundaryCount > 0 ? runtimeBridgeGeneratedCount / expectedBoundaryCount : 1,
    legacyRuntimeGap: Boolean(parent && expectedBoundaryCount > 0 && runtimeBoundaryCount === 0),
    nextAction: runtimeBridgeGeneratedCount < expectedBoundaryCount
      ? '下一次视频链路增量应先生成或复盘 boundary bridge artifact，不要直接把 URL 写回成功当成视觉衔接成功。'
      : '边界桥接视频已覆盖当前最新真实任务，可升级到视觉边界复盘。',
  },
};

console.log(JSON.stringify(output, null, 2));

if (!output.ok) {
  process.exit(1);
}
