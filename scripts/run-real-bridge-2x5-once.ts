import fs from 'node:fs';
import path from 'node:path';

import type { ProductionAssemblyPlan, ProductionSegmentPlan } from '../src/lib/production-assembly-plan';
import {
  buildMemberBailianConnections,
  resolveMemberBailianProfileForOwner,
} from '../src/lib/account/member-bailian-profile';
import { applyVimaxBridgeTailRevisionForRetry } from '../src/lib/production-segment-retry';
import { readMemberFinalVideo, getFinalVideoStoreRoot } from '../src/lib/final-videos/member-final-video-store';
import { reviewVimaxBridgeTail } from '../src/lib/skills/vimax-short-drama/vimax-bridge-tail-acceptance';
import { runVimaxProductionVideoOrchestrator } from '../src/lib/skills/vimax-short-drama/vimax-production-video-orchestrator';
import {
  createTask,
  getTaskForOwner,
  updateTask,
  type BackgroundTask,
  type TaskOwner,
} from '../src/lib/task-manager';

const SOURCE_TASK_ID = '75520224-31a7-440d-adeb-f6d0922347e1';
const RUN_ID = 'bridge-2x5-20260727-a';

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function taskList(value: unknown): BackgroundTask[] {
  if (Array.isArray(value)) return value as BackgroundTask[];
  if (value && typeof value === 'object') {
    const record = value as { tasks?: unknown };
    if (Array.isArray(record.tasks)) return record.tasks as BackgroundTask[];
    return Object.values(value as Record<string, BackgroundTask>);
  }
  return [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanPrompt(shot: Record<string, unknown>) {
  return [
    `镜头《${safeText(shot.title)}》。`,
    `动作起点：${safeText(shot.actionStart)}。`,
    `动作终点：${safeText(shot.actionEnd)}。`,
    `首帧：${safeText(shot.firstFrameDescription)}。`,
    `尾帧：${safeText(shot.lastFrameDescription)}。`,
    `镜头运动：${safeText(shot.motionDescription)}。`,
    `声音：${safeText(shot.audioIntent)}。`,
    '无对白，无旁白，不出现字幕或制作说明。',
  ].join('\n');
}

function cleanSegment(params: {
  source: ProductionSegmentPlan;
  shot: Record<string, unknown>;
  index: number;
  firstFrameUrl: string | null;
  boundaryIntent: 'bridge' | 'continue';
}): ProductionSegmentPlan {
  const { source, shot, index, firstFrameUrl, boundaryIntent } = params;
  const nextIndex = index + 1;
  const actionStart = safeText(shot.actionStart);
  const actionEnd = safeText(shot.actionEnd);
  const firstFrame = safeText(shot.firstFrameDescription);
  const lastFrame = safeText(shot.lastFrameDescription);
  const motion = safeText(shot.motionDescription);
  const audio = safeText(shot.audioIntent);
  const scene = safeText(shot.sceneId) || 'scene-2';
  const characterIds = Array.isArray(shot.characterIds)
    ? shot.characterIds.map(safeText).filter(Boolean)
    : ['character-1'];
  const propIds = Array.isArray(shot.propIds)
    ? shot.propIds.map(safeText).filter(Boolean)
    : [];
  const anchors = index === 0
    ? ['林浅', '深蓝风衣', '铁门', '放映机']
    : ['林浅', '深蓝风衣', '放映机', '投影墙'];
  const id = `${RUN_ID}-segment-${nextIndex}`;
  const shotId = `${RUN_ID}-shot-${nextIndex}`;
  return {
    ...clone(source),
    id,
    index,
    shotId,
    duration: 5,
    prompt: cleanPrompt(shot),
    status: 'queued',
    error: null,
    startedAt: undefined,
    completedAt: undefined,
    generationRoute: {
      mode: 'first-frame',
      requestedBy: 'planner',
      reason: '所有正式片段从已验收首帧进入同一视频模型。',
      model: 'happyhorse-1.1-i2v',
      requiresPreviousLastFrame: true,
      canonicalFirstFrameRequired: false,
      referenceRoles: [],
      requiresConfirmation: false,
      boundaryIntent,
    },
    dependencies: {
      scriptAssetId: undefined,
      characterAssetIds: characterIds,
      sceneAssetIds: [scene],
      propAssetIds: propIds,
    },
    expectedInputs: {
      firstFrameUrl,
      previousLastFrameUrl: firstFrameUrl,
      sourceSegmentId: index === 0 ? 'source-shot-4' : `${RUN_ID}-segment-1`,
      sourceAssetId: index === 0 ? 'source-video-shot-4' : null,
      continuityPrompt: index === 0
        ? `从真实尾帧继续：${actionStart}`
        : `从上一镜验收尾帧继续：${actionStart}`,
      previousAudioCue: index === 0 ? '雨声和人物脚步声。' : null,
      audioContinuityPrompt: index === 0 ? '门关闭后雨声自然变闷。' : null,
      previousStoryStateCue: index === 0 ? actionStart : null,
      storyContinuityPrompt: index === 0 ? `从${actionStart}继续。` : null,
      boundaryBridgeId: null,
      boundaryBridgePrompt: null,
      bridgeFirstFrameUrl: null,
      bridgeStrategy: 'direct-tail-frame-fallback',
      canonicalFirstFrame: undefined,
    },
    expectedOutputs: {
      videoUrl: null,
      lastFrameUrl: null,
      taskId: null,
      providerTaskId: null,
      audioCue: null,
      hasAudio: null,
      storyStateCue: null,
      bridgeTailAcceptance: undefined,
    },
    audioState: {
      dialogue: null,
      narration: null,
      soundDesign: audio,
      voiceStyle: '无对白，人物自然呼吸。',
      emotion: index === 0 ? '警觉' : '震惊',
      audioCue: `旁白=无；对白=无；声音=${audio}`,
    },
    shotFrameContract: {
      ...clone(source.shotFrameContract),
      shotId,
      shotIndex: index,
      variationType: 'large',
      variationReason: index === 0 ? '跨场动作在同一镜头内完成。' : '承接已验收尾帧继续推进室内动作。',
      firstFrame: {
        description: firstFrame,
        visibleCharacterIds: characterIds,
        requiredAssetIds: [...characterIds, scene, ...propIds],
        continuityAnchors: anchors,
      },
      lastFrame: {
        description: lastFrame,
        visibleCharacterIds: characterIds,
        requiredAssetIds: [...characterIds, scene, ...propIds],
        continuityAnchors: anchors,
      },
      motionDescription: motion,
      audioDescription: audio,
      visualStoryEvidence: {
        threatTarget: '',
        conflictEvidence: `${actionStart}与${actionEnd}必须在画面中形成连续变化。`,
        operationResultEvidence: actionEnd,
        endingHookEvidence: lastFrame,
        viewerReadabilityTest: `观众无需字幕即可看懂：${actionStart}，随后${actionEnd}。`,
      },
      handoff: {
        requiresPreviousLastFrame: true,
        previousShotId: index === 0 ? 'source-shot-4' : `${RUN_ID}-shot-1`,
        nextShotId: index === 0 ? `${RUN_ID}-shot-2` : null,
        entryContinuity: actionStart,
        exitContinuity: actionEnd,
      },
      readiness: { pass: true, blockers: [], warnings: [] },
    },
    storySegmentContract: {
      ...clone(source.storySegmentContract),
      segmentId: id,
      index,
      shotId,
      videoDesc: {
        visibleAction: motion,
        visualCausality: `${actionStart}，动作推进后${actionEnd}。`,
        entryState: actionStart,
        exitState: actionEnd,
        continuityAnchors: anchors,
        requiredAssetIds: [...characterIds, scene, ...propIds],
      },
      storyState: {
        protagonist: '林浅',
        currentGoal: index === 0 ? '进入铁门后的房间继续追查发光胶片' : '确认放映机正在播放什么',
        conflict: index === 0 ? '雨夜天台与未知黑暗空间之间的迟疑' : '投影呈现出刚发生的天台画面',
        obstacle: index === 0 ? '室内完全黑暗' : '眼前影像违反正常时间顺序',
        scene: '废弃放映室',
        keyProp: index === 0 ? '铁门与放映机' : '放映机与发光胶片',
        emotionalState: index === 0 ? '警觉而克制' : '震惊而专注',
        visibleStateChange: actionEnd,
      },
      audioContract: {
        dialogue: null,
        narration: null,
        soundDesign: audio,
        voiceStyle: '无对白，人物自然呼吸。',
        audioCue: `旁白=无；对白=无；声音=${audio}`,
        previousAudioCue: index === 0 ? '雨声和人物脚步声。' : null,
        requiresAudioContinuity: true,
        audioEventContract: {
          dialogueType: 'none',
          lipSyncPolicy: 'ambient-only',
          mustGenerateAudioTrack: true,
          expectedAudioEvidence: [audio],
          providerInstruction: `不生成对白或旁白，只生成动作和环境声：${audio}`,
        },
      },
      dependencyContract: {
        previousSegmentId: index === 0 ? 'source-shot-4' : `${RUN_ID}-segment-1`,
        nextSegmentId: index === 0 ? `${RUN_ID}-segment-2` : null,
        requiresPreviousLastFrame: true,
        expectedFirstFrameUrl: firstFrameUrl,
        expectedPreviousLastFrameUrl: firstFrameUrl,
        previousStoryStateCue: index === 0 ? actionStart : null,
        sourceSegmentId: index === 0 ? 'source-shot-4' : `${RUN_ID}-segment-1`,
        sourceAssetId: index === 0 ? 'source-video-shot-4' : null,
      },
      readiness: { pass: true, blockers: [], warnings: [] },
    },
    artifactReadiness: undefined,
    retryPolicy: {
      maxRetries: 1,
      retryable: true,
      fallback: '保留已完成镜头，只重做当前镜头。',
    },
  };
}

function saveDataImage(value: string | null | undefined, target: string) {
  if (!value?.startsWith('data:image/')) return null;
  const comma = value.indexOf(',');
  if (comma < 0) return null;
  fs.writeFileSync(target, Buffer.from(value.slice(comma + 1), 'base64'), { mode: 0o600 });
  return target;
}

async function main() {
  const sourceTasksFile = requiredEnv('HUIYING_SOURCE_TASKS_FILE');
  const outputDir = requiredEnv('HUIYING_REAL_RUN_OUTPUT_DIR');
  fs.mkdirSync(outputDir, { recursive: true });
  const lockFile = path.join(outputDir, `${RUN_ID}.lock.json`);
  const reportFile = path.join(outputDir, `${RUN_ID}.report.json`);
  const lockFd = fs.openSync(lockFile, 'wx', 0o600);
  fs.writeFileSync(lockFd, JSON.stringify({
    runId: RUN_ID,
    sourceTaskId: SOURCE_TASK_ID,
    startedAt: new Date().toISOString(),
    maxVideoSegments: 2,
  }, null, 2));
  fs.closeSync(lockFd);

  let parentTaskId: string | null = null;
  let providerSubmitted = false;
  try {
    const sourceRoot = JSON.parse(fs.readFileSync(sourceTasksFile, 'utf8')) as unknown;
    const sourceTasks = taskList(sourceRoot);
    const sourceTask = sourceTasks.find(task => task.id === SOURCE_TASK_ID);
    if (!sourceTask?.owner) throw new Error('source_task_owner_missing');
    const owner: TaskOwner = sourceTask.owner;
    const active = sourceTasks.filter(task =>
      task.owner?.tenantId === owner.tenantId
      && task.owner?.memberId === owner.memberId
      && (task.status === 'pending' || task.status === 'running')
    );
    if (active.length > 0) throw new Error('owner_has_active_task');

    const sourceResult = sourceTask.result as Record<string, unknown> | undefined;
    const sourceAssembly = sourceResult?.assemblyPlan as ProductionAssemblyPlan | undefined;
    const sourceProject = sourceResult?.productionProject as Record<string, unknown> | undefined;
    const vimaxPlan = sourceResult?.vimaxPlan as { shots?: Array<Record<string, unknown>> } | undefined;
    if (!sourceAssembly || !sourceProject || !vimaxPlan?.shots?.[4] || !vimaxPlan.shots[5]) {
      throw new Error('source_task_materials_missing');
    }
    const oldBridge = sourceAssembly.segments[4];
    const oldNext = sourceAssembly.segments[5];
    const sourceFirstFrame = oldBridge?.expectedInputs.firstFrameUrl
      || oldBridge?.expectedInputs.previousLastFrameUrl;
    const sourceObservedTail = oldBridge?.expectedOutputs.lastFrameUrl;
    if (!oldBridge || !oldNext || !sourceFirstFrame || !sourceObservedTail) {
      throw new Error('source_bridge_frames_missing');
    }

    const profile = await resolveMemberBailianProfileForOwner(owner);
    const connections = buildMemberBailianConnections(profile);
    const bridgeShot = vimaxPlan.shots[4];
    const nextShot = vimaxPlan.shots[5];
    const oldAcceptance = await reviewVimaxBridgeTail({
      connection: connections.planning,
      sourceLastFrameUrl: sourceFirstFrame,
      observedLastFrameUrl: sourceObservedTail,
      plannedStartState: safeText(bridgeShot.actionStart),
      plannedEndState: safeText(bridgeShot.actionEnd),
      nextPlannedStartState: safeText(nextShot.actionStart),
      sceneId: safeText(bridgeShot.sceneId),
      actionPhase: safeText(bridgeShot.motionDescription),
      anchors: ['林浅', '深蓝风衣', '铁门', '放映机'],
    });
    if (oldAcceptance.status !== 'rejected' || !oldAcceptance.revisionInstruction) {
      throw new Error('characterization_did_not_reproduce_bridge_failure');
    }

    let first = cleanSegment({
      source: oldBridge,
      shot: bridgeShot,
      index: 0,
      firstFrameUrl: sourceFirstFrame,
      boundaryIntent: 'bridge',
    });
    first = applyVimaxBridgeTailRevisionForRetry({
      ...first,
      expectedOutputs: {
        ...first.expectedOutputs,
        bridgeTailAcceptance: oldAcceptance,
      },
    });
    const second = cleanSegment({
      source: oldNext,
      shot: nextShot,
      index: 1,
      firstFrameUrl: null,
      boundaryIntent: 'continue',
    });

    parentTaskId = createTask('storyboard', {
      workflow: 'vimax-real-bridge-2x5-once',
      prompt: '跨场连续性一次性验证',
      idempotencyKey: RUN_ID,
    }, owner);
    const project = clone(sourceProject) as Record<string, unknown> & {
      storyboard?: { shots?: Array<Record<string, unknown>> };
      graph?: { nodes?: unknown[]; edges?: unknown[] };
    };
    project.id = `${RUN_ID}-project`;
    project.title = '雨夜回响：推开未知';
    project.prompt = '林浅从雨夜天台推门进入废弃放映室，发现放映机正在播放她刚才的影像。';
    project.duration = 10;
    if (project.storyboard?.shots) {
      project.storyboard.shots = project.storyboard.shots
        .filter(shot => shot.id === oldBridge.shotId || shot.id === oldNext.shotId)
        .map((shot, index) => ({
          ...shot,
          id: `${RUN_ID}-shot-${index + 1}`,
          index: index + 1,
          title: safeText(vimaxPlan.shots?.[index + 4]?.title),
          status: 'planned',
        }));
    }
    const assemblyPlan: ProductionAssemblyPlan = {
      ...clone(sourceAssembly),
      productionProjectId: String(project.id),
      sourceTaskId: parentTaskId,
      totalDuration: 10,
      segmentCount: 2,
      segmentDurationHint: 5,
      status: 'planned',
      bridgePlan: undefined,
      boundaryBridgePlan: undefined,
      readiness: {
        ...clone(sourceAssembly.readiness),
        pass: true,
        blockerCount: 0,
        warningCount: 0,
        issues: [],
        nextAction: '两个镜头可以依次生成。',
      },
      segments: [first, second],
      assembly: {
        strategy: 'ordered-concat',
        requiresAllSegments: true,
        outputUrl: null,
        exportFormats: ['mp4', 'cut-draft-json'],
      },
      recovery: {
        persistEachSegment: true,
        resumeFromSegmentIndex: 0,
        canRetryFailedSegments: true,
        failurePolicy: '保留已完成片段，只重做失败镜头。',
      },
      nextAction: '按顺序生成两个 5 秒镜头。',
    };
    updateTask(parentTaskId, {
      status: 'completed',
      progress: 100,
      result: {
        productionProject: project,
        assemblyPlan,
        vimaxPlan: {
          title: '雨夜回响：推开未知',
          shots: [bridgeShot, nextShot],
        },
      } as never,
    });

    providerSubmitted = true;
    const videoResult = await runVimaxProductionVideoOrchestrator({
      owner,
      parentTaskId,
      connection: connections.video,
      imageConnection: connections.planning,
      model: 'happyhorse-1.1-i2v',
      generateAudio: true,
      shots: [
        { index: 1, title: safeText(bridgeShot.title) },
        { index: 2, title: safeText(nextShot.title) },
      ],
    });
    const finalTask = getTaskForOwner(parentTaskId, owner);
    const finalPlan = finalTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
    const finalId = videoResult.videoUrl.split('/').pop();
    if (!finalId) throw new Error('final_video_id_missing');
    const finalVideo = await readMemberFinalVideo(getFinalVideoStoreRoot(), owner, finalId);
    const frameFiles = {
      source: saveDataImage(sourceFirstFrame, path.join(outputDir, `${RUN_ID}-source.jpg`)),
      oldRejectedTail: saveDataImage(sourceObservedTail, path.join(outputDir, `${RUN_ID}-old-tail.jpg`)),
      bridgeTail: saveDataImage(
        finalPlan?.segments[0]?.expectedOutputs.lastFrameUrl,
        path.join(outputDir, `${RUN_ID}-bridge-tail.jpg`),
      ),
      nextTail: saveDataImage(
        finalPlan?.segments[1]?.expectedOutputs.lastFrameUrl,
        path.join(outputDir, `${RUN_ID}-next-tail.jpg`),
      ),
    };
    const report = {
      runId: RUN_ID,
      status: 'completed',
      startedFromSourceTask: SOURCE_TASK_ID,
      parentTaskId,
      providerAttemptCount: 1,
      providerVideoSegmentCount: 2,
      model: 'happyhorse-1.1-i2v',
      oldBridgeReview: {
        status: oldAcceptance.status,
        observedEndState: oldAcceptance.observedEndState,
        blockers: oldAcceptance.blockers,
        revisionInstruction: oldAcceptance.revisionInstruction,
      },
      segments: finalPlan?.segments.map(segment => ({
        index: segment.index,
        status: segment.status,
        providerTaskPresent: Boolean(segment.expectedOutputs.providerTaskId),
        videoPresent: Boolean(segment.expectedOutputs.videoUrl),
        lastFramePresent: Boolean(segment.expectedOutputs.lastFrameUrl),
        bridgeTailAcceptance: segment.expectedOutputs.bridgeTailAcceptance
          ? {
              status: segment.expectedOutputs.bridgeTailAcceptance.status,
              observedEndState: segment.expectedOutputs.bridgeTailAcceptance.observedEndState,
              blockers: segment.expectedOutputs.bridgeTailAcceptance.blockers,
            }
          : null,
        firstFrameMatchesPreviousTail: segment.index === 1
          ? segment.expectedInputs.firstFrameUrl === finalPlan.segments[0]?.expectedOutputs.lastFrameUrl
          : null,
      })),
      finalVideo: {
        privateUrl: videoResult.videoUrl,
        serverPath: finalVideo.filePath,
        bytes: finalVideo.bytes,
        duration: videoResult.duration,
        segmentCount: videoResult.segmentCount,
        renderReport: 'renderReport' in videoResult.merge ? videoResult.merge.renderReport : null,
      },
      frames: frameFiles,
      finishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({
      status: report.status,
      parentTaskId,
      providerAttemptCount: report.providerAttemptCount,
      providerVideoSegmentCount: report.providerVideoSegmentCount,
      finalVideo: report.finalVideo,
      reportFile,
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(reportFile, JSON.stringify({
      runId: RUN_ID,
      status: 'failed',
      parentTaskId,
      providerAttemptCount: providerSubmitted ? 1 : 0,
      error: message,
      finishedAt: new Date().toISOString(),
    }, null, 2), { mode: 0o600 });
    throw error;
  }
}

void main();
