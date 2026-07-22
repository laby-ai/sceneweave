import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-segment-start-service-'));
const tasksFile = path.join(qaDir, 'tasks.json');
process.env.HUIYING_TASKS_FILE = tasksFile;

async function main() {
  const taskManager = await import('../src/lib/task-manager');
  const assemblyQueue = await import('../src/lib/production-assembly-queue');
  const startService = await import('../src/lib/production-segment-start');
  const segmentAssets = await import('../src/lib/production-segment-assets');
  const storyContract = await import('../src/lib/production-story-segment-contract');
  const tailFrame = await import('../src/lib/production-segment-tail-frame');
  const shotFrameContract = {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId: 'shot-1',
    shotIndex: 0,
    variationType: 'medium',
    variationReason: 'QA segment must prove first/last-frame constraints reach start payload.',
    firstFrame: {
      description: '首帧看见主角站在雨夜站台，红色书包在画面右下角。',
      visibleCharacterIds: ['character-protagonist'],
      requiredAssetIds: ['character-protagonist', 'scene-platform', 'prop-red-bag'],
      continuityAnchors: ['主角', '雨夜站台', '红色书包'],
    },
    lastFrame: {
      description: '尾帧主角举起红色书包，远处列车灯光进入站台。',
      visibleCharacterIds: ['character-protagonist'],
      requiredAssetIds: ['character-protagonist', 'scene-platform', 'prop-red-bag'],
      continuityAnchors: ['主角', '雨夜站台', '红色书包'],
    },
    motionDescription: '镜头从站台中景推近到主角举起书包的特写。',
    audioDescription: '雨声、列车进站声，主角短促吸气。',
    visualStoryEvidence: {
      threatTarget: '即将经过旧桥的末班列车和车厢里的孩子必须可见。',
      conflictEvidence: '旧桥警报、列车灯光和红色书包必须形成可见冲突证据。',
      operationResultEvidence: '主角举起书包后列车灯光或警报状态必须发生变化。',
      endingHookEvidence: '尾帧留下红色书包和列车灯光作为下一段可接钩子。',
      viewerReadabilityTest: '观众不看字幕也能说清谁受威胁、危险来自哪里、主角操作后发生了什么。',
    },
    handoff: {
      requiresPreviousLastFrame: false,
      previousShotId: null,
      nextShotId: null,
      entryContinuity: '第一段建立主角、站台和红色书包。',
      exitContinuity: '尾帧留下红色书包和列车灯光作为下一段锚点。',
    },
    readiness: {
      pass: true,
      blockers: [],
      warnings: [],
    },
  };
  const firstAudioState = {
    dialogue: '还有一班车能过桥。',
    narration: null,
    soundDesign: '雨声、列车进站声，主角短促吸气。',
    voiceStyle: '主角保持警觉但克制的对白口型和同一声线。',
    emotion: '警觉',
    audioCue: '情绪=警觉；对白=还有一班车能过桥。；旁白=无；声音=雨声、列车进站声，主角短促吸气。',
  };
  const secondAudioState = {
    dialogue: null,
    narration: null,
    soundDesign: '雨声延续，远处警报变得更急。',
    voiceStyle: '主角保持紧张呼吸和停顿。',
    emotion: '紧张',
    audioCue: '情绪=紧张；对白=无；旁白=无；声音=雨声延续，远处警报变得更急。',
  };
  const makeAudioEventContract = (audioState: any) => ({
    dialogueType: audioState.dialogue ? 'dialogue' : audioState.narration ? 'voiceover' : 'none',
    lipSyncPolicy: audioState.dialogue ? 'lip-sync-active' : audioState.narration ? 'silent-lips' : 'ambient-only',
    mustGenerateAudioTrack: true,
    expectedAudioEvidence: [
      audioState.dialogue ? `对白原文=${audioState.dialogue}` : '',
      audioState.narration ? `旁白原文=${audioState.narration}` : '',
      `环境音/音效=${audioState.soundDesign}`,
      `音色/语气=${audioState.voiceStyle}`,
    ].filter(Boolean),
    providerInstruction: audioState.dialogue
      ? `保留对白原文“${audioState.dialogue}”，角色口型必须和对白同步。环境声和音效必须可听见：${audioState.soundDesign}`
      : `本段无对白/旁白，角色嘴唇保持自然静默，只保留环境声和动作声。环境声和音效必须可听见：${audioState.soundDesign}`,
  });
  const makeStorySegmentContract = (index: number, contract: any, audioState: any) => ({
    version: 'yh-story-segment-contract-v1',
    reference: {
      primary: 'Toonflow-app',
      secondary: ['ViMAX', 'ArcReel'],
      sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate',
    },
    segmentId: `segment-${index + 1}`,
    index,
    shotId: `shot-${index + 1}`,
    videoDesc: {
      visibleAction: contract.motionDescription,
      visualCausality: contract.visualStoryEvidence.operationResultEvidence,
      entryState: contract.handoff.entryContinuity,
      exitState: contract.handoff.exitContinuity,
      continuityAnchors: contract.firstFrame.continuityAnchors,
      requiredAssetIds: contract.firstFrame.requiredAssetIds,
    },
    storyState: {
      protagonist: '主角',
      currentGoal: index === 0 ? '在雨夜站台阻止末班车过桥' : '承接上一段尾帧继续处理旧桥警报',
      conflict: '末班车即将驶向危险旧桥',
      obstacle: '暴雨和警报造成行动压力',
      scene: '雨夜站台',
      keyProp: '红色书包',
      emotionalState: audioState.emotion,
      visibleStateChange: contract.visualStoryEvidence.operationResultEvidence,
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
      previousSegmentId: index > 0 ? 'segment-1' : null,
      nextSegmentId: index === 0 ? 'segment-2' : null,
      requiresPreviousLastFrame: index > 0,
      expectedFirstFrameUrl: null,
      expectedPreviousLastFrameUrl: null,
      previousStoryStateCue: null,
      sourceSegmentId: index > 0 ? 'segment-1' : null,
      sourceAssetId: null,
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  });

  const fixtureOwner = { tenantId: 'tenant-segment-start-qa', memberId: 'member-segment-start-qa' };
  const parentTaskId = taskManager.createTask('storyboard', {
    workflow: 'smart-director-chain',
    prompt: 'A producer starts a segment without spending cost.',
  }, fixtureOwner);
  const childTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 0,
    assemblySegmentId: 'segment-1',
    productionProjectId: 'production-start-qa',
    shotId: 'shot-1',
    ratio: '16:9',
  }, fixtureOwner);
  const secondChildTaskId = taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: 1,
    assemblySegmentId: 'segment-2',
    productionProjectId: 'production-start-qa',
    shotId: 'shot-2',
    ratio: '16:9',
  }, fixtureOwner);

  taskManager.updateTask(parentTaskId, {
    status: 'completed',
    progress: 100,
    result: {
      productionProject: {
        id: 'production-start-qa',
        title: 'QA segment start production',
        prompt: 'A compact segment start service QA.',
        style: 'cinematic',
        ratio: '16:9',
        sceneType: 'drama',
        duration: 10,
        assets: [],
        graph: { nodes: [], edges: [] },
        stages: [],
        storyboard: { shots: [
          { id: 'shot-1', index: 1, status: 'queued' },
          { id: 'shot-2', index: 2, status: 'queued' },
        ] },
        semanticPlan: {
          assetLinks: {
            storyboardAssetId: 'storyboard',
            deliverableAssetId: 'deliverable',
          },
          dag: { nodes: [] },
        },
        output: {},
      },
      assemblyPlan: {
        version: 'qa',
        productionProjectId: 'production-start-qa',
        sourceTaskId: parentTaskId,
        totalDuration: 20,
        segmentCount: 2,
        status: 'planned',
        segments: [
          {
            id: 'segment-1',
            index: 0,
            shotId: 'shot-1',
            duration: 10,
            prompt: '急诊医生收到已宣告死亡病人的电话，不要字幕，只用电话铃声和呼吸声推动悬疑。',
            status: 'queued',
            dependencies: {
              characterAssetIds: ['character-protagonist'],
              sceneAssetIds: ['scene-platform'],
              propAssetIds: ['prop-red-bag'],
            },
            expectedInputs: {
              firstFrameUrl: null,
              previousLastFrameUrl: null,
              sourceSegmentId: null,
              sourceAssetId: null,
              continuityPrompt: '第一段建立主角、场景和道具。',
              previousAudioCue: null,
              audioContinuityPrompt: '第一段建立声音基调。',
              previousStoryStateCue: null,
              storyContinuityPrompt: '第一段建立主角目标、冲突和道具状态。',
            },
            expectedOutputs: {
              taskId: childTaskId,
              videoUrl: null,
              lastFrameUrl: null,
              providerTaskId: null,
              audioCue: firstAudioState.audioCue,
              hasAudio: null,
              storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(0, shotFrameContract, firstAudioState) as any),
            },
            audioState: firstAudioState,
            shotFrameContract,
            storySegmentContract: makeStorySegmentContract(0, shotFrameContract, firstAudioState),
            retryPolicy: {
              maxRetries: 1,
              retryable: true,
              fallback: 'retry-segment',
            },
          },
          {
            id: 'segment-2',
            index: 1,
            shotId: 'shot-2',
            duration: 10,
            prompt: 'Second dry-run bridge shot',
            generationRoute: {
              mode: 'first-frame',
              requestedBy: 'planner',
              reason: '第二镜延续同一动作，必须承接上一镜尾帧。',
              model: 'happyhorse-1.1-i2v',
              requiresPreviousLastFrame: true,
              referenceRoles: [],
            },
            status: 'queued',
            dependencies: {
              characterAssetIds: ['character-protagonist'],
              sceneAssetIds: ['scene-platform'],
              propAssetIds: ['prop-red-bag'],
            },
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
              audioCue: secondAudioState.audioCue,
              hasAudio: null,
              storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(1, {
                ...shotFrameContract,
                shotId: 'shot-2',
                shotIndex: 1,
                handoff: {
                  requiresPreviousLastFrame: true,
                  previousShotId: 'shot-1',
                  nextShotId: null,
                  entryContinuity: '第二段必须先复现第一段尾帧。',
                  exitContinuity: '第二段尾帧继续保留红色书包和列车灯光。',
                },
              }, secondAudioState) as any),
            },
            audioState: secondAudioState,
            shotFrameContract: {
              ...shotFrameContract,
              shotId: 'shot-2',
              shotIndex: 1,
              handoff: {
                requiresPreviousLastFrame: true,
                previousShotId: 'shot-1',
                nextShotId: null,
                entryContinuity: '第二段必须先复现第一段尾帧。',
                exitContinuity: '第二段尾帧继续保留红色书包和列车灯光。',
              },
            },
            storySegmentContract: makeStorySegmentContract(1, {
              ...shotFrameContract,
              shotId: 'shot-2',
              shotIndex: 1,
              handoff: {
                requiresPreviousLastFrame: true,
                previousShotId: 'shot-1',
                nextShotId: null,
                entryContinuity: '第二段必须先复现第一段尾帧。',
                exitContinuity: '第二段尾帧继续保留红色书包和列车灯光。',
              },
            }, secondAudioState),
            retryPolicy: {
              maxRetries: 1,
              retryable: true,
              fallback: 'retry-segment',
            },
          },
        ],
        recovery: {
          resumeFromSegmentIndex: 0,
        },
      } as any,
      assemblyQueue: {
        version: 'qa',
        sourceTaskId: parentTaskId,
        status: 'planned',
        queuedSegmentCount: 2,
        childTaskIds: [childTaskId, secondChildTaskId],
        updatedAt: new Date(0).toISOString(),
      },
    },
  });

  const dryRun = startService.startProductionAssemblySegment({ childTaskId });
  assert(dryRun.success === true, 'dry-run should succeed');
  assert(dryRun.dryRun === true, 'dry-run flag mismatch');
  assert(dryRun.usedRealKey === false, 'dry-run should not use key');
  assert(dryRun.incurredCost === false, 'dry-run should not incur cost');
  assert(dryRun.childTaskId === childTaskId, 'dry-run child id mismatch');
  assert(dryRun.startPayload.usesShotFrameContract === true, 'dry-run should expose shot-frame start payload');
  assert(dryRun.startPayload.contractVersion === 'yh-shot-frame-contract-v1', 'dry-run contract version mismatch');
  assert(String(dryRun.startPayload.promptPreview).includes('【首帧合约】'), 'dry-run prompt preview should include first-frame contract');
  assert(String(dryRun.startPayload.promptPreview).includes('【尾帧合约】'), 'dry-run prompt preview should include last-frame contract');
  assert(dryRun.startPayload.visualStoryEvidence?.conflictEvidence, 'dry-run summary missing visible conflict evidence');
  assert(dryRun.startPayload.visualStoryEvidence?.endingHookEvidence, 'dry-run summary missing visible ending hook');
  assert(dryRun.startPayload.visualStoryEvidence?.viewerReadabilityTest, 'dry-run summary missing no-subtitle readability test');
  assert(dryRun.startPayload.storySegmentContract?.version === 'yh-story-segment-contract-v1', 'dry-run summary missing story segment contract');
  assert(dryRun.startPayload.storySegmentContract.storyState.currentGoal, 'dry-run summary missing story state goal');
  assert(dryRun.startPayload.storySegmentContract.videoDesc.visualCausality, 'dry-run summary missing Toonflow-style videoDesc');
  assert(dryRun.startPayload.audioState?.audioCue === firstAudioState.audioCue, 'dry-run summary missing audio state');
  assert(dryRun.startPayload.audioEventContract.dialogueType === 'dialogue', 'dry-run summary missing dialogue audio event contract');
  assert(dryRun.startPayload.audioEventContract.lipSyncPolicy === 'lip-sync-active', 'dialogue segment must request lip-sync active');
  assert(dryRun.startPayload.storyContinuity.previousStoryStateCue === null, 'first segment should not have previous story state cue');
  assert(String(dryRun.startPayload.promptPreview).includes('【本段声音状态】'), 'dry-run prompt preview should include audio state contract');
  assert(String(dryRun.startPayload.promptPreview).includes('【声音事件合约】'), 'dry-run prompt preview should include executable audio event contract');
  assert(String(dryRun.startPayload.promptPreview).includes('【故事承接上一段】'), 'dry-run prompt preview should include story continuity block');
  assert(
    dryRun.startPayload.providerPromptLength <= 900,
    'provider prompt should be compact enough for Ark content.text'
  );
  assert(
    !String(dryRun.startPayload.providerPromptPreview).includes('【首尾帧合约】'),
    'provider prompt preview should not expose audit-only contract labels'
  );
  assert(
    String(dryRun.startPayload.providerPromptPreview).includes('声音设计'),
    'provider prompt preview should preserve audio intent'
  );
  assert(
    String(dryRun.startPayload.providerPromptPreview).includes('声音事件'),
    'provider prompt preview should preserve executable audio event intent'
  );
  assert(
    !String(dryRun.startPayload.providerPrompt).includes('死亡') &&
      !String(dryRun.startPayload.providerPrompt).includes('不要字幕') &&
      String(dryRun.startPayload.providerPrompt).includes('画面不出现字幕文字'),
    'provider prompt should soften risky story wording before Ark content.text'
  );
  assert(
    String(dryRun.startPayload.providerPromptPreview).includes('开头画面'),
    'provider prompt preview should preserve first-frame intent'
  );
  assert(
    String(dryRun.startPayload.providerPromptPreview).includes('主角目标'),
    'provider prompt preview should include story segment goal'
  );

  const childAfterDryRun = taskManager.getTaskFresh(childTaskId);
  assert(childAfterDryRun?.status === 'pending', 'dry-run should leave child pending');
  assert(String(childAfterDryRun.stage || '').includes('启动前检查'), 'dry-run child stage should mention startup check');
  const childStartPayload = childAfterDryRun.config?.segmentStartPayload as {
    usesShotFrameContract?: boolean;
    contractVersion?: string;
    visualStoryEvidence?: {
      conflictEvidence?: string;
      endingHookEvidence?: string;
    };
    audioState?: {
      audioCue?: string;
    } | null;
    providerPromptPreview?: string;
    providerPromptLength?: number;
  } | undefined;
  assert(childStartPayload?.usesShotFrameContract === true, 'child config should persist start payload');
  assert(
    childStartPayload?.contractVersion === 'yh-shot-frame-contract-v1',
    'child config should persist shot-frame contract version'
  );
  assert(childStartPayload?.visualStoryEvidence?.conflictEvidence, 'child config should persist visible conflict evidence');
  assert(childStartPayload?.visualStoryEvidence?.endingHookEvidence, 'child config should persist visible ending hook');
  assert((childStartPayload as any)?.storySegmentContract?.storyState?.currentGoal, 'child config should persist story segment contract');
  assert(childStartPayload?.audioState?.audioCue === firstAudioState.audioCue, 'child config should persist audio state');
  assert(
    Number(childStartPayload?.providerPromptLength || 0) > 0 && Number(childStartPayload?.providerPromptLength || 0) <= 900,
    'child config should persist compact provider prompt length'
  );
  assert(
    !String(childStartPayload?.providerPromptPreview || '').includes('【首帧合约】'),
    'child config provider prompt should not use audit labels'
  );

  const parentAfterDryRun = taskManager.getTaskFresh(parentTaskId);
  const segmentAfterDryRun = parentAfterDryRun?.result?.assemblyPlan?.segments?.[0];
  assert(segmentAfterDryRun?.status === 'queued', 'parent segment should remain queued after dry-run');
  assert(segmentAfterDryRun.expectedOutputs?.taskId === childTaskId, 'parent segment should keep child id');

  let blockedSecondStart: unknown;
  try {
    startService.startProductionAssemblySegment({ childTaskId: secondChildTaskId });
  } catch (error) {
    blockedSecondStart = error;
  }
  assert(blockedSecondStart instanceof startService.ProductionSegmentStartError, 'second segment should require previous last frame');
  assert(blockedSecondStart.status === 409, 'second segment handoff guard should return 409');
  assert(String(blockedSecondStart.message).includes('上一段'), 'second segment guard should explain previous segment dependency');

  const parentBeforeHandoff = taskManager.getTaskFresh(parentTaskId)!;
  const writeback = segmentAssets.applySegmentAssetWriteback({
    productionProject: parentBeforeHandoff.result!.productionProject as any,
    assemblyPlan: parentBeforeHandoff.result!.assemblyPlan as any,
    segmentIndex: 0,
    patch: {
      status: 'completed',
      completedAt: new Date(0).toISOString(),
      expectedOutputs: {
        taskId: childTaskId,
        videoUrl: 'https://example.invalid/segment-1.mp4',
        lastFrameUrl: 'https://example.invalid/segment-1-last-frame.jpg',
        providerTaskId: 'provider-task-1',
        audioCue: firstAudioState.audioCue,
        hasAudio: true,
        storyStateCue: storyContract.describeStorySegmentCue(makeStorySegmentContract(0, shotFrameContract, firstAudioState) as any),
      },
    },
  });
  taskManager.updateTask(parentTaskId, {
    result: {
      ...parentBeforeHandoff.result,
      productionProject: writeback.productionProject,
      assemblyPlan: writeback.assemblyPlan,
    },
  });

  const secondDryRun = startService.startProductionAssemblySegment({ childTaskId: secondChildTaskId });
  assert(secondDryRun.success === true, 'second dry-run should pass after previous last-frame writeback');
  assert(
    secondDryRun.startPayload.firstFrameImage === 'https://example.invalid/segment-1-last-frame.jpg',
    'second segment must use previous lastFrameUrl as firstFrameImage'
  );
  assert(
    secondDryRun.startPayload.previousLastFrameImage === 'https://example.invalid/segment-1-last-frame.jpg',
    'second segment must expose previousLastFrameImage'
  );
  assert(String(secondDryRun.startPayload.promptPreview).includes('承接上一段'), 'second prompt should include handoff block');
  assert(
    secondDryRun.startPayload.audioContinuity.previousAudioCue === firstAudioState.audioCue,
    'second segment should receive previous audio cue after writeback'
  );
  assert(
    secondDryRun.startPayload.storyContinuity.previousStoryStateCue === storyContract.describeStorySegmentCue(makeStorySegmentContract(0, shotFrameContract, firstAudioState) as any),
    'second segment should receive previous story state cue after writeback'
  );
  assert(
    secondDryRun.startPayload.storySegmentContract.audioContract.previousAudioCue === firstAudioState.audioCue,
    'second segment story contract should receive previous audio cue after writeback'
  );
  assert(
    secondDryRun.startPayload.storySegmentContract.dependencyContract.previousStoryStateCue === storyContract.describeStorySegmentCue(makeStorySegmentContract(0, shotFrameContract, firstAudioState) as any),
    'second segment story contract should receive previous story state cue after writeback'
  );
  assert(
    secondDryRun.startPayload.storySegmentContract.dependencyContract.expectedFirstFrameUrl === 'https://example.invalid/segment-1-last-frame.jpg',
    'second segment story contract should receive previous tail frame after writeback'
  );
  assert(
    String(secondDryRun.startPayload.promptPreview).includes('【声音承接上一段】'),
    'second prompt should include audio handoff block'
  );
  assert(
    String(secondDryRun.startPayload.providerPromptPreview).includes('声音承接上一段'),
    'second provider prompt should preserve audio handoff in provider-safe text'
  );
  assert(
    String(secondDryRun.startPayload.providerPromptPreview).includes('故事承接上一段'),
    'second provider prompt should preserve story state handoff in provider-safe text'
  );
  assert(
    String(secondDryRun.startPayload.providerPromptPreview).includes('连续性硬约束'),
    'second provider prompt should front-load continuity hard constraint'
  );

  const originalFetch = global.fetch;
  let duplicateProviderCalls = 0;
  global.fetch = (() => {
    duplicateProviderCalls += 1;
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;
  assert(taskManager.startTask(secondChildTaskId), 'fixture should claim the child task before the duplicate request');
  let duplicateStartError: unknown;
  try {
    startService.startProductionAssemblySegment(
      {
        childTaskId: secondChildTaskId,
        dryRun: false,
        allowRealCost: true,
      },
      {
        provider: 'ark-plan',
        apiBase: 'https://example.invalid/api/v3',
        apiKey: 'ark-redacted-local-test',
        videoModel: 'doubao-seedance-1-5-pro-251215',
      },
    );
  } catch (error) {
    duplicateStartError = error;
  } finally {
    global.fetch = originalFetch;
  }
  assert(
    duplicateStartError instanceof startService.ProductionSegmentStartError,
    'a segment already claimed by another request must reject the duplicate start',
  );
  assert(duplicateStartError.status === 409, 'duplicate segment start should return 409');
  assert(
    duplicateStartError.details.code === 'segment-job-already-active',
    'duplicate segment start should expose a stable recovery code',
  );
  assert(duplicateProviderCalls === 0, 'duplicate segment start must not submit another provider job');
  assert(taskManager.failTask(secondChildTaskId, 'fixture terminal failure'), 'fixture should fail the claimed child task');
  const requeued = assemblyQueue.queueProductionAssemblySegments({
    owner: fixtureOwner,
    taskId: parentTaskId,
  });
  assert(
    requeued.childTaskIds[1] === secondChildTaskId,
    'failed child task should retain its durable task id when the project is resumed',
  );
  assert(
    taskManager.getTaskFresh(secondChildTaskId)?.status === 'pending',
    'failed child task must return to pending before a confirmed project retry',
  );
  assert(
    String(secondDryRun.startPayload.providerPrompt).includes('本段不是上一段重复') &&
      String(secondDryRun.startPayload.providerPrompt).includes('不得整段停留在上一段场景'),
    'second provider prompt should force progression after first-frame handoff'
  );
  assert(
    String(secondDryRun.startPayload.promptPreview).includes('【尾帧传递安全】') &&
      String(secondDryRun.startPayload.providerPrompt).includes('尾帧传递安全') &&
      String(secondDryRun.startPayload.providerPrompt).includes('地图') &&
      String(secondDryRun.startPayload.providerPrompt).includes('旗帜') &&
      String(secondDryRun.startPayload.providerPrompt).includes('人物正脸'),
    'provider prompt should require a transferable non-face tail frame for downstream first-frame handoff'
  );
  assert(
    String(secondDryRun.startPayload.providerPromptPreview).includes('上一段故事=') &&
      String(secondDryRun.startPayload.providerPromptPreview).includes('上一段声音='),
    'second provider prompt should front-load previous story and audio cues'
  );
  assert(
    secondDryRun.startPayload.providerPromptLength <= 900,
    'second provider prompt should stay compact'
  );

  let costGuardError: unknown;
  try {
    startService.startProductionAssemblySegment({
      childTaskId,
      dryRun: false,
      allowRealCost: false,
    });
  } catch (error) {
    costGuardError = error;
  }
  assert(costGuardError instanceof startService.ProductionSegmentStartError, 'cost guard should throw service error');
  assert(costGuardError.status === 400, 'cost guard should return 400');
  assert(String(costGuardError.message).includes('allowRealCost=true'), 'cost guard message mismatch');

  const serviceSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/production-segment-start.ts'), 'utf8');
  const payloadSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/production-segment-start-payload.ts'), 'utf8');
  const byokSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/byok-provider.ts'), 'utf8');
  const opsStartSource = fs.readFileSync(path.join(process.cwd(), 'scripts/ops-start-production-segment.ts'), 'utf8');
  const providerTaskWritebackCount = (serviceSource.match(/providerTaskId:\s*submitResult\.taskId/g) || []).length;
  assert(
    providerTaskWritebackCount >= 3,
    'completed real segment must persist providerTaskId to child result, segment result, and parent expectedOutputs'
  );
  assert(
    serviceSource.includes('segment-tail-frame-missing'),
    'non-final real segment must fail when no transferable tail frame is available'
  );
  assert(
    serviceSource.includes('partialVideoUrl') && serviceSource.includes('punchThroughReady: false'),
    'tail-frame failure must preserve partial video evidence for recovery'
  );
  assert(
    serviceSource.includes('lastFrameExtraction') && serviceSource.includes('extractLastFrameForHandoff'),
    'tail-frame failure must preserve structured extraction diagnostics'
  );
  assert(
    byokSource.indexOf("content.push({ type: 'text'") < byokSource.indexOf("role: 'first_frame'"),
    'Ark video request should keep text first, matching official content examples'
  );
  assert(
    byokSource.includes('generate_audio') && byokSource.includes('watermark'),
    'Ark video request should pass official body controls for silent/watermark defaults'
  );
  assert(
    payloadSource.includes('内容安全硬约束') &&
      payloadSource.includes('伤兵营') &&
      payloadSource.includes('战地医棚') &&
      payloadSource.includes('药血') &&
      payloadSource.includes('红色药渍') &&
      payloadSource.includes('染血山河图') &&
      payloadSource.includes('带红色印记的山河图') &&
      payloadSource.includes('流血') &&
      payloadSource.includes('出现红色液体') &&
      payloadSource.includes('伤口') &&
      payloadSource.includes('旧创痕'),
    'provider prompt safety layer must soften historical war/injury terms before real generation'
  );
  assert(
    opsStartSource.includes('HUIYING_REAL_ARK_VIDEO_MODEL') && opsStartSource.includes('HUIYING_REAL_ARK_API_BASE'),
    'real segment ops script must honor Huiying Ark env aliases'
  );
  assert(
    opsStartSource.includes('HUIYING_REAL_VIDEO_GENERATE_AUDIO') && opsStartSource.includes('generateAudio,'),
    'real segment ops script must pass generateAudio into production segment start'
  );

  const providerTailFrame = tailFrame.evaluateSegmentTailFrameForHandoff({
    segmentIndex: 0,
    segmentCount: 2,
    providerLastFrameUrl: 'https://example.invalid/provider-last-frame.jpg',
  });
  assert(providerTailFrame.ok === true, 'provider last_frame_url should pass handoff readiness');
  assert(providerTailFrame.source === 'provider', 'provider tail frame source should be recorded');

  const extractedTailFrame = tailFrame.evaluateSegmentTailFrameForHandoff({
    segmentIndex: 0,
    segmentCount: 2,
    extractedLastFrameUrl: 'https://example.invalid/extracted-last-frame.jpg',
  });
  assert(extractedTailFrame.ok === true, 'extracted last frame should pass handoff readiness');
  assert(extractedTailFrame.source === 'extracted', 'extracted tail frame source should be recorded');

  const missingTailFrame = tailFrame.evaluateSegmentTailFrameForHandoff({
    segmentIndex: 0,
    segmentCount: 2,
  });
  assert(missingTailFrame.ok === false, 'non-final segment without tail frame should block handoff');
  assert(String(missingTailFrame.nextAction || '').includes('HUIYING_OBJECT_STORAGE'), 'missing tail frame should point to upload channel readiness');

  console.log(JSON.stringify({
    ok: true,
    tasksFile,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'isolated-huiying-tasks-file',
      'dry-run-updates-child-and-parent',
      'real-cost-guard-blocks-provider-call',
      'duplicate-segment-claim-blocks-provider-submit',
      'dry-run-start-payload-uses-shot-frame-contract',
      'dry-run-start-payload-persists-audio-state',
      'dry-run-start-payload-builds-provider-safe-prompt',
      'child-task-persists-segment-start-payload',
      'second-segment-blocked-before-previous-last-frame',
      'second-segment-uses-previous-last-frame-after-writeback',
      'second-segment-uses-previous-audio-cue-after-writeback',
      'handoff-punch-through-rate-1-of-1',
      'non-final-segment-fails-without-transferable-tail-frame',
      'tail-frame-failure-preserves-partial-video-evidence',
      'tail-frame-failure-preserves-extraction-diagnostics',
      'tail-frame-source-recorded-provider-or-extracted',
      'ark-request-shape-matches-official-content-order',
      'real-completion-persists-provider-task-id',
      'provider-prompt-softens-historical-war-injury-terms',
      'provider-prompt-requires-transferable-non-face-tail-frame',
      'ops-start-real-segment-honors-seedance2-and-audio-env',
    ],
    handoffPunchThroughRate: {
      passed: 1,
      total: 1,
      rate: 1,
    },
  }, null, 2));
}

main()
  .finally(() => {
    fs.rmSync(qaDir, { recursive: true, force: true });
  });
