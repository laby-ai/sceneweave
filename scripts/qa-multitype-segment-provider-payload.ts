import { buildProductionSegmentStartPayload } from '../src/lib/production-segment-start-payload';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

interface CaseSpec {
  id: string;
  title: string;
  genre: string;
  protagonist: string;
  scene: string;
  prop: string;
  goal: string;
  conflict: string;
  firstAudio: string;
  secondAudio: string;
}

const CASES: CaseSpec[] = [
  {
    id: 'suspense-drama',
    title: '雨夜末班车',
    genre: '现实悬疑短剧',
    protagonist: '急救员林澈',
    scene: '暴雨车站',
    prop: '红色书包',
    goal: '阻止末班车驶上危险旧桥',
    conflict: '旧桥警报和即将进站的末班车同时逼近',
    firstAudio: '雨声、站台广播、林澈低声说“别让车进桥”。',
    secondAudio: '雨声延续，警报更急，林澈急促呼吸。',
  },
  {
    id: 'marketing-ad',
    title: '咖啡新品快闪',
    genre: '数字营销广告片',
    protagonist: '店长乔安',
    scene: '清晨快闪咖啡车',
    prop: '新品冷萃杯',
    goal: '让路人看到新品卖点并完成第一次试饮',
    conflict: '排队人群犹豫，竞品屏幕抢走注意力',
    firstAudio: '街角环境声、冰块声、店长说“第一杯给你试”。',
    secondAudio: '冰块声延续，人群低声惊喜，品牌音乐进入。',
  },
  {
    id: 'anime-original',
    title: '星港遗失芯片',
    genre: '原创二次元气质样例',
    protagonist: '少女机修师遥',
    scene: '霓虹星港维修廊',
    prop: '发光芯片',
    goal: '在追兵抵达前修复星港闸门',
    conflict: '追兵脚步声逼近，芯片开始过热闪烁',
    firstAudio: '电流声、远处脚步声，遥低声说“再给我十秒”。',
    secondAudio: '电流声持续升高，闸门警告音开始倒数。',
  },
];

function audioState(spec: CaseSpec, index: number) {
  const soundDesign = index === 0 ? spec.firstAudio : spec.secondAudio;
  const dialogue = index === 0 ? soundDesign.match(/说“([^”]+)”/)?.[1] || null : null;
  const emotion = index === 0 ? '警觉建立' : '承压升级';
  return {
    dialogue,
    narration: null,
    soundDesign,
    voiceStyle: `${spec.protagonist}保持同一声线、情绪和口型节奏。`,
    emotion,
    audioCue: `情绪=${emotion}；对白=${dialogue || '无'}；旁白=无；声音=${soundDesign}`,
  };
}

function audioEventContract(state: ReturnType<typeof audioState>) {
  return {
    dialogueType: state.dialogue ? 'dialogue' : 'none',
    lipSyncPolicy: state.dialogue ? 'lip-sync-active' : 'ambient-only',
    mustGenerateAudioTrack: true,
    expectedAudioEvidence: [
      state.dialogue ? `对白原文=${state.dialogue}` : '',
      `环境音/音效=${state.soundDesign}`,
      `音色/语气=${state.voiceStyle}`,
    ].filter(Boolean),
    providerInstruction: state.dialogue
      ? `保留对白原文“${state.dialogue}”，角色口型必须和对白同步。环境声和音效必须可听见：${state.soundDesign}`
      : `本段无对白/旁白，角色嘴唇保持自然静默，只保留环境声和动作声：${state.soundDesign}`,
  };
}

function storyCue(spec: CaseSpec, state: ReturnType<typeof audioState>, index: number) {
  return [
    `${spec.protagonist}`,
    `目标=${spec.goal}`,
    `冲突=${spec.conflict}`,
    `地点=${spec.scene}`,
    `道具=${spec.prop}`,
    `情绪=${state.emotion}`,
    `段落=${index + 1}`,
  ].join('；');
}

function makeSegment(spec: CaseSpec, index: number, previous?: { tailFrame: string; storyCue: string; audioCue: string }) {
  const state = audioState(spec, index);
  const isSecond = index > 0;
  const firstDescription = isSecond
    ? `开头直接承接上一段尾帧：${spec.protagonist}仍在${spec.scene}，${spec.prop}位置和情绪不跳切。`
    : `${spec.protagonist}出现在${spec.scene}，手边有${spec.prop}，目标和冲突同框出现。`;
  const lastDescription = isSecond
    ? `尾帧${spec.protagonist}完成关键动作，${spec.prop}状态变化并留下下一步钩子。`
    : `尾帧${spec.protagonist}举起或移动${spec.prop}，触发下一段必须接住的画面状态。`;

  return {
    id: `${spec.id}-segment-${index + 1}`,
    index,
    shotId: `${spec.id}-shot-${index + 1}`,
    duration: 5,
    prompt: [
      `【类型】${spec.genre}`,
      `【观众必须看见】${spec.protagonist}在${spec.scene}围绕${spec.prop}行动。`,
      `【动作因果】${isSecond ? '承接上一段尾帧继续推进。' : '建立空间、人物和目标。'}`,
      `【操作结果】${lastDescription}`,
    ].join('\n'),
    status: 'queued',
    dependencies: {
      scriptAssetId: `${spec.id}-script`,
      characterAssetIds: [`${spec.id}-character`],
      sceneAssetIds: [`${spec.id}-scene`],
      propAssetIds: [`${spec.id}-prop`],
    },
    expectedInputs: {
      firstFrameUrl: previous?.tailFrame || null,
      previousLastFrameUrl: previous?.tailFrame || null,
      sourceSegmentId: previous ? `${spec.id}-segment-1` : null,
      sourceAssetId: previous ? `${spec.id}-video-1` : null,
      continuityPrompt: previous ? `开头1-2秒承接上一段尾帧：${previous.storyCue}` : null,
      previousAudioCue: previous?.audioCue || null,
      audioContinuityPrompt: previous ? `声音承接上一段：${previous.audioCue}` : null,
      previousStoryStateCue: previous?.storyCue || null,
      storyContinuityPrompt: previous ? `故事承接上一段：${previous.storyCue}` : null,
      boundaryBridgeId: previous ? `${spec.id}-boundary-1-2` : null,
      boundaryBridgePrompt: previous
        ? [
            `边界桥接 1->2：保持${spec.protagonist}、${spec.scene}、${spec.prop}三项视觉锚点。`,
            '用动作匹配或道具状态匹配完成过渡，避免硬切到新人物、新服装或新空间。',
            `最后一帧必须能作为第二段开场：${spec.protagonist}继续处理${spec.prop}。`,
          ].join('\n')
        : null,
      bridgeFirstFrameUrl: previous?.tailFrame || null,
      bridgeStrategy: previous ? 'transition-bridge' : null,
    },
    expectedOutputs: {
      videoUrl: null,
      lastFrameUrl: null,
      taskId: null,
      providerTaskId: null,
      audioCue: state.audioCue,
      hasAudio: true,
      storyStateCue: storyCue(spec, state, index),
    },
    audioState: state,
    shotFrameContract: {
      version: 'yh-shot-frame-contract-v1',
      reference: {
        primary: 'ViMAX',
        sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
      },
      shotId: `${spec.id}-shot-${index + 1}`,
      shotIndex: index,
      variationType: isSecond ? 'medium' : 'large',
      variationReason: '多类型 2 段 handoff QA 必须证明 provider prompt 消费首尾帧、故事和声音状态。',
      firstFrame: {
        description: firstDescription,
        visibleCharacterIds: [`${spec.id}-character`],
        requiredAssetIds: [`${spec.id}-character`, `${spec.id}-scene`, `${spec.id}-prop`],
        continuityAnchors: [spec.protagonist, spec.scene, spec.prop],
      },
      lastFrame: {
        description: lastDescription,
        visibleCharacterIds: [`${spec.id}-character`],
        requiredAssetIds: [`${spec.id}-character`, `${spec.id}-scene`, `${spec.id}-prop`],
        continuityAnchors: [spec.protagonist, spec.scene, spec.prop],
      },
      motionDescription: `${spec.protagonist}围绕${spec.prop}完成有因果的桥接动作，镜头保持${spec.scene}空间方向。`,
      audioDescription: state.soundDesign,
      visualStoryEvidence: {
        threatTarget: `${spec.goal}关联的对象必须可见。`,
        conflictEvidence: spec.conflict,
        operationResultEvidence: `${spec.prop}状态变化，证明动作产生了外部结果。`,
        endingHookEvidence: `${spec.prop}和${spec.protagonist}的视线成为下一段钩子。`,
        viewerReadabilityTest: '观众不看字幕也能说清人物、目标、冲突、操作结果和下一步。',
      },
      handoff: {
        requiresPreviousLastFrame: isSecond,
        previousShotId: isSecond ? `${spec.id}-shot-1` : null,
        nextShotId: isSecond ? null : `${spec.id}-shot-2`,
        entryContinuity: isSecond ? `承接上一段尾帧的${spec.protagonist}/${spec.scene}/${spec.prop}` : `建立${spec.protagonist}/${spec.scene}/${spec.prop}`,
        exitContinuity: lastDescription,
      },
      readiness: { pass: true, blockers: [], warnings: [] },
    },
    storySegmentContract: {
      version: 'yh-story-segment-contract-v1',
      reference: {
        primary: 'Toonflow-app',
        secondary: ['ViMAX', 'ArcReel'],
        sourceMechanism: 'FlowData.videoDesc + storyboard/assets/video writeback + dependency claim gate',
      },
      segmentId: `${spec.id}-segment-${index + 1}`,
      index,
      shotId: `${spec.id}-shot-${index + 1}`,
      videoDesc: {
        visibleAction: `${spec.protagonist}在${spec.scene}围绕${spec.prop}推进剧情。`,
        visualCausality: `${spec.conflict} -> ${spec.prop}状态变化。`,
        entryState: firstDescription,
        exitState: lastDescription,
        continuityAnchors: [spec.protagonist, spec.scene, spec.prop],
        requiredAssetIds: [`${spec.id}-character`, `${spec.id}-scene`, `${spec.id}-prop`],
      },
      storyState: {
        protagonist: spec.protagonist,
        currentGoal: spec.goal,
        conflict: spec.conflict,
        obstacle: spec.conflict,
        scene: spec.scene,
        keyProp: spec.prop,
        emotionalState: state.emotion,
        visibleStateChange: `${spec.prop}状态变化，局势从上一段推进到下一段。`,
      },
      audioContract: {
        dialogue: state.dialogue,
        narration: state.narration,
        soundDesign: state.soundDesign,
        voiceStyle: state.voiceStyle,
        audioCue: state.audioCue,
        previousAudioCue: previous?.audioCue || null,
        requiresAudioContinuity: isSecond,
        audioEventContract: audioEventContract(state),
      },
      dependencyContract: {
        previousSegmentId: previous ? `${spec.id}-segment-1` : null,
        nextSegmentId: isSecond ? null : `${spec.id}-segment-2`,
        requiresPreviousLastFrame: isSecond,
        expectedFirstFrameUrl: previous?.tailFrame || null,
        expectedPreviousLastFrameUrl: previous?.tailFrame || null,
        previousStoryStateCue: previous?.storyCue || null,
        sourceSegmentId: previous ? `${spec.id}-segment-1` : null,
        sourceAssetId: previous ? `${spec.id}-video-1` : null,
      },
      readiness: { pass: true, blockers: [], warnings: [] },
    },
    artifactReadiness: {
      version: 'yh-artifact-readiness-v1',
      pass: true,
      stale: false,
      blockers: [],
      warnings: [],
      checkedAt: new Date(0).toISOString(),
    },
    retryPolicy: {
      maxRetries: 2,
      retryable: true,
      fallback: 'retry segment after dependency writeback',
    },
  };
}

function assertContainsAll(value: string, fragments: string[], label: string) {
  const missing = fragments.filter(fragment => !value.includes(fragment));
  assert(missing.length === 0, `${label}: provider prompt missing ${missing.join(' | ')}`);
}

function main() {
  const results = CASES.map(spec => {
    const first = makeSegment(spec, 0);
    const previous = {
      tailFrame: `https://example.invalid/${spec.id}/segment-1-tail.jpg`,
      storyCue: String(first.expectedOutputs.storyStateCue),
      audioCue: String(first.expectedOutputs.audioCue),
    };
    const second = makeSegment(spec, 1, previous);
    const payload = buildProductionSegmentStartPayload(second as any);
    const head = payload.providerPrompt.slice(0, 600);
    const providerPrompt = payload.providerPrompt;

    assert(payload.firstFrameImage === previous.tailFrame, `${spec.id}: second segment must use previous tail frame as first frame`);
    assert(payload.providerPromptLength <= 900, `${spec.id}: provider prompt must stay compact`);
    assert(head.includes('连续性硬约束'), `${spec.id}: provider prompt head missing continuity hard constraint`);
    assert(head.includes('边界桥接计划'), `${spec.id}: provider prompt head missing boundary bridge plan`);
    assert(head.includes('上一段故事='), `${spec.id}: provider prompt head missing previous story cue`);
    assert(head.includes('上一段声音='), `${spec.id}: provider prompt head missing previous audio cue`);
    assert(head.includes('时间轴硬约束'), `${spec.id}: provider prompt head missing Toonflow-style timeline constraint`);
    assert(head.includes('声音时间轴'), `${spec.id}: provider prompt head missing audio timeline constraint`);
    assert(providerPrompt.includes('复现首帧和上一段尾帧状态'), `${spec.id}: provider prompt missing opening handoff timing`);
    assert(payload.boundaryBridge.boundaryBridgeId === `${spec.id}-boundary-1-2`, `${spec.id}: payload missing boundary bridge id`);
    assert(payload.boundaryBridge.bridgeStrategy === 'transition-bridge', `${spec.id}: payload missing transition bridge strategy`);
    assert(payload.boundaryBridge.prompt?.includes('动作匹配'), `${spec.id}: payload missing boundary bridge prompt`);
    assert(providerPrompt.includes('可给下一段接住的尾帧'), `${spec.id}: provider prompt missing ending handoff timing`);
    assertContainsAll(providerPrompt, [
      spec.protagonist,
      spec.goal,
      spec.conflict,
      spec.scene,
      spec.prop,
      previous.storyCue,
    ], `${spec.id}: story state cue was not fully consumed`);
    assertContainsAll(providerPrompt, [
      '上一段声音=',
      '对白=',
      '声音=',
      spec.firstAudio,
      spec.secondAudio,
    ], `${spec.id}: audio cue was not fully consumed`);
    assertContainsAll(providerPrompt, [
      '本段无对白',
      '角色嘴唇保持自然静默',
      '环境声和动作声',
    ], `${spec.id}: current segment audio-event policy was not consumed`);
    assert(head.includes(spec.protagonist), `${spec.id}: provider prompt head missing protagonist continuity`);
    assert(head.includes(spec.scene), `${spec.id}: provider prompt head missing scene continuity`);
    assert(head.includes(spec.prop), `${spec.id}: provider prompt head missing prop continuity`);
    assert(head.includes('故事承接上一段'), `${spec.id}: provider prompt head missing story handoff phrase`);
    assert(head.includes('声音承接上一段'), `${spec.id}: provider prompt head missing audio handoff phrase`);

    return {
      id: spec.id,
      genre: spec.genre,
      firstFrameImage: payload.firstFrameImage,
      providerPromptLength: payload.providerPromptLength,
      headContainsContinuity: head.includes('连续性硬约束'),
      headContainsBoundaryBridge: head.includes('边界桥接计划'),
      headContainsStoryCue: head.includes('上一段故事='),
      headContainsAudioCue: head.includes('上一段声音='),
      headContainsTimeline: head.includes('时间轴硬约束'),
      headContainsAudioTimeline: head.includes('声音时间轴'),
      providerUsesFullPreviousStoryStateCue: providerPrompt.includes(previous.storyCue),
      providerUsesFullPreviousAudioCue: providerPrompt.includes(previous.audioCue),
      providerUsesCurrentAudioEventPolicy: providerPrompt.includes('角色嘴唇保持自然静默'),
      boundaryBridgeId: payload.boundaryBridge.boundaryBridgeId,
      bridgeStrategy: payload.boundaryBridge.bridgeStrategy,
    };
  });

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    caseCount: results.length,
    cases: results,
  }, null, 2));
}

main();
