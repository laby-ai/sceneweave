import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const alignmentDoc = path.join(root, 'docs/yh-source-alignment-loop.md');
const productionFlowDoc = path.join(root, 'docs/yh-production-flow-qa.md');
const upgradePlanDoc = path.join(root, 'docs/yh-open-source-product-upgrade-plan.md');
const readmePath = path.join(root, 'README.md');
const envExamplePath = path.join(root, '.env.example');
const packageJsonPath = path.join(root, 'package.json');
const outDir = path.join(root, 'artifacts/iteration-scorecard');
const outFile = path.join(outDir, 'current.json');
const maxComponentLines = 2500;
const maxRouteLines = 350;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function lineCount(text) {
  return text ? text.split(/\r?\n/).length : 0;
}

function countMatches(text, patterns) {
  return patterns.reduce((sum, pattern) => sum + (text.match(pattern) || []).length, 0);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function capScore(value, cap) {
  return Math.min(value, cap);
}

function hasAll(text, patterns) {
  return patterns.every(pattern => pattern.test(text));
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function scoreChecks(checks) {
  const passed = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const max = checks.reduce((sum, check) => sum + check.weight, 0);
  return {
    score: max ? clampScore((passed / max) * 100) : 0,
    checks,
  };
}

function runJsonScript(scriptPath) {
  if (!fs.existsSync(path.join(root, scriptPath))) {
    return { ok: false, score: 0, error: `${scriptPath} missing` };
  }
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
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
      exitCode: result.status,
      error: error instanceof Error ? error.message : String(error),
      raw: raw.slice(0, 400),
    };
  }
}

function runPackageJsonScript(scriptName) {
  let command = '';
  try {
    command = JSON.parse(read(packageJsonPath)).scripts?.[scriptName] || '';
  } catch {
    command = '';
  }
  const tsxMatch = command.match(/^tsx\s+(.+)$/);
  if (!tsxMatch) {
    return {
      ok: false,
      score: 0,
      exitCode: null,
      error: `${scriptName} must be a direct tsx script for scorecard execution`,
    };
  }
  const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const result = spawnSync(process.execPath, [tsxCli, tsxMatch[1]], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  const raw = `${result.stdout || ''}\n${result.stderr || ''}`;
  const jsonStart = raw.indexOf('{');
  try {
    const json = JSON.parse(raw.slice(jsonStart));
    return {
      ...json,
      ok: result.status === 0 && Boolean(json.ok),
      exitCode: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      score: 0,
      exitCode: result.status,
      error: result.error
        ? result.error.message
        : error instanceof Error ? error.message : String(error),
      raw: raw.slice(-600),
    };
  }
}

function readTasksFile() {
  const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
  if (!fs.existsSync(tasksFile)) {
    return { tasksFile, tasks: [] };
  }
  try {
    const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    return { tasksFile, tasks: Array.isArray(tasks) ? tasks : [] };
  } catch {
    return { tasksFile, tasks: [] };
  }
}

function boolRate(passed, total) {
  if (!total) return null;
  return Number((passed / total).toFixed(3));
}

function computeRealPunchThroughMetrics() {
  const { tasksFile, tasks } = readTasksFile();
  const segmentTasks = tasks
    .filter(task => task?.config?.workflow === 'production-assembly-segment')
    .filter(task => task?.result?.providerTaskId || task?.result?.videoUrl || task?.result?.segments?.[0]?.providerTaskId)
    .sort((a, b) => (b.lastUpdatedAt || b.createdAt || 0) - (a.lastUpdatedAt || a.createdAt || 0));

  const realStarted = segmentTasks.filter(task => task?.result?.providerTaskId || task?.result?.segments?.[0]?.providerTaskId);
  const generated = realStarted.filter(task => task?.result?.videoUrl || task?.result?.segments?.[0]?.videoUrl);
  const localTailExtracted = generated.filter(task => task?.result?.lastFrameExtraction?.extracted);
  const transferableTailFrame = generated.filter(task => task?.result?.lastFrameUrl || task?.result?.segments?.[0]?.lastFrameUrl);
  const audioTrackConfirmed = generated.filter(task => task?.result?.hasAudio === true || task?.result?.segments?.[0]?.hasAudio === true);
  const audioCueConfirmed = generated.filter(task => task?.result?.audioCue || task?.result?.segments?.[0]?.audioCue);

  const parentTasks = tasks.filter(task => task?.result?.assemblyPlan?.segments?.length > 1);
  const handoffParents = parentTasks.filter(task => {
    const segments = task.result.assemblyPlan.segments;
    return segments.some(segment => segment?.expectedOutputs?.providerTaskId || segment?.expectedOutputs?.videoUrl);
  }).sort((a, b) => (b.lastUpdatedAt || b.createdAt || 0) - (a.lastUpdatedAt || a.createdAt || 0));
  const tailFrameWritebackParents = handoffParents.filter(task => {
    const first = task.result.assemblyPlan.segments[0];
    return Boolean(first?.expectedOutputs?.lastFrameUrl);
  });
  const nextFirstFrameParents = handoffParents.filter(task => {
    const first = task.result.assemblyPlan.segments[0];
    const second = task.result.assemblyPlan.segments[1];
    const lastFrameUrl = first?.expectedOutputs?.lastFrameUrl;
    return Boolean(lastFrameUrl) && second?.expectedInputs?.firstFrameUrl === lastFrameUrl;
  });
  const audioCueWritebackParents = handoffParents.filter(task => {
    const segments = task.result.assemblyPlan.segments.slice(0, 2);
    return segments.length > 0 && segments.every(segment => Boolean(segment?.expectedOutputs?.audioCue));
  });
  const nextAudioCueParents = handoffParents.filter(task => {
    const first = task.result.assemblyPlan.segments[0];
    const second = task.result.assemblyPlan.segments[1];
    const audioCue = first?.expectedOutputs?.audioCue || first?.audioState?.audioCue;
    return Boolean(audioCue)
      && second?.expectedInputs?.previousAudioCue === audioCue
      && Boolean(second?.expectedInputs?.audioContinuityPrompt);
  });
  const isCompleteHandoffParent = task => {
    const first = task?.result?.assemblyPlan?.segments?.[0];
    const second = task?.result?.assemblyPlan?.segments?.[1];
    const lastFrameUrl = first?.expectedOutputs?.lastFrameUrl;
    return Boolean(
      first?.status === 'completed'
      && second?.status === 'completed'
      && lastFrameUrl
      && second?.expectedInputs?.firstFrameUrl === lastFrameUrl
    );
  };
  const latestTouchedHandoffParent = handoffParents[0] || null;
  const latestCompleteHandoffParent = handoffParents.find(isCompleteHandoffParent) || null;
  const latestParentHandoffCompleted = Boolean(latestCompleteHandoffParent);

  const latest = realStarted[0] || null;
  return {
    tasksFile,
    sampleCount: realStarted.length,
    latestChildTaskId: latest?.id || null,
    latestStatus: latest?.status || null,
    latestSegmentIndex: latest?.config?.assemblySegmentIndex ?? null,
    latestHasVideo: Boolean(latest?.result?.videoUrl || latest?.result?.segments?.[0]?.videoUrl),
    latestHasTransferableLastFrame: Boolean(latest?.result?.lastFrameUrl || latest?.result?.segments?.[0]?.lastFrameUrl),
    latestLocalTailFrameExtracted: Boolean(latest?.result?.lastFrameExtraction?.extracted),
    latestUploadSource: latest?.result?.lastFrameExtraction?.uploadSource || null,
    latestHasAudio: Boolean(latest?.result?.hasAudio === true || latest?.result?.segments?.[0]?.hasAudio === true),
    latestAudioCuePresent: Boolean(latest?.result?.audioCue || latest?.result?.segments?.[0]?.audioCue),
    latestBlockers: latest?.result?.lastFrameExtraction?.blockers || [],
    latestHandoffParentId: latestCompleteHandoffParent?.id || null,
    latestTouchedHandoffParentId: latestTouchedHandoffParent?.id || null,
    latestTouchedParentHandoffCompleted: latestTouchedHandoffParent
      ? isCompleteHandoffParent(latestTouchedHandoffParent)
      : null,
    latestParentHandoffCompleted,
    completeHandoffParentRate: boolRate(
      handoffParents.filter(isCompleteHandoffParent).length,
      handoffParents.length,
    ),
    generatedSegmentRate: boolRate(generated.length, realStarted.length),
    localTailFrameExtractionRate: boolRate(localTailExtracted.length, generated.length),
    tailFrameAcquisitionRate: boolRate(transferableTailFrame.length, generated.length),
    audioTrackCoverageRate: boolRate(audioTrackConfirmed.length, generated.length),
    audioCuePresenceRate: boolRate(audioCueConfirmed.length, generated.length),
    tailFrameWritebackRate: boolRate(tailFrameWritebackParents.length, handoffParents.length),
    nextSegmentFirstFrameUsageRate: boolRate(nextFirstFrameParents.length, handoffParents.length),
    audioCueWritebackRate: boolRate(audioCueWritebackParents.length, handoffParents.length),
    nextSegmentAudioCueUsageRate: boolRate(nextAudioCueParents.length, handoffParents.length),
  };
}

function parseCurrentParity(docText) {
  const result = {};
  for (const key of ['ViMAX', 'Toonflow-app', 'ArcReel']) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = docText.match(new RegExp(`- ${escaped}：\\s*(\\d+)%`));
    result[key] = match ? Number(match[1]) : null;
  }
  return result;
}

function parseLatestParityImpact(docText) {
  const impacts = {};
  const pattern = /(ViMAX|Toonflow-app|ArcReel) 从 (\d+)% (?:小幅)?推进到 (\d+)%/g;
  for (const match of docText.matchAll(pattern)) {
    impacts[match[1]] = {
      from: Number(match[2]),
      to: Number(match[3]),
    };
  }
  return impacts;
}

const files = walk(srcRoot);
const sourceStats = {
  largeComponentCount: 0,
  largeRouteCount: 0,
  directProviderSdkRouteCount: 0,
  hardViolationCount: 0,
  legacyProviderReferenceCount: 0,
  largeFileLineDebt: 0,
  largestFileLines: 0,
  topLargeFiles: [],
};

const largeFiles = [];
const sourceTexts = new Map();
const legacyProviderPatterns = [
  /Minimax/g,
  /MiniMax/g,
  /MINIMAX/g,
  /Coze/g,
  /COZE/g,
  /coze-coding-dev-sdk/g,
  /cozeChat/g,
  /generateMiniMax/g,
  /waitForMiniMax/g,
];

for (const file of files) {
  const relative = rel(file);
  const text = read(file);
  sourceTexts.set(relative, text);
  const lines = lineCount(text);

  if (relative.startsWith('src/components/') && lines > maxComponentLines) {
    sourceStats.largeComponentCount += 1;
    sourceStats.largeFileLineDebt += lines - maxComponentLines;
    largeFiles.push({ file: relative, lines, kind: 'component' });
  }

  if (relative.startsWith('src/app/api/') && relative.endsWith('/route.ts') && lines > maxRouteLines) {
    sourceStats.largeRouteCount += 1;
    sourceStats.largeFileLineDebt += lines - maxRouteLines;
    largeFiles.push({ file: relative, lines, kind: 'route' });
  }

  if (
    relative.startsWith('src/app/api/') &&
    (/VideoEditClient|S3Storage|coze-coding-dev-sdk/.test(text))
  ) {
    sourceStats.directProviderSdkRouteCount += 1;
  }

  if (relative === 'src/lib/task-manager.ts' && /from ['"].*production|from ['"].*byok|coze-coding-dev-sdk|VideoEditClient|S3Storage/i.test(text)) {
    sourceStats.hardViolationCount += 1;
  }

  sourceStats.legacyProviderReferenceCount += countMatches(text, legacyProviderPatterns);
}

largeFiles.sort((a, b) => b.lines - a.lines);
sourceStats.topLargeFiles = largeFiles.slice(0, 10);
sourceStats.largestFileLines = largeFiles[0]?.lines || 0;

const videoSubmitPath = path.join(root, 'src/app/api/video/submit/route.ts');
const videoSubmitText = read(videoSubmitPath);
const videoSubmitForbiddenCount = countMatches(videoSubmitText, [
  /MINIMAX_API_KEY/g,
  /generateMiniMaxVideo|waitForMiniMaxVideo/g,
  /COZE_WORKLOAD_IDENTITY_API_KEY|COZE_API_KEY|COZE_INTEGRATION_BASE_URL|COZE_API_BASE_URL/g,
  /contents\/generations\/tasks/g,
  /cozeChat/g,
  /coze-coding-dev-sdk|HeaderUtils|VideoEditClient|TTSClient/g,
  /usedProvider/g,
  /doubao-seedance-1-5-pro-251215/g,
]);

const docText = read(alignmentDoc);
const productionFlowText = read(productionFlowDoc);
const upgradePlanText = read(upgradePlanDoc);
const readmeText = read(readmePath);
const envExampleText = read(envExamplePath);
const packageJsonText = read(packageJsonPath);
const realProductionSegmentSmokeText = read(path.join(root, 'scripts/qa-real-production-segment-smoke.mjs'));
const segmentStartServiceQaText = read(path.join(root, 'scripts/qa-production-segment-start-service.ts'));
const segmentAssetsQaText = read(path.join(root, 'scripts/qa-production-segment-assets.ts'));
const segmentRetryServiceQaText = read(path.join(root, 'scripts/qa-production-segment-retry-service.ts'));
const segmentCascadeRecoveryQaText = read(path.join(root, 'scripts/qa-production-segment-cascade-recovery.ts'));
const assetWritebackQaText = read(path.join(root, 'scripts/qa-production-asset-writeback.mjs'));
const storyboardWritebackQaText = read(path.join(root, 'scripts/qa-production-storyboard-writeback.mjs'));
const nodeEditorActionsQaText = read(path.join(root, 'scripts/qa-node-editor-actions.mjs'));
const multitypeSegmentProviderPayloadQaText = read(path.join(root, 'scripts/qa-multitype-segment-provider-payload.ts'));
const multisegmentChainQaText = read(path.join(root, 'scripts/qa-production-multisegment-chain.ts'));
const boundaryContinuityQaText = read(path.join(root, 'scripts/qa-boundary-continuity.mjs'));
const realPunchThrough = computeRealPunchThroughMetrics();
const allSourceText = [...sourceTexts.values()].join('\n');
const allDocsText = [docText, productionFlowText, upgradePlanText, readmeText, envExampleText, packageJsonText].join('\n');
const allQaScriptText = [
  realProductionSegmentSmokeText,
  segmentStartServiceQaText,
  segmentAssetsQaText,
  segmentRetryServiceQaText,
  segmentCascadeRecoveryQaText,
  assetWritebackQaText,
  storyboardWritebackQaText,
  nodeEditorActionsQaText,
  multitypeSegmentProviderPayloadQaText,
  multisegmentChainQaText,
  boundaryContinuityQaText,
].join('\n');
const allProjectText = `${allSourceText}\n${allDocsText}\n${allQaScriptText}`;
const sixtySecondEffect = runJsonScript('scripts/qa-60s-effect.mjs');
const sixtySecondEffectScore = Number.isFinite(sixtySecondEffect.score) ? sixtySecondEffect.score : 0;
const sixtySecondGoldenCase = runJsonScript('scripts/qa-60s-golden-case.mjs');
const sixtySecondGoldenCaseScore = Number.isFinite(sixtySecondGoldenCase.score) ? sixtySecondGoldenCase.score : 0;
const sixtySecondDeepReview = runJsonScript('scripts/qa-60s-deep-review.mjs');
const sixtySecondDeepReviewScore = Number.isFinite(sixtySecondDeepReview.score) ? sixtySecondDeepReview.score : 0;
const realSixtySecondLatestCase = runJsonScript('scripts/qa-real-60s-latest-case.mjs');
const realSixtySecondLatestCaseScore = Number.isFinite(realSixtySecondLatestCase.score) ? realSixtySecondLatestCase.score : 0;
const latestRealHandoff = runJsonScript('scripts/qa-latest-real-handoff.mjs');
const boundaryContinuity = runJsonScript('scripts/qa-boundary-continuity.mjs');
const multisegmentChain = runPackageJsonScript('qa:multisegment-chain');
const sixtySecondSemanticReview = runJsonScript('scripts/qa-60s-semantic-review.mjs');
const sixtySecondSemanticReviewScore = Number.isFinite(sixtySecondSemanticReview.score) ? sixtySecondSemanticReview.score : 0;
const sixtySecondSemanticLabelScore = Number.isFinite(sixtySecondSemanticReview.labelsReview?.score)
  ? sixtySecondSemanticReview.labelsReview.score
  : 0;
const currentParity = parseCurrentParity(docText);
const latestParityImpact = parseLatestParityImpact(docText);
const staleParityBaselines = Object.entries(latestParityImpact)
  .filter(([key, impact]) => currentParity[key] !== null && currentParity[key] < impact.to)
  .map(([key, impact]) => ({ project: key, current: currentParity[key], latestTo: impact.to }));

const evidenceAdjustedParity = { ...currentParity };
const parityEvidenceAdjustments = [];
const latestRealHandoffHasFullProviderAudit = Boolean(
  latestRealHandoff.ok
  && latestRealHandoff.handoffComplete === true
  && latestRealHandoff.audioHandoffComplete === true
  && latestRealHandoff.providerTaskIdCoverageRate === 1
  && latestRealHandoff.audioTrackCoverageRate === 1
  && Array.isArray(latestRealHandoff.children)
  && latestRealHandoff.children.length >= 2
  && latestRealHandoff.children.every(child =>
    child.providerTaskIdPresent
    && child.videoUrlPresent
    && child.lastFrameUrlPresent
    && child.localTailFrameExtracted
    && child.hasAudio
    && child.audioTrackCount >= 1
  )
);
if (latestRealHandoffHasFullProviderAudit && typeof evidenceAdjustedParity.ArcReel === 'number') {
  const nextArcReel = Math.max(evidenceAdjustedParity.ArcReel, 77);
  if (nextArcReel !== evidenceAdjustedParity.ArcReel) {
    parityEvidenceAdjustments.push({
      project: 'ArcReel',
      from: evidenceAdjustedParity.ArcReel,
      to: nextArcReel,
      reason: 'latest real two-segment handoff has full providerTaskId/video/lastFrame/audio/local-artifact coverage',
    });
    evidenceAdjustedParity.ArcReel = nextArcReel;
  }
}

const parityValues = Object.values(evidenceAdjustedParity).filter(value => typeof value === 'number');
const parityAverage = parityValues.length
  ? Number((parityValues.reduce((sum, value) => sum + value, 0) / parityValues.length).toFixed(1))
  : null;

const spaghettiDebt =
  sourceStats.hardViolationCount * 100 +
  sourceStats.largeComponentCount * 8 +
  sourceStats.largeRouteCount * 6 +
  sourceStats.directProviderSdkRouteCount * 8 +
  videoSubmitForbiddenCount * 20 +
  Math.round(sourceStats.legacyProviderReferenceCount / 10);

const storyReadability = scoreChecks([
  {
    name: 'story-bible-arc-fields',
    weight: 30,
    pass: hasAll(allProjectText, [
      /premise/,
      /protagonist/,
      /desire/,
      /obstacle/,
      /conflict/,
      /turningPoint/,
      /endingHook/,
      /emotionalArc/,
      /beats/,
    ]),
  },
  {
    name: 'shot-dramatic-purpose-fields',
    weight: 25,
    pass: hasAll(allProjectText, [/storyBeat/, /dramaticPurpose/, /emotionShift/]),
  },
  {
    name: 'story-aware-segment-prompts',
    weight: 20,
    pass: hasAny(allProjectText, [/story-aware/i, /storyAware/, /story terms/i, /剧情节点/, /动作因果/]),
  },
  {
    name: 'short-drama-quality-qa',
    weight: 15,
    pass: /qa:short-drama/.test(packageJsonText) && /内容质量门|story terms|模板污染|storyBible/.test(allDocsText),
  },
  {
    name: 'vimax-style-planning-dependencies',
    weight: 10,
    pass: hasAll(allProjectText, [/directorChain/, /storyboard/, /shotList|shot list|shotList/i, /continuity/i]),
  },
]);

const storyQualityOpenIssue = /故事.*看不懂|故事.*不够|段落.*衔接.*弱|仍需优化[:：][\s\S]{0,120}(turning|转折|结局|桥接|可见动作)/.test(allDocsText);
const storyReadabilityScore = storyQualityOpenIssue
  ? capScore(storyReadability.score, 85)
  : storyReadability.score;

const segmentContinuity = scoreChecks([
  {
    name: 'segment-handoff-input-contract',
    weight: 20,
    pass: hasAll(allProjectText, [/expectedInputs/, /firstFrameUrl/, /previousLastFrameUrl/, /sourceSegmentId/, /continuityPrompt/]),
  },
  {
    name: 'vimax-shot-frame-contract',
    weight: 20,
    pass: hasAll(allProjectText, [/shotFrameContract/, /yh-shot-frame-contract-v1/, /variationType/, /firstFrame/, /lastFrame/, /visibleCharacterIds/]),
  },
  {
    name: 'visual-story-evidence-contract',
    weight: 20,
    pass: hasAll(allProjectText, [
      /visualStoryEvidence/,
      /ShotVisualStoryEvidence/,
      /【视觉冲突证据】/,
      /【结尾钩子证据】/,
      /【无字幕可读性测试】/,
    ]),
  },
  {
    name: 'toonflow-story-segment-contract',
    weight: 20,
    pass: hasAll(allProjectText, [
      /StorySegmentContract/,
      /yh-story-segment-contract-v1/,
      /videoDesc/,
      /storyState/,
      /audioContract/,
      /dependencyContract/,
      /evaluateStorySegmentStartReadiness/,
    ]),
  },
  {
    name: 'story-state-cue-provider-handoff',
    weight: 20,
    pass: /qa:segment-start-service/.test(packageJsonText)
      && /qa:segment-assets/.test(packageJsonText)
      && hasAll(allProjectText, [
        /storyStateCue/,
        /previousStoryStateCue/,
        /storyContinuityPrompt/,
        /describeStorySegmentCue/,
        /故事承接上一段/,
      ]),
  },
  {
    name: 'audio-event-contract-provider-handoff',
    weight: 20,
    pass: /qa:segment-start-service/.test(packageJsonText)
      && /qa:segment-cascade-recovery/.test(packageJsonText)
      && hasAll(allProjectText, [
        /audioEventContract/,
        /expectedAudioEvidence/,
        /lipSyncPolicy/,
        /mustGenerateAudioTrack/,
        /声音事件合约/,
        /声音事件/,
      ]),
  },
  {
    name: 'audio-event-contract-asset-canvas-writeback',
    weight: 20,
    pass: /qa:segment-assets/.test(packageJsonText)
      && hasAll(allProjectText, [
        /videoSegment audioEventContract metadata missing/,
        /DAG video node audioEventContract missing/,
        /canvas videoSegment node missing audioEventContract/,
        /production-audio-event-contract/,
        /refreshed canvas lost audioEventContract after node-editor writeback/,
        /data\.audioEventContract/,
      ]),
  },
  {
    name: 'artifact-readiness-stale-gate',
    weight: 20,
    pass: /qa:asset-writeback/.test(packageJsonText)
      && /qa:storyboard-writeback/.test(packageJsonText)
      && hasAll(allProjectText, [
        /ProductionArtifactReadiness/,
        /markAssemblyPlanStaleForProjectChange/,
        /artifact-stale-after-project-writeback/,
        /staleSegmentCount/,
        /asset writeback did not invalidate assembly plan readiness/,
        /storyboard writeback did not invalidate assembly plan readiness/,
      ]),
  },
  {
    name: 'assembly-readiness-gate',
    weight: 15,
    pass: /qa:shot-frame-contract/.test(packageJsonText)
      && hasAll(allProjectText, [/yh-assembly-readiness-v1/, /evaluateAssemblyShotFrameReadiness/, /readiness\.pass/, /status:\s*409/]),
  },
  {
    name: 'last-frame-writeback',
    weight: 20,
    pass: hasAll(allProjectText, [/lastFrameUrl/, /applySegmentAssetWriteback/, /expectedOutputs/]),
  },
  {
    name: 'start-route-first-frame-input',
    weight: 15,
    pass: hasAll(allProjectText, [/firstFrameImage/, /assembly-plan\/segment\/start|segment\/start/]),
  },
  {
    name: 'handoff-punch-through-hard-gate',
    weight: 30,
    pass: /qa:segment-start-service/.test(packageJsonText)
      && hasAll(`${allProjectText}\n${segmentStartServiceQaText}`, [
        /evaluateProductionSegmentTransition/,
        /segment-handoff-not-ready/,
        /segment-tail-frame-missing/,
        /evaluateSegmentTailFrameForHandoff/,
        /previousLastFrameUrl/,
        /firstFrameImage === 'https:\/\/example\.invalid\/segment-1-last-frame\.jpg'/,
        /handoff-punch-through-rate-1-of-1/,
      ]),
  },
  {
    name: 'boundary-bridge-plan-artifact',
    weight: 20,
    pass: /qa:boundary-continuity/.test(packageJsonText)
      && boundaryContinuity.ok === true
      && boundaryContinuity.sourceBoundaryMechanismReady === true
      && hasAll(allProjectText, [
        /BoundaryBridgePlan/,
        /buildBoundaryBridgePlan/,
        /yh-boundary-bridge-plan-v1/,
        /boundaryBridgePlan/,
        /boundaryBridgePrompt/,
        /bridgeVideoUrl/,
        /newCameraImageUrl/,
        /边界桥接计划/,
      ]),
  },
  {
    name: 'segment-start-payload-uses-shot-frame-contract',
    weight: 20,
    pass: /qa:segment-start-service/.test(packageJsonText)
      && /qa:segment-start/.test(packageJsonText)
      && hasAll(allProjectText, [
        /buildProductionSegmentStartPayload/,
        /segmentStartPayload/,
        /usesShotFrameContract/,
        /【首帧合约】/,
        /【尾帧合约】/,
      ]),
  },
  {
    name: 'real-handoff-readiness-gate',
    weight: 15,
    pass: /qa:real-segment-handoff/.test(packageJsonText)
      && /realSegmentHandoff|objectStorage|publicFrameHandoff/.test(allProjectText)
      && /lastFrameUrlPresent/.test(realProductionSegmentSmokeText)
      && /handoffPunchThroughReady/.test(realProductionSegmentSmokeText),
  },
  {
    name: 'public-frame-handoff-channel',
    weight: 15,
    pass: /qa:public-frame-handoff/.test(packageJsonText)
      && hasAll(allProjectText, [
        /getPublicFrameHandoffReadiness/,
        /savePublicFrameForHandoff/,
        /HUIYING_PUBLIC_ASSET_BASE_URL/,
        /public\/generated\/frames/,
      ]),
  },
  {
    name: 'strict-segment-dependency-gate',
    weight: 15,
    pass: /qa:segment-dependency-gate/.test(packageJsonText)
      && hasAll(allProjectText, [
        /resolveSegmentFirstFrame/,
        /strictFrameHandoff/,
        /dependencySatisfied/,
        /lastFrameUrl/,
      ]),
  },
  {
    name: 'failed-segment-does-not-propagate',
    weight: 15,
    pass: /qa:segment-cascade-recovery/.test(packageJsonText)
      && hasAll(allProjectText, [
        /cascadeDependentSegmentsAfterFailure/,
        /cascade-skipped-downstream-segment-released-to-queued/,
        /second-segment-start-uses-recovered-last-frame/,
        /partialProviderTaskIdPreserved|providerTaskIdPreservedOnFailure/,
      ]),
  },
  {
    name: 'provider-prompt-continuity-memory',
    weight: 15,
    pass: /qa:segment-continuity-memory/.test(packageJsonText)
      && hasAll(allProjectText, [
        /buildSegmentContinuityMemoryBlock/,
        /【段间连续性记忆 - 必须执行】/,
        /【上一段尾帧证据】/,
        /【本段唯一信息增量】/,
        /【下一段触发点】/,
      ]),
  },
  {
    name: 'multitype-provider-payload-consumes-story-audio-cues',
    weight: 15,
    pass: /qa:multitype-segment-provider-payload/.test(packageJsonText)
      && hasAll(allProjectText, [
        /providerUsesFullPreviousStoryStateCue/,
        /providerUsesFullPreviousAudioCue/,
        /providerUsesCurrentAudioEventPolicy/,
        /story state cue was not fully consumed/,
        /audio cue was not fully consumed/,
        /current segment audio-event policy was not consumed/,
      ]),
  },
  {
    name: 'five-segment-story-audio-handoff-chain',
    weight: 20,
    pass: /qa:multisegment-chain/.test(packageJsonText)
      && multisegmentChain.ok === true
      && multisegmentChain.segmentCount >= 5
      && multisegmentChain.usedRealKey === false
      && multisegmentChain.incurredCost === false
      && Array.isArray(multisegmentChain.checks)
      && [
        'direct-previous-tail-frame-used-for-segment-2-and-3',
        'direct-previous-story-and-audio-cues-used',
        'middle-failure-cascades-to-segment-4-and-5',
        'segment-4-uses-recovered-segment-3-tail-story-audio',
      ].every(check => multisegmentChain.checks.includes(check))
      && multisegmentChain.punchThrough?.tailFrameWritebackRate === 1
      && multisegmentChain.punchThrough?.nextSegmentFirstFrameUsageRate === 1
      && multisegmentChain.punchThrough?.nextSegmentAudioCueUsageRate === 1,
  },
]);

const objectStorageBlocked = /对象存储未 ready|不能宣称真实首帧连续生成闭环完成|missing.*object.*storage|缺少.*HUIYING_OBJECT_STORAGE/i.test(allProjectText);
const realHandoffBlocked = realPunchThrough.sampleCount > 0
  && !realPunchThrough.latestParentHandoffCompleted;
const segmentContinuityScore = realHandoffBlocked
  ? capScore(segmentContinuity.score, 55)
  : objectStorageBlocked
  ? capScore(segmentContinuity.score, 70)
  : segmentContinuity.score;
const handoffPunchThroughCheck = segmentContinuity.checks.find(check => check.name === 'handoff-punch-through-hard-gate');
const handoffPunchThroughRate = handoffPunchThroughCheck?.pass ? 1 : 0;

const clickableProduct = scoreChecks([
  {
    name: 'task-backed-production-canvas-api',
    weight: 15,
    pass: fs.existsSync(path.join(root, 'src/app/api/node-editor/production-canvas/route.ts')) && /taskId/.test(sourceTexts.get('src/app/api/node-editor/production-canvas/route.ts') || ''),
  },
  {
    name: 'canvas-visible-assembly-readiness',
    weight: 20,
    pass: hasAll(allProjectText, [/assemblyReadiness/, /shotFrameContract/, /shotFrameReadiness/, /首尾帧合约/]),
  },
  {
    name: 'project-asset-writeback-api',
    weight: 15,
    pass: fs.existsSync(path.join(root, 'src/app/api/production/projects/[taskId]/assets/[assetId]/route.ts')),
  },
  {
    name: 'storyboard-shot-writeback-api',
    weight: 15,
    pass: fs.existsSync(path.join(root, 'src/app/api/production/projects/[taskId]/storyboard/[shotId]/route.ts')),
  },
  {
    name: 'node-editor-writeback-ui',
    weight: 15,
    pass: /storyboard-shot-writeback|写回镜头|production-canvas/.test(allProjectText),
  },
  {
    name: 'clickable-product-qa',
    weight: 20,
    pass: /qa:canvas/.test(packageJsonText) && /qa:storyboard-writeback/.test(packageJsonText) && /qa:task-center-segment-assets/.test(packageJsonText),
  },
]);

const realGenerationStability = scoreChecks([
  {
    name: '60s-effect-golden-case-gate',
    weight: 20,
    pass: sixtySecondEffect.ok && sixtySecondEffectScore >= 90
      && sixtySecondGoldenCase.ok && sixtySecondGoldenCaseScore >= 90,
  },
  {
    name: 'byok-video-submit-gate',
    weight: 20,
    pass: /qa:video-submit-byok-only/.test(packageJsonText) && videoSubmitForbiddenCount === 0,
  },
  {
    name: 'task-recovery-qa',
    weight: 20,
    pass: /qa:assembly-queue|qa:video-recovery|qa:resume-segment/.test(packageJsonText),
  },
  {
    name: 'media-duration-probe',
    weight: 20,
    pass: /check-video-duration|ffprobe|actualDuration|媒体时长/.test(allProjectText),
  },
  {
    name: 'latest-real-60s-productized-case',
    weight: 20,
    pass: realSixtySecondLatestCase.ok && realSixtySecondLatestCaseScore >= 95,
  },
  {
    name: 'real-case-evidence',
    weight: 20,
    pass: /真实.*60|60s|60 秒|真实.*30|30s|30 秒/.test(allDocsText) && /taskId|供应商任务|providerTaskId/.test(allDocsText),
  },
  {
    name: 'failed-generation-stop-rule',
    weight: 20,
    pass: /真实视频失败一次就停止加码|失败一次就停止加码|missing.*object.*storage|对象存储.*停止/.test(allProjectText),
  },
  {
    name: 'real-test-escalation-run-plan',
    weight: 20,
    pass: /qa:video-generation-run-plan/.test(packageJsonText)
      && hasAll(allProjectText, [
        /getVideoGenerationRunPlan/,
        /nextAllowedRealTest/,
        /single-segment-smoke/,
        /multi-segment-handoff/,
        /sixty-second-regression/,
      ]),
  },
  {
    name: 'real-production-segment-smoke-uses-production-payload',
    weight: 20,
    pass: /qa:real-production-segment-smoke/.test(packageJsonText)
      && hasAll(`${allProjectText}\n${realProductionSegmentSmokeText}`, [
        /qa-real-production-segment-smoke/,
        /buildProductionSegmentPlan/,
        /assembly-plan\/segment\/start/,
        /segmentStartPayload|visualStoryEvidence/,
        /HUIYING_ALLOW_REAL_VIDEO_COST/,
        /x-yh-video-model/,
      ]),
  },
  {
    name: 'latest-real-two-segment-handoff-evidence',
    weight: 25,
    pass: /qa:latest-real-handoff/.test(packageJsonText)
      && latestRealHandoff.ok
      && latestRealHandoff.handoffComplete === true
      && latestRealHandoff.audioHandoffComplete === true
      && Array.isArray(latestRealHandoff.children)
      && latestRealHandoff.children.length >= 2
      && latestRealHandoff.children.every(child => (
        child.providerTaskIdPresent
        && child.videoUrlPresent
        && child.lastFrameUrlPresent
        && child.hasAudio
        && child.audioTrackCount >= 1
      )),
  },
]);

const realGenerationStabilityScore = objectStorageBlocked
  ? capScore(realGenerationStability.score, 80)
  : realGenerationStability.score;

const deliveryReadiness = scoreChecks([
  {
    name: 'env-example-byok-contract',
    weight: 25,
    pass: /API_BASE|API_KEY|BYOK|ARK/i.test(envExampleText),
  },
  {
    name: 'readme-byok-and-health',
    weight: 25,
    pass: /BYOK/i.test(readmeText) && /health|\/api\/health/i.test(readmeText),
  },
  {
    name: 'entrypoint-retention-doc',
    weight: 20,
    pass: /home/.test(allDocsText) && /node-editor/.test(allDocsText) && /settings\/BYOK|BYOK/.test(allDocsText),
  },
  {
    name: 'sensitive-log-boundary',
    weight: 15,
    pass: /不得把 API key 写入|不输出 key|日志脱敏|sensitive/i.test(allProjectText),
  },
  {
    name: 'task-center-recovery-contract',
    weight: 15,
    pass: /任务中心/.test(allDocsText) && /重试|恢复|retry|resume/.test(allDocsText),
  },
]);

const engineeringHygieneScore = clampScore(100 - (spaghettiDebt / 6));
const overallReadiness = parityAverage === null
  ? null
  : Number((
      parityAverage * 0.20 +
      storyReadabilityScore * 0.20 +
      segmentContinuityScore * 0.15 +
      realGenerationStabilityScore * 0.15 +
      clickableProduct.score * 0.10 +
      engineeringHygieneScore * 0.10 +
      deliveryReadiness.score * 0.10
    ).toFixed(1));

const previous = fs.existsSync(outFile)
  ? JSON.parse(fs.readFileSync(outFile, 'utf8'))
  : null;

const scorecard = {
  ok: sourceStats.hardViolationCount === 0 && videoSubmitForbiddenCount === 0 && staleParityBaselines.length === 0,
  generatedAt: new Date().toISOString(),
  parity: {
    current: evidenceAdjustedParity,
    docBaseline: currentParity,
    average: parityAverage,
    latestImpact: latestParityImpact,
    evidenceAdjustments: parityEvidenceAdjustments,
    staleBaselines: staleParityBaselines,
  },
  readiness: {
    overallReadiness,
    weights: {
      demoParity: 20,
      storyReadability: 20,
      segmentContinuity: 15,
      realGenerationStability: 15,
      clickableProduct: 10,
      engineeringHygiene: 10,
      deliveryReadiness: 10,
    },
    inputs: {
      demoParityScore: parityAverage,
      storyReadabilityScore,
      segmentContinuityScore,
      handoffPunchThroughRate,
      realPunchThrough,
      latestRealHandoffOk: latestRealHandoff.ok,
      latestRealHandoffProviderTaskIdCoverageRate: latestRealHandoff.providerTaskIdCoverageRate ?? null,
      latestRealHandoffAudioTrackCoverageRate: latestRealHandoff.audioTrackCoverageRate ?? null,
      latestRealHandoffAudioCueWritebackRate: latestRealHandoff.audioCueWritebackRate ?? null,
      latestRealHandoffDownstreamAudioCueUsageRate: latestRealHandoff.downstreamAudioCueUsageRate ?? null,
      boundaryBridgeMechanismReady: boundaryContinuity.sourceBoundaryMechanismReady ?? null,
      boundaryRuntimePlanCoverageRate: boundaryContinuity.runtime?.runtimeBoundaryPlanCoverageRate ?? null,
      boundaryRuntimeBridgeGeneratedRate: boundaryContinuity.runtime?.runtimeBridgeGeneratedRate ?? null,
      multisegmentChainOk: multisegmentChain.ok,
      multisegmentChainSegmentCount: multisegmentChain.segmentCount ?? null,
      multisegmentChainTailFrameWritebackRate: multisegmentChain.punchThrough?.tailFrameWritebackRate ?? null,
      multisegmentChainNextFirstFrameUsageRate: multisegmentChain.punchThrough?.nextSegmentFirstFrameUsageRate ?? null,
      multisegmentChainNextAudioCueUsageRate: multisegmentChain.punchThrough?.nextSegmentAudioCueUsageRate ?? null,
      sixtySecondEffectScore,
      sixtySecondGoldenCaseScore,
      sixtySecondDeepReviewScore,
      realSixtySecondLatestCaseScore,
      sixtySecondSemanticReviewScore,
      sixtySecondSemanticLabelScore,
      realGenerationStabilityScore,
      clickableProductScore: clickableProduct.score,
      engineeringHygieneScore,
      deliveryReadinessScore: deliveryReadiness.score,
    },
    caps: {
      storyQualityOpenIssue,
      objectStorageBlocked,
      realHandoffBlocked,
    },
    evidence: {
      storyReadability: storyReadability.checks,
      segmentContinuity: segmentContinuity.checks,
      realPunchThrough,
      latestRealHandoff,
      boundaryContinuity,
      multisegmentChain,
      realGenerationStability: realGenerationStability.checks,
      sixtySecondEffect,
      sixtySecondGoldenCase,
      sixtySecondDeepReview,
      realSixtySecondLatestCase,
      sixtySecondSemanticReview,
      clickableProduct: clickableProduct.checks,
      deliveryReadiness: deliveryReadiness.checks,
    },
  },
  spaghetti: {
    debtScore: spaghettiDebt,
    ...sourceStats,
    videoSubmitRouteLines: lineCount(videoSubmitText),
    videoSubmitForbiddenCount,
  },
  deltaFromPrevious: previous
    ? {
        parityAverage: parityAverage !== null && previous.parity?.average !== null
          ? Number((parityAverage - previous.parity.average).toFixed(1))
          : null,
        debtScore: spaghettiDebt - previous.spaghetti.debtScore,
        largeComponentCount: sourceStats.largeComponentCount - previous.spaghetti.largeComponentCount,
        largeRouteCount: sourceStats.largeRouteCount - previous.spaghetti.largeRouteCount,
        directProviderSdkRouteCount: sourceStats.directProviderSdkRouteCount - previous.spaghetti.directProviderSdkRouteCount,
        legacyProviderReferenceCount: sourceStats.legacyProviderReferenceCount - previous.spaghetti.legacyProviderReferenceCount,
        largeFileLineDebt: previous.spaghetti.largeFileLineDebt !== undefined
          ? sourceStats.largeFileLineDebt - previous.spaghetti.largeFileLineDebt
          : null,
        largestFileLines: previous.spaghetti.largestFileLines !== undefined
          ? sourceStats.largestFileLines - previous.spaghetti.largestFileLines
          : null,
        videoSubmitRouteLines: lineCount(videoSubmitText) - previous.spaghetti.videoSubmitRouteLines,
        overallReadiness: overallReadiness !== null && previous.readiness?.overallReadiness !== null && previous.readiness?.overallReadiness !== undefined
          ? Number((overallReadiness - previous.readiness.overallReadiness).toFixed(1))
          : null,
        storyReadabilityScore: previous.readiness?.inputs?.storyReadabilityScore !== undefined
          ? storyReadability.score - previous.readiness.inputs.storyReadabilityScore
          : null,
        segmentContinuityScore: previous.readiness?.inputs?.segmentContinuityScore !== undefined
          ? segmentContinuity.score - previous.readiness.inputs.segmentContinuityScore
          : null,
        handoffPunchThroughRate: previous.readiness?.inputs?.handoffPunchThroughRate !== undefined
          ? Number((handoffPunchThroughRate - previous.readiness.inputs.handoffPunchThroughRate).toFixed(2))
          : null,
        nextSegmentFirstFrameUsageRate: previous.readiness?.inputs?.realPunchThrough?.nextSegmentFirstFrameUsageRate !== undefined
          && realPunchThrough.nextSegmentFirstFrameUsageRate !== null
          ? Number((realPunchThrough.nextSegmentFirstFrameUsageRate - previous.readiness.inputs.realPunchThrough.nextSegmentFirstFrameUsageRate).toFixed(3))
          : null,
        clickableProductScore: previous.readiness?.inputs?.clickableProductScore !== undefined
          ? clickableProduct.score - previous.readiness.inputs.clickableProductScore
          : null,
        sixtySecondGoldenCaseScore: previous.readiness?.inputs?.sixtySecondGoldenCaseScore !== undefined
          ? sixtySecondGoldenCaseScore - previous.readiness.inputs.sixtySecondGoldenCaseScore
          : null,
        sixtySecondDeepReviewScore: previous.readiness?.inputs?.sixtySecondDeepReviewScore !== undefined
          ? sixtySecondDeepReviewScore - previous.readiness.inputs.sixtySecondDeepReviewScore
          : null,
        realSixtySecondLatestCaseScore: previous.readiness?.inputs?.realSixtySecondLatestCaseScore !== undefined
          ? realSixtySecondLatestCaseScore - previous.readiness.inputs.realSixtySecondLatestCaseScore
          : null,
      }
    : null,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(scorecard, null, 2)}\n`);

console.log(JSON.stringify(scorecard, null, 2));

if (!scorecard.ok) {
  process.exit(1);
}
