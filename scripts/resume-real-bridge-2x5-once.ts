import fs from 'node:fs';
import path from 'node:path';

import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import type { ProductionProject } from '../src/lib/production-project';
import { applySegmentAssetWriteback } from '../src/lib/production-segment-assets';
import { describeStorySegmentCue } from '../src/lib/production-story-segment-contract';
import {
  buildMemberBailianConnections,
  resolveMemberBailianProfileForOwner,
} from '../src/lib/account/member-bailian-profile';
import { readMemberFinalVideo, getFinalVideoStoreRoot } from '../src/lib/final-videos/member-final-video-store';
import { reviewVimaxBridgeTail } from '../src/lib/skills/vimax-short-drama/vimax-bridge-tail-acceptance';
import { runVimaxProductionVideoOrchestrator } from '../src/lib/skills/vimax-short-drama/vimax-production-video-orchestrator';
import {
  getTaskForOwner,
  updateTask,
  type BackgroundTask,
  type TaskOwner,
} from '../src/lib/task-manager';

const RUN_ID = 'bridge-2x5-20260727-a-resume-v4';

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

function saveDataImage(value: string | null | undefined, target: string) {
  if (!value?.startsWith('data:image/')) return null;
  const comma = value.indexOf(',');
  if (comma < 0) return null;
  fs.writeFileSync(target, Buffer.from(value.slice(comma + 1), 'base64'), { mode: 0o600 });
  return target;
}

async function main() {
  const tasksFile = requiredEnv('HUIYING_TASKS_FILE');
  const parentTaskId = requiredEnv('HUIYING_PARENT_TASK_ID');
  const outputDir = requiredEnv('HUIYING_REAL_RUN_OUTPUT_DIR');
  fs.mkdirSync(outputDir, { recursive: true });
  const lockFile = path.join(outputDir, `${RUN_ID}.lock.json`);
  const reportFile = path.join(outputDir, `${RUN_ID}.report.json`);
  const lockFd = fs.openSync(lockFile, 'wx', 0o600);
  fs.writeFileSync(lockFd, JSON.stringify({
    runId: RUN_ID,
    parentTaskId,
    startedAt: new Date().toISOString(),
    allowedNewVideoSegments: 1,
  }, null, 2));
  fs.closeSync(lockFd);

  let reviewProviderCalls = 0;
  let newVideoSegments = 0;
  try {
    const tasks = taskList(JSON.parse(fs.readFileSync(tasksFile, 'utf8')) as unknown);
    const storedParent = tasks.find(task => task.id === parentTaskId);
    if (!storedParent?.owner) throw new Error('parent_task_owner_missing');
    const owner: TaskOwner = storedParent.owner;
    const parent = getTaskForOwner(parentTaskId, owner);
    const originalPlan = parent?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
    if (!parent?.result || !originalPlan || originalPlan.segments.length !== 2) {
      throw new Error('isolated_2x5_plan_missing');
    }
    const first = originalPlan.segments[0];
    const second = originalPlan.segments[1];
    const firstChildId = first.expectedOutputs.taskId;
    if (!firstChildId
      || !first.expectedOutputs.videoUrl
      || !first.expectedOutputs.lastFrameUrl
      || !first.expectedInputs.firstFrameUrl
      || second.expectedOutputs.providerTaskId
      || second.expectedOutputs.videoUrl) {
      throw new Error('resume_precondition_failed');
    }

    const profile = await resolveMemberBailianProfileForOwner(owner);
    const connections = buildMemberBailianConnections(profile);
    const existingAcceptance = first.expectedOutputs.bridgeTailAcceptance;
    if (existingAcceptance?.status !== 'accepted') reviewProviderCalls += 1;
    const acceptance = existingAcceptance?.status === 'accepted'
      ? existingAcceptance
      : await reviewVimaxBridgeTail({
          connection: connections.planning,
          sourceLastFrameUrl: first.expectedInputs.firstFrameUrl,
          observedLastFrameUrl: first.expectedOutputs.lastFrameUrl,
          plannedStartState: first.shotFrameContract.firstFrame.description,
          plannedEndState: first.shotFrameContract.lastFrame.description,
          nextPlannedStartState: second.shotFrameContract.firstFrame.description,
          sceneId: first.dependencies.sceneAssetIds[0] || null,
          actionPhase: first.shotFrameContract.motionDescription,
          anchors: first.shotFrameContract.lastFrame.continuityAnchors,
        });
    if (acceptance.status !== 'accepted') {
      fs.writeFileSync(reportFile, JSON.stringify({
        runId: RUN_ID,
        status: 'review-rejected',
        reviewProviderCalls,
        newVideoSegments,
        observedEndState: acceptance.observedEndState,
        blockers: acceptance.blockers,
        finishedAt: new Date().toISOString(),
      }, null, 2), { mode: 0o600 });
      throw new Error('revised_bridge_review_rejected');
    }

    const storyStateCue = first.expectedOutputs.storyStateCue
      || describeStorySegmentCue(first.storySegmentContract);
    const firstChild = getTaskForOwner(firstChildId, owner);
    if (!firstChild?.result) throw new Error('completed_first_child_result_missing');
    updateTask(firstChildId, {
      status: 'completed',
      progress: 100,
      error: undefined,
      message: '当前镜头已达到自身计划尾态，可以继续下一镜。',
      result: {
        ...firstChild.result,
        bridgeTailAcceptance: acceptance,
        storyStateCue,
      },
    });

    const writeback = applySegmentAssetWriteback({
      productionProject: parent.result.productionProject as ProductionProject,
      assemblyPlan: originalPlan,
      segmentIndex: 0,
      patch: {
        status: 'completed',
        error: null,
        expectedOutputs: {
          ...first.expectedOutputs,
          bridgeTailAcceptance: acceptance,
          storyStateCue,
        },
      },
    });
    updateTask(parentTaskId, {
      result: {
        ...parent.result,
        productionProject: writeback.productionProject || parent.result.productionProject,
        assemblyPlan: writeback.assemblyPlan,
      },
      message: '第一镜已通过真实尾态复核，仅继续尚未生成的第二镜。',
    });

    const result = await runVimaxProductionVideoOrchestrator({
      owner,
      parentTaskId,
      connection: connections.video,
      imageConnection: connections.planning,
      model: 'happyhorse-1.1-i2v',
      generateAudio: true,
      shots: [
        { index: 1, title: '推开未知' },
        { index: 2, title: '昨日重现' },
      ],
    });
    newVideoSegments = 1;
    const finalTask = getTaskForOwner(parentTaskId, owner);
    const finalPlan = finalTask?.result?.assemblyPlan as ProductionAssemblyPlan | undefined;
    const finalId = result.videoUrl.split('/').pop();
    if (!finalId || finalPlan?.status !== 'completed') throw new Error('final_video_not_completed');
    const finalVideo = await readMemberFinalVideo(getFinalVideoStoreRoot(), owner, finalId);
    const firstProviderTaskId = finalPlan.segments[0]?.expectedOutputs.providerTaskId;
    if (firstProviderTaskId !== first.expectedOutputs.providerTaskId) {
      throw new Error('first_segment_was_resubmitted');
    }
    const report = {
      runId: RUN_ID,
      status: 'completed',
      parentTaskId,
      reviewProviderCalls,
      newVideoSegments,
      totalVideoSegments: 2,
      firstSegmentReused: true,
      firstBridgeAcceptance: {
        status: acceptance.status,
        observedEndState: acceptance.observedEndState,
      },
      segments: finalPlan.segments.map(segment => ({
        index: segment.index,
        status: segment.status,
        providerTaskPresent: Boolean(segment.expectedOutputs.providerTaskId),
        videoPresent: Boolean(segment.expectedOutputs.videoUrl),
        lastFramePresent: Boolean(segment.expectedOutputs.lastFrameUrl),
        firstFrameMatchesPreviousTail: segment.index === 1
          ? segment.expectedInputs.firstFrameUrl === finalPlan.segments[0]?.expectedOutputs.lastFrameUrl
          : null,
      })),
      finalVideo: {
        privateUrl: result.videoUrl,
        serverPath: finalVideo.filePath,
        bytes: finalVideo.bytes,
        duration: result.duration,
        segmentCount: result.segmentCount,
      },
      frames: {
        firstTail: saveDataImage(
          finalPlan.segments[0]?.expectedOutputs.lastFrameUrl,
          path.join(outputDir, `${RUN_ID}-first-tail.jpg`),
        ),
        secondTail: saveDataImage(
          finalPlan.segments[1]?.expectedOutputs.lastFrameUrl,
          path.join(outputDir, `${RUN_ID}-second-tail.jpg`),
        ),
      },
      finishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({
      status: report.status,
      reviewProviderCalls,
      newVideoSegments,
      firstSegmentReused: report.firstSegmentReused,
      finalVideo: report.finalVideo,
      reportFile,
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!fs.existsSync(reportFile)) {
      fs.writeFileSync(reportFile, JSON.stringify({
        runId: RUN_ID,
        status: 'failed',
        reviewProviderCalls,
        newVideoSegments,
        error: message,
        finishedAt: new Date().toISOString(),
      }, null, 2), { mode: 0o600 });
    }
    throw error;
  }
}

void main();
