import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-segment-cascade-recovery-'));
process.env.HUIYING_TASKS_FILE = path.join(qaDir, 'tasks.json');

function makeShotFrameContract(index: number, shotId: string) {
  const previousShotId = index > 0 ? `shot-${index}` : null;
  const nextShotId = index < 2 ? `shot-${index + 2}` : null;
  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId,
    shotIndex: index,
    variationType: index === 0 ? 'large' : 'medium',
    variationReason: 'Cascade recovery QA keeps each segment state auditable.',
    firstFrame: {
      description: index === 0
        ? '首帧看见主角站在暴雨站台，红色书包放在右手边。'
        : '首帧复现上一段尾帧：主角举起红色书包，列车灯光进入站台。',
      visibleCharacterIds: ['character-protagonist'],
      requiredAssetIds: ['character-protagonist', 'scene-platform', 'prop-red-bag'],
      continuityAnchors: ['主角', '暴雨站台', '红色书包'],
    },
    lastFrame: {
      description: '尾帧保留主角、红色书包和列车灯光，供下一段接续。',
      visibleCharacterIds: ['character-protagonist'],
      requiredAssetIds: ['character-protagonist', 'scene-platform', 'prop-red-bag'],
      continuityAnchors: ['主角', '暴雨站台', '红色书包'],
    },
    motionDescription: '镜头从站台中景推近到主角举起书包的动作。',
    audioDescription: '雨声和列车进站声。',
    visualStoryEvidence: {
      threatTarget: '最后一班列车和车厢里的孩子必须可见。',
      conflictEvidence: '旧桥警报、列车灯光和红色书包必须形成冲突证据。',
      operationResultEvidence: '主角举起书包后列车灯光或警报状态必须变化。',
      endingHookEvidence: '尾帧留下红色书包和列车灯光作为下一段钩子。',
      viewerReadabilityTest: '观众不看字幕也能说清谁受威胁、危险来自哪里、主角操作后发生了什么。',
    },
    handoff: {
      requiresPreviousLastFrame: index > 0,
      previousShotId,
      nextShotId,
      entryContinuity: index > 0 ? '承接上一段尾帧。' : '建立主角、站台和红色书包。',
      exitContinuity: '尾帧留下红色书包和列车灯光作为下一段锚点。',
    },
    readiness: {
      pass: true,
      blockers: [],
      warnings: [],
    },
  };
}

function makeAudioState(index: number) {
  const dialogue = index === 0
    ? '最后一班车还没过桥。'
    : index === 2
      ? '孩子在那节车厢里。'
      : null;
  const soundDesign = index === 0
    ? '雨声、列车进站声、角色短句对白。'
    : index === 1
      ? '雨声延续，旧桥警报变急。'
      : '雨声被车门开启声压低，车厢广播短促响起。';
  return {
    dialogue,
    narration: null,
    soundDesign,
    voiceStyle: dialogue ? '主角保持警觉但克制的同一声线。' : '主角保持紧张呼吸和停顿。',
    emotion: index === 0 ? '警觉' : index === 1 ? '紧张' : '决断',
    audioCue: `情绪=${index === 0 ? '警觉' : index === 1 ? '紧张' : '决断'}；对白=${dialogue || '无'}；旁白=无；声音=${soundDesign}`,
  };
}

function makeAudioEventContract(audioState: ReturnType<typeof makeAudioState>) {
  return {
    dialogueType: audioState.dialogue ? 'dialogue' as const : 'none' as const,
    lipSyncPolicy: audioState.dialogue ? 'lip-sync-active' as const : 'ambient-only' as const,
    mustGenerateAudioTrack: true,
    expectedAudioEvidence: [
      audioState.dialogue ? `对白原文=${audioState.dialogue}` : '',
      `环境音/音效=${audioState.soundDesign}`,
      `音色/语气=${audioState.voiceStyle}`,
    ].filter(Boolean),
    providerInstruction: audioState.dialogue
      ? `保留对白原文“${audioState.dialogue}”，角色口型必须和对白同步。环境声和音效必须可听见：${audioState.soundDesign}`
      : `本段无对白/旁白，角色嘴唇保持自然静默，只保留环境声和动作声。环境声和音效必须可听见：${audioState.soundDesign}`,
  };
}

function makeStorySegmentContract(index: number, shotId: string) {
  const shotFrameContract = makeShotFrameContract(index, shotId);
  const audioState = makeAudioState(index);
  return {
    version: 'yh-story-segment-contract-v1',
    reference: {
      primary: 'Toonflow-app',
      secondary: ['ViMAX', 'ArcReel'],
      sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate',
    },
    segmentId: `segment-${index + 1}`,
    index,
    shotId,
    videoDesc: {
      visibleAction: shotFrameContract.motionDescription,
      visualCausality: shotFrameContract.visualStoryEvidence.operationResultEvidence,
      entryState: shotFrameContract.handoff.entryContinuity,
      exitState: shotFrameContract.handoff.exitContinuity,
      continuityAnchors: shotFrameContract.firstFrame.continuityAnchors,
      requiredAssetIds: shotFrameContract.firstFrame.requiredAssetIds,
    },
    storyState: {
      protagonist: '主角',
      currentGoal: index === 0 ? '在暴雨站台建立末班列车危机' : '承接上一段尾帧继续阻止旧桥事故',
      conflict: '最后一班列车即将驶向危险旧桥',
      obstacle: '警报和暴雨阻断行动',
      scene: '暴雨站台',
      keyProp: '红色书包',
      emotionalState: audioState.emotion,
      visibleStateChange: shotFrameContract.visualStoryEvidence.operationResultEvidence,
    },
    audioContract: {
      dialogue: audioState.dialogue,
      narration: audioState.narration,
      soundDesign: audioState.soundDesign,
      voiceStyle: audioState.voiceStyle,
      audioCue: audioState.audioCue,
      previousAudioCue: null,
      requiresAudioContinuity: index > 0,
      audioEventContract: makeAudioEventContract(audioState),
    },
    dependencyContract: {
      previousSegmentId: index > 0 ? `segment-${index}` : null,
      nextSegmentId: index < 2 ? `segment-${index + 2}` : null,
      requiresPreviousLastFrame: index > 0,
      expectedFirstFrameUrl: null,
      expectedPreviousLastFrameUrl: null,
      previousStoryStateCue: null,
      sourceSegmentId: index > 0 ? `segment-${index}` : null,
      sourceAssetId: null,
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  };
}

async function main() {
  const taskManager = await import('../src/lib/task-manager');
  const segmentAssets = await import('../src/lib/production-segment-assets');
  const retryService = await import('../src/lib/production-segment-retry');
  const startService = await import('../src/lib/production-segment-start');
  const storyContract = await import('../src/lib/production-story-segment-contract');

  const parentTaskId = taskManager.createTask('storyboard', {
    workflow: 'smart-director-chain',
    prompt: 'Cascade recovery handoff QA',
  });
  const firstChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 0,
    assemblySegmentId: 'segment-1',
    productionProjectId: 'cascade-recovery-qa',
    shotId: 'shot-1',
    ratio: '16:9',
  });
  const secondChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 1,
    assemblySegmentId: 'segment-2',
    productionProjectId: 'cascade-recovery-qa',
    shotId: 'shot-2',
    ratio: '16:9',
  });
  const thirdChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 2,
    assemblySegmentId: 'segment-3',
    productionProjectId: 'cascade-recovery-qa',
    shotId: 'shot-3',
    ratio: '16:9',
  });

  const productionProject = {
    id: 'cascade-recovery-qa',
    title: 'Cascade recovery QA',
    prompt: '最后一班列车两段恢复验证',
    style: '现实悬疑',
    ratio: '16:9',
    sceneType: 'drama',
    duration: 18,
    segmentDuration: 6,
    assets: [
      { id: 'storyboard-1', kind: 'storyboard', name: '分镜', status: 'ready', summary: '分镜', source: 'storyboard' },
      { id: 'deliverable-1', kind: 'deliverable', name: '成片', status: 'pending', summary: '等待合成', source: 'system' },
    ],
    stages: [
      { id: 'assembly', name: '片段合成', status: 'pending', summary: 'pending', assetIds: ['deliverable-1'] },
    ],
    graph: {
      nodes: [
        { id: 'storyboard-1', kind: 'storyboard', name: '分镜', status: 'ready' },
        { id: 'deliverable-1', kind: 'deliverable', name: '成片', status: 'pending' },
      ],
      edges: [],
    },
    storyboard: {
      shotCount: 3,
      totalDuration: 18,
      shots: [
        { id: 'shot-1', index: 1, duration: 6, storyBeat: 'setup', prompt: '第一段', status: 'planned' },
        { id: 'shot-2', index: 2, duration: 6, storyBeat: 'conflict', prompt: '第二段', status: 'planned' },
        { id: 'shot-3', index: 3, duration: 6, storyBeat: 'choice', prompt: '第三段', status: 'planned' },
      ],
    },
    semanticPlan: {
      assetLinks: {
        storyboardAssetId: 'storyboard-1',
        deliverableAssetId: 'deliverable-1',
      },
      dag: {
        nodes: [
          { nodeId: 'n_video_shot-1', name: '视频片段-1', agent: 'video_agent', dependencies: [], status: 'pending' },
          { nodeId: 'n_video_shot-2', name: '视频片段-2', agent: 'video_agent', dependencies: ['n_video_shot-1'], status: 'pending' },
          { nodeId: 'n_video_shot-3', name: '视频片段-3', agent: 'video_agent', dependencies: ['n_video_shot-2'], status: 'pending' },
          { nodeId: 'n_assembly', name: '合成', agent: 'assembly_agent', dependencies: ['n_video_shot-1', 'n_video_shot-2', 'n_video_shot-3'], status: 'pending' },
        ],
      },
    },
    output: { status: 'pending', taskId: parentTaskId, canProceedToVideo: false, nextStep: '等待片段' },
  };

  const assemblyPlan = {
    version: 'yh-assembly-plan-v1',
    reference: { primary: 'ArcReel', adaptedIdeas: ['dependency claim gate', 'cascade fail'] },
    productionProjectId: productionProject.id,
    sourceTaskId: parentTaskId,
    totalDuration: 18,
    segmentCount: 3,
    segmentDurationHint: 6,
    status: 'planned',
    readiness: {
      version: 'yh-assembly-readiness-v1',
      pass: true,
      checkedAt: new Date(0).toISOString(),
      source: 'shot-frame-contract',
      blockerCount: 0,
      warningCount: 0,
      issues: [],
      nextAction: 'queue segments',
    },
    segments: [
      {
        id: 'segment-1',
        index: 0,
        shotId: 'shot-1',
        duration: 6,
        prompt: '第一段：建立暴雨站台、主角和红色书包。',
        status: 'queued',
        dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
        expectedInputs: {
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceSegmentId: null,
          sourceAssetId: null,
          continuityPrompt: '第一段建立空间和主角目标。',
          previousAudioCue: null,
          audioContinuityPrompt: '第一段建立暴雨站台声音。',
          previousStoryStateCue: null,
          storyContinuityPrompt: '第一段建立故事状态。',
        },
        expectedOutputs: {
          taskId: firstChildTaskId,
          videoUrl: null,
          lastFrameUrl: null,
          providerTaskId: null,
          audioCue: makeAudioState(0).audioCue,
          storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1') as any),
        },
        audioState: makeAudioState(0),
        shotFrameContract: makeShotFrameContract(0, 'shot-1'),
        storySegmentContract: makeStorySegmentContract(0, 'shot-1'),
        retryPolicy: { maxRetries: 1, retryable: true, fallback: 'retry-segment' },
      },
      {
        id: 'segment-2',
        index: 1,
        shotId: 'shot-2',
        duration: 6,
        prompt: '第二段：承接上一段尾帧，旧桥警报升级。',
        generationRoute: {
          mode: 'first-frame',
          requestedBy: 'planner',
          reason: '延续上一镜动作与空间方向。',
          model: 'happyhorse-1.1-i2v',
          requiresPreviousLastFrame: true,
          referenceRoles: [],
        },
        status: 'queued',
        dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
        expectedInputs: {
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceSegmentId: 'segment-1',
          sourceAssetId: null,
          continuityPrompt: '等待第一段尾帧。',
          previousAudioCue: null,
          audioContinuityPrompt: '等待第一段声音状态。',
          previousStoryStateCue: null,
          storyContinuityPrompt: '等待第一段故事状态。',
        },
        expectedOutputs: {
          taskId: secondChildTaskId,
          videoUrl: null,
          lastFrameUrl: null,
          providerTaskId: null,
          audioCue: makeAudioState(1).audioCue,
          storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(1, 'shot-2') as any),
        },
        audioState: makeAudioState(1),
        shotFrameContract: makeShotFrameContract(1, 'shot-2'),
        storySegmentContract: makeStorySegmentContract(1, 'shot-2'),
        retryPolicy: { maxRetries: 1, retryable: true, fallback: 'retry-segment' },
      },
      {
        id: 'segment-3',
        index: 2,
        shotId: 'shot-3',
        duration: 6,
        prompt: '第三段：承接第二段尾帧，车厢孩子成为可见救援目标。',
        generationRoute: {
          mode: 'first-frame',
          requestedBy: 'planner',
          reason: '延续上一镜动作与空间方向。',
          model: 'happyhorse-1.1-i2v',
          requiresPreviousLastFrame: true,
          referenceRoles: [],
        },
        status: 'queued',
        dependencies: { characterAssetIds: [], sceneAssetIds: [], propAssetIds: [] },
        expectedInputs: {
          firstFrameUrl: null,
          previousLastFrameUrl: null,
          sourceSegmentId: 'segment-2',
          sourceAssetId: null,
          continuityPrompt: '等待第二段尾帧。',
          previousAudioCue: 'stale-audio-cue-from-aborted-run',
          audioContinuityPrompt: '旧的声音承接提示必须在级联失败时被清理。',
          previousStoryStateCue: 'stale-story-cue-from-aborted-run',
          storyContinuityPrompt: '旧的故事承接提示必须在级联失败时被清理。',
        },
        expectedOutputs: {
          taskId: thirdChildTaskId,
          videoUrl: null,
          lastFrameUrl: null,
          providerTaskId: null,
          audioCue: makeAudioState(2).audioCue,
          storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(2, 'shot-3') as any),
        },
        audioState: makeAudioState(2),
        shotFrameContract: makeShotFrameContract(2, 'shot-3'),
        storySegmentContract: makeStorySegmentContract(2, 'shot-3'),
        retryPolicy: { maxRetries: 1, retryable: true, fallback: 'retry-segment' },
      },
    ],
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
      failurePolicy: 'failed segment cascades downstream to skipped until retry succeeds',
    },
    nextAction: 'queue segments',
  };

  taskManager.updateTask(parentTaskId, {
    status: 'completed',
    progress: 100,
    result: {
      productionProject,
      assemblyPlan,
      assemblyQueue: {
        version: 'qa',
        sourceTaskId: parentTaskId,
        status: 'planned',
        queuedSegmentCount: 3,
        childTaskIds: [firstChildTaskId, secondChildTaskId, thirdChildTaskId],
        updatedAt: new Date(0).toISOString(),
      },
    } as any,
  });

  taskManager.failTask(firstChildTaskId, 'segment-tail-frame-missing after partial provider result');
  const failedWriteback = segmentAssets.applySegmentAssetWriteback({
    productionProject: productionProject as any,
    assemblyPlan: assemblyPlan as any,
    segmentIndex: 0,
    patch: {
      status: 'failed',
      error: 'segment-tail-frame-missing after partial provider result',
      expectedOutputs: {
        taskId: firstChildTaskId,
        providerTaskId: 'provider-partial-cascade',
        videoUrl: 'https://example.invalid/partial-first.mp4',
        lastFrameUrl: null,
      },
    },
  });
  taskManager.updateTask(parentTaskId, {
    result: {
      productionProject: failedWriteback.productionProject,
      assemblyPlan: failedWriteback.assemblyPlan,
      assemblyQueue: {
        version: 'qa',
        sourceTaskId: parentTaskId,
        status: failedWriteback.assemblyPlan.status,
        queuedSegmentCount: 3,
        childTaskIds: [firstChildTaskId, secondChildTaskId, thirdChildTaskId],
        updatedAt: new Date(1).toISOString(),
      },
    } as any,
  });
  assert(failedWriteback.assemblyPlan.segments[1].status === 'skipped', 'downstream segment should be skipped after first failure');
  assert(failedWriteback.assemblyPlan.segments[1].expectedInputs.firstFrameUrl === null, 'downstream skipped segment must not keep fake first frame');
  assert(failedWriteback.assemblyPlan.segments[2].status === 'skipped', 'third segment should also be skipped after first failure');
  assert(failedWriteback.assemblyPlan.segments[2].expectedInputs.firstFrameUrl === null, 'third skipped segment must not keep fake first frame');
  assert(failedWriteback.assemblyPlan.segments[2].expectedInputs.previousAudioCue === null, 'third skipped segment must clear stale audio cue');
  assert(failedWriteback.assemblyPlan.segments[2].expectedInputs.previousStoryStateCue === null, 'third skipped segment must clear stale story cue');

  const retry = retryService.retryProductionAssemblySegment({
    parentTaskId,
    segmentIndex: 0,
  });
  assert(retry.success === true, 'retry should requeue first segment');
  const parentAfterRetry = taskManager.getTaskFresh(parentTaskId)!;
  const retryAssemblyPlan = parentAfterRetry.result!.assemblyPlan as ProductionAssemblyPlan;
  assert(retryAssemblyPlan.segments[0].status === 'queued', 'first segment should be queued after retry');
  assert(retryAssemblyPlan.segments[1].status === 'queued', 'downstream segment should be released to queued after retry');
  assert(retryAssemblyPlan.segments[2].status === 'queued', 'third segment should be released to queued after retry');
  assert(retryAssemblyPlan.segments[2].expectedInputs.previousAudioCue === null, 'third retry release must keep stale audio cue cleared');
  assert(retryAssemblyPlan.segments[2].expectedInputs.previousStoryStateCue === null, 'third retry release must keep stale story cue cleared');

  const completedWriteback = segmentAssets.applySegmentAssetWriteback({
    productionProject: parentAfterRetry.result!.productionProject as any,
    assemblyPlan: retryAssemblyPlan as any,
    segmentIndex: 0,
    patch: {
      status: 'completed',
      completedAt: new Date(2).toISOString(),
      expectedOutputs: {
        taskId: firstChildTaskId,
        providerTaskId: 'provider-recovered-1',
        videoUrl: 'https://example.invalid/recovered-first.mp4',
        lastFrameUrl: 'https://example.invalid/recovered-first-tail.jpg',
        audioCue: makeAudioState(0).audioCue,
        hasAudio: true,
        storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1') as any),
      },
    },
  });
  taskManager.updateTask(parentTaskId, {
    result: {
      ...parentAfterRetry.result,
      productionProject: completedWriteback.productionProject,
      assemblyPlan: completedWriteback.assemblyPlan,
    } as any,
  });

  let thirdBlockedBeforeSecond = false;
  try {
    startService.startProductionAssemblySegment({ childTaskId: thirdChildTaskId });
  } catch (error) {
    thirdBlockedBeforeSecond = error instanceof startService.ProductionSegmentStartError
      && error.details?.code === 'segment-handoff-not-ready';
  }
  assert(thirdBlockedBeforeSecond, 'third segment must remain blocked until second segment writes its own lastFrameUrl');

  const secondDryRun = startService.startProductionAssemblySegment({ childTaskId: secondChildTaskId });
  assert(secondDryRun.success === true, 'second segment dry-run should pass after recovered first segment');
  assert(
    secondDryRun.startPayload.firstFrameImage === 'https://example.invalid/recovered-first-tail.jpg',
    'second segment must use recovered first segment lastFrameUrl'
  );
  assert(
    secondDryRun.startPayload.storyContinuity.previousStoryStateCue === storyContract.describeStorySegmentCue(makeStorySegmentContract(0, 'shot-1') as any),
    'second segment must use recovered first segment storyStateCue'
  );
  assert(
    secondDryRun.startPayload.audioEventContract.mustGenerateAudioTrack === true &&
      secondDryRun.startPayload.audioEventContract.expectedAudioEvidence.length >= 2,
    'second segment should preserve executable audio event contract after recovery'
  );
  assert(secondDryRun.usedRealKey === false && secondDryRun.incurredCost === false, 'cascade recovery QA must not spend real video cost');

  const parentAfterSecondStart = taskManager.getTaskFresh(parentTaskId)!;
  const secondCompletedWriteback = segmentAssets.applySegmentAssetWriteback({
    productionProject: parentAfterSecondStart.result!.productionProject as any,
    assemblyPlan: parentAfterSecondStart.result!.assemblyPlan as any,
    segmentIndex: 1,
    patch: {
      status: 'completed',
      completedAt: new Date(3).toISOString(),
      expectedOutputs: {
        taskId: secondChildTaskId,
        providerTaskId: 'provider-recovered-2',
        videoUrl: 'https://example.invalid/recovered-second.mp4',
        lastFrameUrl: 'https://example.invalid/recovered-second-tail.jpg',
        audioCue: makeAudioState(1).audioCue,
        hasAudio: true,
        storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(1, 'shot-2') as any),
      },
    },
  });
  taskManager.updateTask(parentTaskId, {
    result: {
      ...parentAfterSecondStart.result,
      productionProject: secondCompletedWriteback.productionProject,
      assemblyPlan: secondCompletedWriteback.assemblyPlan,
    } as any,
  });

  const thirdDryRun = startService.startProductionAssemblySegment({ childTaskId: thirdChildTaskId });
  assert(thirdDryRun.success === true, 'third segment dry-run should pass after recovered second segment');
  assert(
    thirdDryRun.startPayload.firstFrameImage === 'https://example.invalid/recovered-second-tail.jpg',
    'third segment must use recovered second segment lastFrameUrl'
  );
  assert(
    thirdDryRun.startPayload.storyContinuity.previousStoryStateCue === storyContract.describeStorySegmentCue(makeStorySegmentContract(1, 'shot-2') as any),
    'third segment must use recovered second segment storyStateCue'
  );
  assert(
    thirdDryRun.startPayload.audioContinuity.previousAudioCue === makeAudioState(1).audioCue,
    'third segment must use recovered second segment audioCue'
  );
  assert(thirdDryRun.usedRealKey === false && thirdDryRun.incurredCost === false, 'third segment recovery QA must not spend real video cost');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'partial-failure-cascade-skips-downstream',
      'retry-releases-downstream-to-queued',
      'stale-story-and-audio-cues-cleared-on-cascade-retry',
      'third-segment-blocked-until-second-tail-frame',
      'recovered-first-segment-writes-last-frame',
      'second-segment-start-uses-recovered-last-frame',
      'second-segment-preserves-audio-event-contract',
      'third-segment-start-uses-second-last-frame-and-cues',
    ],
    cascadeRecovery: {
      failedStatus: failedWriteback.assemblyPlan.status,
      retryChildTaskId: retry.childTaskId,
      secondFirstFrameImage: secondDryRun.startPayload.firstFrameImage,
      thirdFirstFrameImage: thirdDryRun.startPayload.firstFrameImage,
      providerTaskIdPreservedOnFailure: failedWriteback.assemblyPlan.segments[0].expectedOutputs.providerTaskId === 'provider-partial-cascade',
    },
  }, null, 2));
}

main()
  .finally(() => {
    fs.rmSync(qaDir, { recursive: true, force: true });
  });
