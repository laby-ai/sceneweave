import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProductionAssemblyPlan, ProductionSegmentAudioState, ProductionSegmentPlan } from '../src/lib/production-assembly-plan';
import type { ProductionProject } from '../src/lib/production-project';
import type { ShotFrameContract } from '../src/lib/production-shot-frame-contract';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const qaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-multisegment-chain-'));
process.env.HUIYING_TASKS_FILE = path.join(qaDir, 'tasks.json');

const beats = ['setup', 'inciting', 'conflict', 'turning', 'resolution'] as const;
const emotions = ['警觉', '紧张', '恐惧', '决断', '余悸'];

function audioState(index: number): ProductionSegmentAudioState {
  const dialogue = index % 2 === 0 ? `第${index + 1}段对白必须可听见。` : null;
  const soundDesign = [
    '雨声和列车进站声。',
    '警报声压过脚步声。',
    '车厢广播和刹车声。',
    '人群惊呼后突然安静。',
    '远处雨声保留结尾余韵。',
  ][index];
  return {
    dialogue,
    narration: index === 1 ? '旁白提示危机正在逼近。' : null,
    soundDesign,
    voiceStyle: '同一主角声线，情绪递进但音色不换。',
    emotion: emotions[index],
    audioCue: `情绪=${emotions[index]}；对白=${dialogue || '无'}；旁白=${index === 1 ? '旁白提示危机正在逼近。' : '无'}；声音=${soundDesign}`,
  };
}

function shotFrameContract(index: number): ShotFrameContract {
  const shotId = `shot-${index + 1}`;
  const nextShotId = index < 4 ? `shot-${index + 2}` : null;
  const previousShotId = index > 0 ? `shot-${index}` : null;
  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId,
    shotIndex: index,
    variationType: index === 0 || index === 4 ? 'large' : 'medium',
    variationReason: '5段短剧链路 QA 要求每段首尾帧均可成为可追踪交接点。',
    firstFrame: {
      description: index === 0
        ? '主角在暴雨站台看见红色书包和旧桥警报屏。'
        : `复现第${index}段尾帧：主角、红色书包、警报屏和列车灯光的位置不变。`,
      visibleCharacterIds: ['character-protagonist'],
      requiredAssetIds: ['character-protagonist', 'scene-platform', 'prop-red-bag'],
      continuityAnchors: ['主角', '暴雨站台', '红色书包', '旧桥警报屏'],
    },
    lastFrame: {
      description: `第${index + 1}段尾帧保留主角、红色书包、警报屏和列车灯光的新状态。`,
      visibleCharacterIds: ['character-protagonist'],
      requiredAssetIds: ['character-protagonist', 'scene-platform', 'prop-red-bag'],
      continuityAnchors: ['主角', '暴雨站台', '红色书包', '旧桥警报屏'],
    },
    motionDescription: `第${index + 1}段完成一个可见动作并改变红色书包/警报屏状态。`,
    audioDescription: audioState(index).soundDesign,
    visualStoryEvidence: {
      threatTarget: '最后一班列车、车厢孩子和旧桥风险必须同场可见。',
      conflictEvidence: '旧桥警报屏、暴雨、列车灯光和红色书包状态必须构成外部冲突证据。',
      operationResultEvidence: `第${index + 1}段结尾必须显示主角操作后的状态变化。`,
      endingHookEvidence: nextShotId
        ? `尾帧必须给${nextShotId}留下可接续的主角视线、手部动作或道具状态。`
        : '最终尾帧保留未完全解除的旧桥风险作为结尾钩子。',
      viewerReadabilityTest: '观众不看字幕也能说清谁受威胁、危险来自哪里、主角做了什么、下一段为什么发生。',
    },
    handoff: {
      requiresPreviousLastFrame: index > 0,
      previousShotId,
      nextShotId,
      entryContinuity: index > 0 ? `承接${previousShotId}尾帧。` : '建立主角、站台、红色书包和旧桥警报。',
      exitContinuity: nextShotId ? `尾帧指向${nextShotId}。` : '尾帧留下结果和新悬念。',
    },
    readiness: { pass: true, blockers: [], warnings: [] },
  };
}

function makeProductionProject(parentTaskId: string): ProductionProject {
  const shots = beats.map((beat, index) => ({
    id: `shot-${index + 1}`,
    index: index + 1,
    duration: 6,
    storyBeat: beat,
    dramaticPurpose: `第${index + 1}段推进短剧因果并改变可见状态。`,
    emotionShift: emotions[index],
    prompt: `第${index + 1}段：围绕红色书包和旧桥警报推进。`,
    status: 'planned' as const,
  }));
  return {
    id: 'multisegment-chain-qa',
    title: '5段短剧链路 QA',
    prompt: '最后一班列车 5段完整链路',
    style: '现实悬疑短剧',
    ratio: '16:9',
    sceneType: 'drama',
    duration: 30,
    segmentDuration: 6,
    narrativeSummary: '主角在暴雨站台阻止最后一班列车驶向旧桥。',
    storyBible: {
      premise: '暴雨夜，主角发现最后一班列车将驶向危险旧桥。',
      protagonist: '年轻急救员',
      desire: '阻止列车驶上危险旧桥并救下车厢孩子。',
      obstacle: '暴雨、警报延迟和站台封锁阻断行动。',
      relationship: '年轻急救员与暴雨站台、红色书包、旧桥警报屏',
      conflict: '最后一班列车即将驶向危险旧桥。',
      turningPoint: '主角用红色书包触发备用信号。',
      endingHook: '警报解除后屏幕出现另一辆列车的异常信号。',
      emotionalArc: { start: '警觉', shift: '紧张', end: '余悸' },
      continuityRules: ['主角同一人', '红色书包不断链', '暴雨站台和旧桥警报屏不断链'],
      beats: beats.map((beat, index) => ({
        id: beat,
        label: beat,
        purpose: `第${index + 1}段职能`,
        emotion: emotions[index],
        visualGoal: `看见第${index + 1}段状态变化`,
        shotIds: [`shot-${index + 1}`],
      })),
    },
    semanticPlan: {
      version: 'yh-production-semantic-plan-v1',
      source: 'video-production-v3-merged',
      reference: { primary: 'ViMax', secondary: ['Toonflow-app', 'ArcReel'], adaptedIdeas: ['artifact DAG readiness', 'FlowData writeback', 'dependency claim gate'] },
      writerOutput: {} as any,
      directorOutput: {} as any,
      characterBibles: [],
      sceneBibles: [{ id: 'scene-platform', name: '暴雨站台', version: 1 }],
      shotList: {} as any,
      dag: { nodes: [] },
      assetLinks: { characterAssetIds: ['character-protagonist'], sceneAssetIds: ['scene-platform'], storyboardAssetId: 'storyboard-1', deliverableAssetId: 'deliverable-1' },
    },
    assets: [
      { id: 'storyboard-1', kind: 'storyboard', name: '分镜', status: 'ready', summary: '5段分镜', source: 'storyboard' },
      { id: 'character-protagonist', kind: 'character', name: '年轻急救员', status: 'ready', summary: '主角', source: 'system' },
      { id: 'scene-platform', kind: 'scene', name: '暴雨站台', status: 'ready', summary: '场景', source: 'system' },
      { id: 'prop-red-bag', kind: 'prop', name: '红色书包', status: 'ready', summary: '关键道具', source: 'system' },
      { id: 'deliverable-1', kind: 'deliverable', name: '成片', status: 'pending', summary: '等待合成', source: 'system' },
    ],
    stages: [{ id: 'assembly', name: '片段合成', status: 'pending', summary: '等待片段', assetIds: ['deliverable-1'] }],
    graph: { nodes: [], edges: [] },
    storyboard: { shotCount: 5, totalDuration: 30, shots },
    output: { status: 'pending', taskId: parentTaskId, canProceedToVideo: false, nextStep: '等待片段' },
    suggestions: { subtitle: {} as any, narration: {} as any },
  };
}

async function main() {
  const taskManager = await import('../src/lib/task-manager');
  const segmentAssets = await import('../src/lib/production-segment-assets');
  const startService = await import('../src/lib/production-segment-start');
  const retryService = await import('../src/lib/production-segment-retry');
  const storyContract = await import('../src/lib/production-story-segment-contract');

  const parentTaskId = taskManager.createTask('storyboard', { workflow: 'smart-director-chain', prompt: '5段短剧链路 QA' });
  const productionProject = makeProductionProject(parentTaskId);
  const childTaskIds = productionProject.storyboard.shots.map((shot, index) => taskManager.createTask('video', {
    workflow: 'production-assembly-segment',
    parentTaskId,
    assemblySegmentIndex: index,
    assemblySegmentId: `segment-${index + 1}`,
    productionProjectId: productionProject.id,
    shotId: shot.id,
    ratio: '16:9',
  }));

  const segments: ProductionSegmentPlan[] = productionProject.storyboard.shots.map((shot, index) => {
    const audio = audioState(index);
    const shotContract = shotFrameContract(index);
    const prompt = [
      `第${index + 1}段必须看见主角、红色书包和旧桥警报屏。`,
      '【动作因果】主角动作必须改变警报屏或红色书包状态。',
      '【操作结果】尾帧必须显示可被下一段接续的新状态。',
    ].join('');
    const contract = storyContract.buildStorySegmentContract({
      productionProject,
      segmentId: `segment-${index + 1}`,
      index,
      shot,
      prompt,
      audioState: audio,
      shotFrameContract: shotContract,
      previousSegmentId: index > 0 ? `segment-${index}` : null,
      nextSegmentId: index < 4 ? `segment-${index + 2}` : null,
    });
    return {
      id: `segment-${index + 1}`,
      index,
      shotId: shot.id,
      duration: 6,
      prompt,
      status: 'queued',
      dependencies: { characterAssetIds: ['character-protagonist'], sceneAssetIds: ['scene-platform'], propAssetIds: ['prop-red-bag'] },
      expectedInputs: {
        firstFrameUrl: null,
        previousLastFrameUrl: null,
        sourceSegmentId: index > 0 ? `segment-${index}` : null,
        sourceAssetId: null,
        continuityPrompt: index > 0 ? `等待第${index}段尾帧。` : '建立首段空间。',
        previousAudioCue: null,
        audioContinuityPrompt: index > 0 ? `等待第${index}段声音状态。` : '建立声音场。',
        previousStoryStateCue: null,
        storyContinuityPrompt: index > 0 ? `等待第${index}段故事状态。` : '建立故事状态。',
      },
      expectedOutputs: {
        taskId: childTaskIds[index],
        videoUrl: null,
        lastFrameUrl: null,
        providerTaskId: null,
        audioCue: audio.audioCue,
        storyStateCue: storyContract.describeStorySegmentCue(contract),
      },
      audioState: audio,
      shotFrameContract: shotContract,
      storySegmentContract: contract,
      retryPolicy: { maxRetries: 1, retryable: true, fallback: 'retry-segment' },
    };
  });

  const assemblyPlan: ProductionAssemblyPlan = {
    version: 'yh-assembly-plan-v1',
    reference: { primary: 'ArcReel', adaptedIdeas: ['dependency claim gate', 'cascade fail', 'timeline draft export'] },
    productionProjectId: productionProject.id,
    sourceTaskId: parentTaskId,
    totalDuration: 30,
    segmentCount: 5,
    segmentDurationHint: 6,
    status: 'planned',
    readiness: { version: 'yh-assembly-readiness-v1', pass: true, checkedAt: new Date(0).toISOString(), source: 'shot-frame-contract', blockerCount: 0, warningCount: 0, issues: [], nextAction: 'queue segments' },
    segments,
    assembly: { strategy: 'ordered-concat', requiresAllSegments: true, outputUrl: null, exportFormats: ['mp4', 'cut-draft-json'] },
    recovery: { persistEachSegment: true, resumeFromSegmentIndex: 0, canRetryFailedSegments: true, failurePolicy: 'failed segment cascades downstream to skipped until retry succeeds' },
    nextAction: 'queue segments',
  };

  taskManager.updateTask(parentTaskId, {
    status: 'completed',
    progress: 100,
    result: {
      productionProject,
      assemblyPlan,
      assemblyQueue: { version: 'qa', sourceTaskId: parentTaskId, status: 'planned', queuedSegmentCount: 5, childTaskIds, updatedAt: new Date(0).toISOString() },
    } as any,
  });

  let currentPlan = assemblyPlan;
  for (let index = 0; index < 2; index += 1) {
    const completed = segmentAssets.applySegmentAssetWriteback({
      productionProject,
      assemblyPlan: currentPlan,
      segmentIndex: index,
      patch: {
        status: 'completed',
        completedAt: new Date(index + 1).toISOString(),
        expectedOutputs: {
          taskId: childTaskIds[index],
          providerTaskId: `provider-${index + 1}`,
          videoUrl: `https://example.invalid/segment-${index + 1}.mp4`,
          lastFrameUrl: `https://example.invalid/segment-${index + 1}-tail.jpg`,
          audioCue: audioState(index).audioCue,
          hasAudio: true,
          storyStateCue: storyContract.describeStorySegmentCue(currentPlan.segments[index].storySegmentContract),
        },
      },
    });
    currentPlan = completed.assemblyPlan;
    taskManager.updateTask(parentTaskId, { result: { productionProject: completed.productionProject, assemblyPlan: currentPlan } as any });
    const next = currentPlan.segments[index + 1];
    assert(next.expectedInputs.firstFrameUrl === `https://example.invalid/segment-${index + 1}-tail.jpg`, `segment ${index + 2} must use direct previous tail frame`);
    assert(next.expectedInputs.previousAudioCue === audioState(index).audioCue, `segment ${index + 2} must use direct previous audio cue`);
    assert(next.expectedInputs.previousStoryStateCue === storyContract.describeStorySegmentCue(currentPlan.segments[index].storySegmentContract), `segment ${index + 2} must use direct previous story cue`);
  }

  const parentBeforeFailure = taskManager.getTaskFresh(parentTaskId)!;
  const failed = segmentAssets.applySegmentAssetWriteback({
    productionProject: parentBeforeFailure.result!.productionProject as any,
    assemblyPlan: parentBeforeFailure.result!.assemblyPlan as ProductionAssemblyPlan,
    segmentIndex: 2,
    patch: {
      status: 'failed',
      error: 'segment-tail-frame-missing after provider partial',
      expectedOutputs: {
        taskId: childTaskIds[2],
        providerTaskId: 'provider-partial-3',
        videoUrl: 'https://example.invalid/segment-3-partial.mp4',
        lastFrameUrl: null,
      },
    },
  });
  taskManager.updateTask(parentTaskId, { result: { productionProject: failed.productionProject, assemblyPlan: failed.assemblyPlan } as any });
  assert(failed.assemblyPlan.segments[3].status === 'skipped', 'segment 4 must be skipped after segment 3 failure');
  assert(failed.assemblyPlan.segments[4].status === 'skipped', 'segment 5 must be skipped after segment 3 failure');
  assert(failed.assemblyPlan.segments[3].expectedInputs.previousAudioCue === null, 'segment 4 stale audio cue must be cleared');
  assert(failed.assemblyPlan.segments[4].expectedInputs.previousStoryStateCue === null, 'segment 5 stale story cue must be cleared');

  const retry = retryService.retryProductionAssemblySegment({ parentTaskId, segmentIndex: 2 });
  assert(retry.success === true, 'segment 3 retry should queue without provider call');
  const parentAfterRetry = taskManager.getTaskFresh(parentTaskId)!;
  const retryPlan = parentAfterRetry.result!.assemblyPlan as ProductionAssemblyPlan;
  assert(retryPlan.segments[3].status === 'queued' && retryPlan.segments[4].status === 'queued', 'retry should release downstream segments to queued');

  let fourthBlocked = false;
  try {
    startService.startProductionAssemblySegment({ childTaskId: childTaskIds[3] });
  } catch (error) {
    fourthBlocked = error instanceof startService.ProductionSegmentStartError
      && error.details?.code === 'segment-handoff-not-ready';
  }
  assert(fourthBlocked, 'segment 4 must remain blocked until segment 3 writes lastFrameUrl');

  const recoveredThird = segmentAssets.applySegmentAssetWriteback({
    productionProject: parentAfterRetry.result!.productionProject as any,
    assemblyPlan: retryPlan,
    segmentIndex: 2,
    patch: {
      status: 'completed',
      completedAt: new Date(4).toISOString(),
      expectedOutputs: {
        taskId: childTaskIds[2],
        providerTaskId: 'provider-recovered-3',
        videoUrl: 'https://example.invalid/segment-3.mp4',
        lastFrameUrl: 'https://example.invalid/segment-3-tail.jpg',
        audioCue: audioState(2).audioCue,
        hasAudio: true,
        storyStateCue: storyContract.describeStorySegmentCue(retryPlan.segments[2].storySegmentContract),
      },
    },
  });
  taskManager.updateTask(parentTaskId, { result: { productionProject: recoveredThird.productionProject, assemblyPlan: recoveredThird.assemblyPlan } as any });
  const fourthDryRun = startService.startProductionAssemblySegment({ childTaskId: childTaskIds[3] });
  assert(fourthDryRun.startPayload.firstFrameImage === 'https://example.invalid/segment-3-tail.jpg', 'segment 4 must use recovered segment 3 tail frame');
  assert(fourthDryRun.startPayload.audioContinuity.previousAudioCue === audioState(2).audioCue, 'segment 4 must use recovered segment 3 audio cue');
  assert(fourthDryRun.startPayload.storyContinuity.previousStoryStateCue === storyContract.describeStorySegmentCue(recoveredThird.assemblyPlan.segments[2].storySegmentContract), 'segment 4 must use recovered segment 3 story cue');
  assert(fourthDryRun.usedRealKey === false && fourthDryRun.incurredCost === false, 'multisegment QA must not spend real video cost');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    segmentCount: 5,
    checks: [
      'five-segment-plan-created',
      'direct-previous-tail-frame-used-for-segment-2-and-3',
      'direct-previous-story-and-audio-cues-used',
      'middle-failure-cascades-to-segment-4-and-5',
      'retry-releases-downstream-but-keeps-segment-4-blocked',
      'segment-4-uses-recovered-segment-3-tail-story-audio',
    ],
    punchThrough: {
      generatedSegmentRate: 'not-real-sample',
      tailFrameAcquisitionRate: 'not-real-sample',
      tailFrameWritebackRate: 1,
      nextSegmentFirstFrameUsageRate: 1,
      audioCueWritebackRate: 1,
      nextSegmentAudioCueUsageRate: 1,
    },
  }, null, 2));
}

main()
  .finally(() => {
    fs.rmSync(qaDir, { recursive: true, force: true });
  });
