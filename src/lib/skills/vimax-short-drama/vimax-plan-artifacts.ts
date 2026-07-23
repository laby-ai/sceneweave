import { buildProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionAssemblyPlan, ProductionSegmentPlan } from '@/lib/production-assembly-plan';
import { buildProductionProject } from '@/lib/production-project';
import type { ProductionAsset, ProductionAssetKind, ProductionProject } from '@/lib/production-project';
import { generateShotsFromUserPrompt } from '@/lib/storyboard-generator';
import type { VimaxAgentPlan, VimaxAgentStepBody } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';

function inferDurationSeconds(prompt: string, explicit?: unknown) {
  const configured = Number(explicit);
  if (Number.isFinite(configured) && configured > 0) return Math.max(5, Math.min(120, Math.floor(configured)));
  const match = /(\d{1,3})\s*(秒|s|S)/.exec(prompt);
  const seconds = match ? Number(match[1]) : 30;
  return Math.max(5, Math.min(120, Math.floor(seconds || 30)));
}

function inferSegmentSpec(prompt: string, duration: number, body: VimaxAgentStepBody) {
  const explicitDuration = Math.floor(Number(body.segmentDuration) || 0);
  const explicitCount = Math.floor(Number(body.segmentCount) || 0);
  const compact = prompt.replace(/\s+/g, '');
  const countDurationMatch =
    /(\d{1,2})(?:个|段|条)(\d{1,2})(?:秒|s|S)(?:clip|Clip|CLIP|镜头|分镜|片段)?/.exec(compact)
    || /(\d{1,2})(?:个|段|条)?(?:clip|Clip|CLIP|镜头|分镜|片段)(?:，|,|、)?(?:每(?:个|段|条)?)?(\d{1,2})(?:秒|s|S)/.exec(compact);
  const countOnlyMatch = /(\d{1,2})(?:个|段|条)(?:clip|Clip|CLIP|镜头|分镜|片段)/.exec(compact);
  const perDurationMatch = /每(?:个|段|条)?(?:clip|Clip|CLIP|镜头|分镜|片段)?(\d{1,2})(?:秒|s|S)/.exec(compact);
  const promptCount = countDurationMatch ? Number(countDurationMatch[1]) : countOnlyMatch ? Number(countOnlyMatch[1]) : 0;
  const promptSegmentDuration = countDurationMatch ? Number(countDurationMatch[2]) : perDurationMatch ? Number(perDurationMatch[1]) : 0;
  const segmentDuration = Math.max(3, Math.min(15, explicitDuration || promptSegmentDuration || (duration <= 30 ? 5 : 10)));
  const segmentCount = Math.max(1, Math.min(12, explicitCount || promptCount || Math.ceil(duration / segmentDuration)));
  return { segmentDuration, segmentCount };
}

function isNarrativeSceneType(sceneType: string) {
  return sceneType === 'drama' || sceneType === 'game';
}

function alignNonNarrativeProjectWithPlan(
  project: ProductionProject,
  basePlan: VimaxAgentPlan,
): ProductionProject {
  const mediaKinds = new Set<ProductionAssetKind>(['character', 'scene', 'prop']);
  const shotIds = project.storyboard.shots.map(shot => shot.id);
  const plannedAssets: ProductionAsset[] = basePlan.assets
    .filter((asset): asset is typeof asset & { kind: 'character' | 'scene' | 'prop' } => (
      mediaKinds.has(asset.kind as ProductionAssetKind)
    ))
    .map((asset, index) => ({
      id: `plan-${asset.kind}-${index + 1}`,
      kind: asset.kind,
      name: asset.label,
      status: 'planned',
      summary: asset.prompt,
      source: 'prompt',
      relatedShotIds: shotIds,
    }));
  const structuralAssets = project.assets.filter(asset => !mediaKinds.has(asset.kind));
  const assets = [...structuralAssets, ...plannedAssets].map(asset => (
    asset.kind === 'script'
      ? { ...asset, summary: basePlan.summary }
      : asset.kind === 'storyboard'
        ? { ...asset, summary: basePlan.summary }
        : asset
  ));
  const assetIds = new Set(assets.map(asset => asset.id));
  const plannedCharacterAssets = plannedAssets.filter(asset => asset.kind === 'character');
  const plannedSceneAssets = plannedAssets.filter(asset => asset.kind === 'scene');
  const plannedPropAssets = plannedAssets.filter(asset => asset.kind === 'prop');
  const primaryScene = plannedSceneAssets[0]?.name || project.style;
  const primarySubject = plannedCharacterAssets[0]?.name || '无固定人物';
  const propNames = plannedPropAssets.map(asset => asset.name);
  const storyboardShots = project.storyboard.shots.map((shot, index) => {
    const source = basePlan.shots[index];
    return source ? {
      ...shot,
      storyBeat: shot.storyBeat,
      dramaticPurpose: source.title,
      emotionShift: project.style,
      prompt: source.prompt,
      shotTypeLabel: source.camera,
      duration: source.duration,
    } : shot;
  });
  const storyBible = {
    ...project.storyBible,
    premise: basePlan.summary,
    protagonist: primarySubject,
    desire: basePlan.summary,
    obstacle: '将分散信息组织为清晰、连续、可核验的视觉结构',
    relationship: primaryScene,
    conflict: basePlan.summary,
    turningPoint: basePlan.shots[Math.max(0, Math.floor(basePlan.shots.length / 2))]?.title || basePlan.summary,
    endingHook: basePlan.shots.at(-1)?.title || basePlan.nextAction,
    emotionalArc: {
      start: basePlan.shots[0]?.title || '建立视觉主题',
      shift: basePlan.shots[Math.max(0, Math.floor(basePlan.shots.length / 2))]?.title || '推进视觉结构',
      end: basePlan.shots.at(-1)?.title || '完成视觉收束',
    },
    continuityRules: [
      `主要空间保持为${primaryScene}`,
      `全片视觉风格保持为${project.style}`,
      ...(propNames.length > 0 ? [`视觉锚点${propNames.join('、')}在出现后保持形态和运动方向一致`] : []),
      '镜头必须按已确认的顺序承接，禁止强制添加人物、剧情冲突或无关道具',
    ],
  };
  const semanticPlan = {
    ...project.semanticPlan,
    characterBibles: plannedCharacterAssets.length > 0
      ? project.semanticPlan.characterBibles.map((item, index) => ({
        ...item,
        name: plannedCharacterAssets[index]?.name || plannedCharacterAssets[0].name,
      }))
      : [],
    sceneBibles: project.semanticPlan.sceneBibles.map((item, index) => ({
      ...item,
      name: plannedSceneAssets[index]?.name || primaryScene,
    })),
    assetLinks: {
      ...project.semanticPlan.assetLinks,
      characterAssetIds: plannedCharacterAssets.map(asset => asset.id),
      sceneAssetIds: plannedSceneAssets.map(asset => asset.id),
    },
  };

  return {
    ...project,
    title: basePlan.title,
    narrativeSummary: basePlan.summary,
    storyBible,
    semanticPlan,
    assets,
    stages: project.stages.map(stage => (
      stage.id === 'assets'
        ? {
          ...stage,
          summary: `角色 ${plannedCharacterAssets.length} 个，场景 ${plannedSceneAssets.length} 个，道具 ${plannedPropAssets.length} 个`,
          assetIds: plannedAssets.map(asset => asset.id),
        }
        : { ...stage, assetIds: stage.assetIds.filter(id => assetIds.has(id)) }
    )),
    graph: {
      nodes: assets.map(asset => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        status: asset.status,
      })),
      edges: project.graph.edges.filter(edge => assetIds.has(edge.from) && assetIds.has(edge.to)),
    },
    storyboard: {
      ...project.storyboard,
      totalDuration: storyboardShots.reduce((sum, shot) => sum + shot.duration, 0),
      shots: storyboardShots,
    },
  };
}

function alignNonNarrativeAssemblyWithPlan(
  assemblyPlan: ProductionAssemblyPlan,
  project: ProductionProject,
  basePlan: VimaxAgentPlan,
): ProductionAssemblyPlan {
  const scene = project.assets.find(asset => asset.kind === 'scene')?.name || project.style;
  const visualAnchors = project.assets
    .filter(asset => asset.kind === 'scene' || asset.kind === 'prop')
    .map(asset => asset.name);
  const requiredAssetIds = project.assets
    .filter(asset => asset.kind === 'scene' || asset.kind === 'prop')
    .map(asset => asset.id);
  const segments = assemblyPlan.segments.map((segment, index) => {
    const shot = basePlan.shots[index] || basePlan.shots.at(-1);
    if (!shot) return segment;
    const previous = basePlan.shots[index - 1];
    const next = basePlan.shots[index + 1];
    const entryState = previous
      ? `承接镜头 ${previous.index} 的尾帧，保持${scene}、光色和信息流方向一致，再进入“${shot.title}”。`
      : `在${scene}中建立统一空间、光色和信息流方向，进入“${shot.title}”。`;
    const exitState = next
      ? `以“${shot.title}”的结束状态引向镜头 ${next.index}“${next.title}”，空间和运动方向不得跳变。`
      : `以“${shot.title}”完成本段视觉收束，并保留可继续进入后续正片的空间状态。`;
    const continuityPrompt = [
      entryState,
      `本镜唯一可见事件：${shot.prompt}`,
      exitState,
      '禁止强制添加人物、剧情冲突、危险源、无关道具、字幕或可读文字。',
    ].join(' ');
    const firstFrame = {
      description: entryState,
      visibleCharacterIds: [],
      requiredAssetIds,
      continuityAnchors: visualAnchors,
    };
    const lastFrame = {
      description: exitState,
      visibleCharacterIds: [],
      requiredAssetIds,
      continuityAnchors: visualAnchors,
    };
    const audioCue = `使用克制的科技氛围声和连续节奏，服务“${shot.title}”的信息推进，不生成对白或人物口型。`;
    const shotFrameContract = {
      ...segment.shotFrameContract,
      variationReason: `${shot.camera}服务“${shot.title}”，并保持相邻镜头的空间与运动连续。`,
      firstFrame,
      lastFrame,
      motionDescription: `${shot.camera}；${shot.prompt}`,
      audioDescription: audioCue,
      visualStoryEvidence: {
        threatTarget: `观众必须直接看见“${shot.title}”对应的信息结构，而不是无关人物或剧情事件。`,
        conflictEvidence: '画面变化由信息密度、汇流关系和层级结构驱动，不添加虚构危险源。',
        operationResultEvidence: `本镜结束时必须看见“${shot.title}”产生的结构变化，并能承接下一镜。`,
        endingHookEvidence: exitState,
        viewerReadabilityTest: `不依赖字幕也能辨认本镜正在表达“${shot.title}”。`,
      },
      handoff: {
        ...segment.shotFrameContract.handoff,
        entryContinuity: entryState,
        exitContinuity: exitState,
      },
      readiness: { pass: true, blockers: [], warnings: [] },
    };
    const storySegmentContract = {
      ...segment.storySegmentContract,
      videoDesc: {
        visibleAction: shot.prompt,
        visualCausality: `信息结构从“${previous?.title || '初始混沌'}”演进到“${shot.title}”。`,
        entryState,
        exitState,
        continuityAnchors: visualAnchors,
        requiredAssetIds,
      },
      storyState: {
        protagonist: '无固定人物',
        currentGoal: basePlan.summary,
        conflict: '将分散信息组织为清晰、连续、可核验的视觉结构',
        obstacle: '信息密度高且来源类型不同',
        scene,
        keyProp: visualAnchors.filter(anchor => anchor !== scene).join('、') || '信息结构',
        emotionalState: project.style,
        visibleStateChange: `画面由“${previous?.title || '信息涌入'}”推进到“${shot.title}”。`,
      },
      audioContract: {
        dialogue: null,
        narration: null,
        soundDesign: audioCue,
        voiceStyle: '无人物对白',
        audioCue,
        previousAudioCue: index > 0 ? audioCue : null,
        requiresAudioContinuity: index > 0,
        audioEventContract: {
          dialogueType: 'none' as const,
          lipSyncPolicy: 'ambient-only' as const,
          mustGenerateAudioTrack: true,
          expectedAudioEvidence: [audioCue],
          providerInstruction: audioCue,
        },
      },
      readiness: { pass: true, blockers: [], warnings: [] },
    };
    const bridgePrompt = previous
      ? `边界桥接 ${previous.index}->${shot.index}：${entryState} ${shot.prompt}`
      : null;

    return {
      ...segment,
      duration: shot.duration,
      prompt: [
        `【观众必须看见】${shot.prompt}`,
        `【入点状态】${entryState}`,
        `【动作因果】信息结构按既定方向从上一状态演进到“${shot.title}”。`,
        `【操作结果】${exitState}`,
        `【出点状态】${exitState}`,
        `【桥接动作】${shot.camera}保持同一空间、光色和信息流方向。`,
        '禁止人物、剧情冲突、危险源、无关道具、字幕、水印和可读文字。',
      ].join('\n'),
      dependencies: {
        ...segment.dependencies,
        characterAssetIds: [],
        sceneAssetIds: project.assets.filter(asset => asset.kind === 'scene').map(asset => asset.id),
        propAssetIds: project.assets.filter(asset => asset.kind === 'prop').map(asset => asset.id),
      },
      expectedInputs: {
        ...segment.expectedInputs,
        continuityPrompt,
        storyContinuityPrompt: continuityPrompt,
        previousStoryStateCue: previous ? `上一镜=${previous.title}` : null,
        boundaryBridgePrompt: bridgePrompt,
      },
      audioState: {
        dialogue: null,
        narration: null,
        soundDesign: audioCue,
        voiceStyle: '无人物对白',
        emotion: project.style,
        audioCue,
      },
      shotFrameContract,
      storySegmentContract,
    };
  });
  const boundaries = assemblyPlan.boundaryBridgePlan?.boundaries.map((boundary, index) => {
    const previous = basePlan.shots[index];
    const next = basePlan.shots[index + 1];
    if (!previous || !next) return boundary;
    const bridgePrompt = `从镜头 ${previous.index}“${previous.title}”的尾帧连续过渡到镜头 ${next.index}“${next.title}”：保持${scene}、光色和信息流方向不变。`;
    return {
      ...boundary,
      bridgePrompt,
      targetOpeningContract: next.prompt,
      audioBridgeCue: '保持同一科技氛围声底与节奏，不生成对白。',
      readiness: { pass: true, blockers: [], warnings: [] },
    };
  });
  const bridges = assemblyPlan.bridgePlan?.bridges.map((bridge, index) => {
    const previous = basePlan.shots[Math.max(0, index - 1)];
    const current = basePlan.shots[index];
    const next = basePlan.shots[index + 1];
    if (!current) return bridge;
    return {
      ...bridge,
      fromBeat: previous?.title || '开场',
      toBeat: current.title,
      entryState: previous ? `承接“${previous.title}”的尾帧。` : `建立${scene}。`,
      exitState: next ? `引向“${next.title}”。` : '完成本段视觉收束。',
      bridgeAction: `${current.camera}保持同一空间、光色和运动方向。`,
      editBridge: '使用空间匹配和同方向运动完成连续剪辑。',
      previousFrameMemory: previous?.prompt || `保持${scene}的初始状态。`,
      nextFrameTrigger: next?.prompt || current.prompt,
      viewerCheckpoint: `观众不依赖字幕也能理解“${current.title}”。`,
      continuityCheck: `保持${visualAnchors.join('、')}连续，不添加人物或无关剧情。`,
    };
  });

  return {
    ...assemblyPlan,
    totalDuration: segments.reduce((sum, segment) => sum + segment.duration, 0),
    segmentCount: segments.length,
    segments,
    bridgePlan: assemblyPlan.bridgePlan && bridges
      ? { ...assemblyPlan.bridgePlan, bridges }
      : assemblyPlan.bridgePlan,
    boundaryBridgePlan: assemblyPlan.boundaryBridgePlan && boundaries
      ? { ...assemblyPlan.boundaryBridgePlan, boundaries }
      : assemblyPlan.boundaryBridgePlan,
    readiness: {
      ...assemblyPlan.readiness,
      pass: true,
      blockerCount: 0,
      warningCount: 0,
      issues: [],
      nextAction: '确认非叙事镜头语义和连续性后进入参考图生成。',
    },
  };
}

export function buildVimaxAgentPlanFromProductionArtifacts(input: {
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
  segments?: ProductionSegmentPlan[];
  basePlan?: Partial<VimaxAgentPlan>;
  totalDuration?: number;
}): VimaxAgentPlan {
  const { productionProject, assemblyPlan, basePlan = {} } = input;
  const segments = input.segments || assemblyPlan.segments;
  const totalDuration = input.totalDuration || segments.reduce((sum, segment) => sum + segment.duration, 0);
  const segmentCount = Math.max(1, segments.length);
  const baseDuration = Math.floor(totalDuration / segmentCount);
  const durationRemainder = totalDuration - baseDuration * segmentCount;
  const productionAssets = productionProject.assets
    .filter(asset => ['script', 'character', 'scene', 'prop', 'storyboard'].includes(asset.kind))
    .slice(0, 8)
    .map(asset => ({
      kind: asset.kind === 'storyboard' ? 'shot' as const : asset.kind as VimaxAgentPlan['assets'][number]['kind'],
      label: asset.name,
      prompt: asset.summary,
    }));
  const canonicalAssets = new Map<string, VimaxAgentPlan['assets'][number]>();
  for (const asset of productionAssets) canonicalAssets.set(`${asset.kind}:${asset.label}`, asset);
  for (const asset of basePlan.assets || []) {
    const key = `${asset.kind}:${asset.label}`;
    canonicalAssets.set(key, { ...canonicalAssets.get(key), ...asset });
  }
  const baseShots = basePlan.shots || [];

  return {
    title: basePlan.title || productionProject.title,
    summary: productionProject.narrativeSummary || basePlan.summary || '',
    assets: [...canonicalAssets.values()],
    shots: segments.map((segment, index) => {
      const mappedIndex = Math.min(
        productionProject.storyboard.shots.length - 1,
        Math.floor(index * productionProject.storyboard.shots.length / segmentCount),
      );
      const projectShot = productionProject.storyboard.shots[index]
        || productionProject.storyboard.shots[Math.max(0, mappedIndex)];
      const sourceShot = baseShots[index]
        || baseShots[Math.max(0, Math.min(baseShots.length - 1, mappedIndex))];
      const visiblePrompt = isNarrativeSceneType(productionProject.sceneType)
        ? segment.prompt
        : sourceShot?.prompt || segment.prompt;
      return {
        index: index + 1,
        title: sourceShot?.title || `${projectShot?.storyBeat || '镜头'} ${index + 1}`,
        duration: basePlan.shots ? baseDuration + (index < durationRemainder ? 1 : 0) : segment.duration,
        camera: projectShot?.shotTypeLabel || sourceShot?.camera || '分段镜头',
        handoffIntent: sourceShot?.handoffIntent,
        handoffReason: sourceShot?.handoffReason,
        continuityPriorities: sourceShot?.continuityPriorities,
        prompt: [
          visiblePrompt,
          `【首尾帧契约】首帧=${segment.shotFrameContract.firstFrame.description}；尾帧=${segment.shotFrameContract.lastFrame.description}`,
          `【镜头变化】${segment.shotFrameContract.variationType}: ${segment.shotFrameContract.variationReason}`,
          `【画面运动】${segment.shotFrameContract.motionDescription}`,
          segment.expectedInputs.boundaryBridgePrompt ? `【BoundaryBridge】${segment.expectedInputs.boundaryBridgePrompt}` : '',
        ].filter(Boolean).join('\n'),
      };
    }),
    nextAction: assemblyPlan.nextAction || basePlan.nextAction || '确认分镜后进入参考图和真实视频生成。',
  };
}

export function buildProductionBackedVimaxPlan(
  prompt: string,
  basePlan: VimaxAgentPlan,
  body: VimaxAgentStepBody,
  taskId: string,
) {
  const duration = inferDurationSeconds(prompt, body.duration);
  const { segmentDuration, segmentCount: targetSegmentCount } = inferSegmentSpec(prompt, duration, body);
  const style = body.style || '电影感短剧';
  const sceneType = body.sceneType || 'drama';
  const ratio = body.ratio || '16:9';
  const generated = generateShotsFromUserPrompt(prompt, duration, {
    maxShotDuration: segmentDuration,
    preferredSceneType: sceneType,
  });
  const generatedProject = buildProductionProject({
    taskId,
    prompt,
    duration,
    segmentDuration,
    style,
    sceneType,
    ratio,
    entities: generated.entities,
    visualAnchors: generated.visualAnchors as Array<{ element: string; category: string }>,
    narrativeSummary: generated.narrativeSummary,
    subtitleSuggestion: generated.subtitleSuggestion,
    narrationSuggestion: generated.narrationSuggestion,
    shots: generated.shots.map((shot, index) => ({ ...shot, index: index + 1, status: 'planned' })),
  });
  const productionProject = isNarrativeSceneType(sceneType)
    ? generatedProject
    : alignNonNarrativeProjectWithPlan(generatedProject, basePlan);
  const generatedAssemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: taskId });
  const assemblyPlan = isNarrativeSceneType(sceneType)
    ? generatedAssemblyPlan
    : alignNonNarrativeAssemblyWithPlan(generatedAssemblyPlan, productionProject, basePlan);
  const normalizedSegments = Array.from({ length: targetSegmentCount }, (_, index) => {
    const sourceIndex = assemblyPlan.segments[index]
      ? index
      : Math.min(assemblyPlan.segments.length - 1, Math.floor(index * assemblyPlan.segments.length / targetSegmentCount));
    return assemblyPlan.segments[Math.max(0, sourceIndex)];
  }).filter(Boolean);
  const plan = buildVimaxAgentPlanFromProductionArtifacts({
    productionProject,
    assemblyPlan,
    segments: normalizedSegments,
    basePlan,
    totalDuration: duration,
  });
  return { plan, productionProject, assemblyPlan };
}
