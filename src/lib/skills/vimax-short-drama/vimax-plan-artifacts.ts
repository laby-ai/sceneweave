import { buildProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionAssemblyPlan, ProductionSegmentPlan } from '@/lib/production-assembly-plan';
import { buildProductionProject } from '@/lib/production-project';
import type {
  ProductionAsset,
  ProductionAssetKind,
  ProductionProject,
  ProductionStoryBeatId,
  ProductionStoryBible,
} from '@/lib/production-project';
import type {
  NarrationSuggestion,
  PromptBasedShot,
  ShotPhase,
  SubtitleSuggestion,
  UserInputEntities,
} from '@/lib/storyboard-generator';
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

const STORY_BEAT_IDS: ProductionStoryBeatId[] = ['setup', 'inciting', 'conflict', 'turning', 'resolution'];

function storyBeatIdForShot(index: number, total: number) {
  const bucket = Math.min(STORY_BEAT_IDS.length - 1, Math.floor(index * STORY_BEAT_IDS.length / Math.max(1, total)));
  return STORY_BEAT_IDS[bucket];
}

function shotPhaseForBeat(beatId: ProductionStoryBeatId): ShotPhase {
  if (beatId === 'setup') return 'establishing';
  if (beatId === 'inciting') return 'developing';
  if (beatId === 'conflict') return 'detail';
  if (beatId === 'turning') return 'climax';
  return 'resolving';
}

function plannerShots(plan: VimaxAgentPlan): Array<PromptBasedShot & {
  index: number;
  status: 'planned';
  sceneId?: string;
  sceneLabel?: string;
  characterIds?: string[];
  propIds?: string[];
  actionStart?: string;
  actionEnd?: string;
  firstFrameDescription?: string;
  lastFrameDescription?: string;
  motionDescription?: string;
  audioIntent?: string;
}> {
  return plan.shots.map((shot, index) => {
    const beatId = storyBeatIdForShot(index, plan.shots.length);
    return {
      id: `planner-shot-${index + 1}`,
      index: index + 1,
      status: 'planned',
      prompt: shot.prompt.trim(),
      duration: shot.duration,
      phase: shotPhaseForBeat(beatId),
      phaseLabel: shot.title,
      shotTypeLabel: shot.camera,
      subtitleText: shot.dialogue?.trim() || '',
      narrationText: shot.narration?.trim() || '',
      sceneId: shot.sceneId,
      sceneLabel: plan.scenes?.find(scene => scene.id === shot.sceneId)?.label,
      characterIds: shot.characterIds,
      propIds: shot.propIds,
      actionStart: shot.actionStart,
      actionEnd: shot.actionEnd,
      firstFrameDescription: shot.firstFrameDescription,
      lastFrameDescription: shot.lastFrameDescription,
      motionDescription: shot.motionDescription,
      audioIntent: shot.audioIntent,
    };
  });
}

function buildPlannerSuggestions(plan: VimaxAgentPlan): {
  subtitle: SubtitleSuggestion;
  narration: NarrationSuggestion;
} {
  let elapsed = 0;
  const subtitleSegments: SubtitleSuggestion['segments'] = [];
  const narrationPerShot: NarrationSuggestion['perShot'] = [];
  for (const shot of plan.shots) {
    const startTime = elapsed;
    const endTime = elapsed + shot.duration;
    const dialogue = shot.dialogue?.trim() || '';
    const narration = shot.narration?.trim() || '';
    if (dialogue) subtitleSegments.push({ text: dialogue, startTime, endTime });
    if (narration) {
      narrationPerShot.push({
        shotIndex: shot.index,
        text: narration,
        startTime,
        endTime,
      });
    }
    elapsed = endTime;
  }
  return {
    subtitle: {
      segments: subtitleSegments,
      fullText: subtitleSegments.map(segment => segment.text).join('\n'),
    },
    narration: {
      script: narrationPerShot.map(segment => segment.text).join('\n'),
      perShot: narrationPerShot,
    },
  };
}

function buildPlannerEntities(plan: VimaxAgentPlan, style: string): UserInputEntities {
  const firstShot = plan.shots[0];
  const lastShot = plan.shots[plan.shots.length - 1];
  return {
    subject: plan.story?.protagonist?.trim() || plan.characters?.[0]?.label?.trim() || plan.summary.trim(),
    location: plan.scenes?.[0]?.label?.trim() || '',
    timeOfDay: plan.scenes?.[0]?.timeOfDay?.trim() || '',
    action: [
      firstShot?.actionStart?.trim(),
      lastShot?.actionEnd?.trim(),
    ].filter(Boolean).join(' -> '),
    emotion: [
      plan.story?.emotionalArc?.start?.trim(),
      plan.story?.emotionalArc?.shift?.trim(),
      plan.story?.emotionalArc?.end?.trim(),
    ].filter(Boolean).join(' -> '),
    objects: plan.props?.map(prop => prop.label.trim()).filter(Boolean) || [],
    atmosphere: style,
  };
}

function buildPlannerStoryBible(plan: VimaxAgentPlan, shots: PromptBasedShot[]): ProductionStoryBible {
  const story = plan.story;
  const beats = STORY_BEAT_IDS.map(beatId => {
    const sourceShots = plan.shots.filter((_, index) => storyBeatIdForShot(index, plan.shots.length) === beatId);
    return {
      id: beatId,
      label: sourceShots.map(shot => shot.title.trim()).filter(Boolean).join(' / ') || beatId,
      purpose: sourceShots.map(shot => shot.title.trim() || shot.prompt.trim()).filter(Boolean).join('；'),
      emotion: beatId === 'setup'
        ? story?.emotionalArc?.start?.trim() || ''
        : beatId === 'resolution'
          ? story?.emotionalArc?.end?.trim() || ''
          : story?.emotionalArc?.shift?.trim() || '',
      visualGoal: sourceShots.map(shot => shot.prompt.trim()).filter(Boolean).join('；'),
      shotIds: shots
        .filter((_, index) => storyBeatIdForShot(index, shots.length) === beatId)
        .map(shot => shot.id),
    };
  }).filter(beat => beat.shotIds.length > 0);
  const continuityRules = [
    ...(plan.characters || []).map(character => `角色外观保持一致：${[
      character.label,
      ...(character.continuityAnchors || []),
    ].filter(Boolean).join('、')}`),
    ...(plan.scenes || []).map(scene => `场景保持一致：${[
      scene.label,
      ...(scene.continuityAnchors || []),
    ].filter(Boolean).join('、')}`),
    ...(plan.props || []).map(prop => `道具状态按剧情变化：${[
      prop.label,
      prop.state,
    ].filter(Boolean).join('、')}`),
    ...plan.shots.slice(1).map((shot, index) => [
      plan.shots[index]?.lastFrameDescription?.trim(),
      shot.firstFrameDescription?.trim(),
    ].filter(Boolean).join(' → ')).map(rule => `镜头衔接：${rule}`),
  ].filter(Boolean);
  return {
    premise: story?.premise?.trim() || plan.summary.trim(),
    protagonist: story?.protagonist?.trim() || plan.characters?.[0]?.label?.trim() || '',
    desire: story?.desire?.trim() || '',
    obstacle: story?.obstacle?.trim() || '',
    relationship: '',
    conflict: story?.conflict?.trim() || '',
    turningPoint: story?.turningPoint?.trim() || '',
    endingHook: story?.endingHook?.trim() || '',
    emotionalArc: {
      start: story?.emotionalArc?.start?.trim() || '',
      shift: story?.emotionalArc?.shift?.trim() || '',
      end: story?.emotionalArc?.end?.trim() || '',
    },
    continuityRules,
    beats,
  };
}

function applyPlannerNarrativeContext(
  project: ProductionProject,
  plan: VimaxAgentPlan,
): ProductionProject {
  const story = plan.story;
  const explicitCharacter = Boolean(
    plan.characters?.length
    || plan.assets.some(asset => asset.kind === 'character')
    || plan.shots.some(shot => shot.characterIds?.length),
  );
  const plannerAssets = plan.assets
    .filter(asset => ['character', 'scene', 'prop'].includes(asset.kind))
    .map((asset, index): ProductionAsset => ({
      id: `planner-${asset.kind}-${index + 1}`,
      kind: asset.kind as ProductionAssetKind,
      name: asset.label,
      status: 'planned',
      summary: asset.prompt || asset.label,
      source: 'prompt',
      relatedShotIds: project.storyboard.shots.map(shot => shot.id),
    }));
  const plannerKinds = new Set(plannerAssets.map(asset => asset.kind));
  const assets = [
    ...project.assets.filter(asset => {
      if (!explicitCharacter && asset.kind === 'character') return false;
      return !plannerKinds.has(asset.kind);
    }),
    ...plannerAssets,
  ].map(asset => (
    asset.kind === 'script'
      ? { ...asset, summary: plan.summary?.trim() || asset.summary }
      : asset
  ));
  const visualSubject = story?.protagonist
    || plannerAssets.find(asset => asset.kind === 'prop')?.name
    || plan.summary
    || project.storyBible.protagonist;
  const visualScene = plannerAssets.find(asset => asset.kind === 'scene')?.name;
  const plannerContinuityRules = [
    plan.characters?.length
      ? `角色外观保持一致：${plan.characters.map(character => [
        character.label,
        ...(character.continuityAnchors || []),
      ].join('、')).join('；')}`
      : '',
    plan.scenes?.length
      ? `场景保持一致：${plan.scenes.map(scene => [
        scene.label,
        ...(scene.continuityAnchors || []),
      ].join('、')).join('；')}`
      : '',
    plan.props?.length
      ? `道具状态按剧情变化：${plan.props.map(prop => `${prop.label}（${prop.state}）`).join('；')}`
      : '',
    '相邻镜头先承接上一镜的结束画面和动作，再推进下一步。',
  ].filter(Boolean);
  const storyBible = story ? {
    ...project.storyBible,
    premise: story.premise || project.storyBible.premise,
    protagonist: story.protagonist || visualSubject,
    desire: story.desire || project.storyBible.desire,
    obstacle: story.obstacle || project.storyBible.obstacle,
    conflict: story.conflict || project.storyBible.conflict,
    turningPoint: story.turningPoint || project.storyBible.turningPoint,
    endingHook: story.endingHook || project.storyBible.endingHook,
    relationship: !explicitCharacter && visualScene
      ? `${visualSubject}在${visualScene}中的视觉演变`
      : project.storyBible.relationship,
    emotionalArc: {
      start: story.emotionalArc?.start || project.storyBible.emotionalArc.start,
      shift: story.emotionalArc?.shift || project.storyBible.emotionalArc.shift,
      end: story.emotionalArc?.end || project.storyBible.emotionalArc.end,
    },
    continuityRules: plannerContinuityRules.length > 1
      ? plannerContinuityRules
      : !explicitCharacter ? [
        visualScene ? `保持${visualScene}的空间结构、光色和尺度连续` : '保持主要空间、光色和尺度连续',
        `保持${visualSubject}的形态、运动方向和演化状态连续`,
        '后一镜先承接前一镜尾帧，再推进新的视觉变化',
        '镜头变化服务信息演进，不引入无关人物、场景或道具',
      ] : project.storyBible.continuityRules,
  } : {
    ...project.storyBible,
    ...(!explicitCharacter ? {
      protagonist: visualSubject,
      relationship: visualScene
        ? `${visualSubject}在${visualScene}中的视觉演变`
        : project.storyBible.relationship,
      desire: plan.summary || project.storyBible.desire,
      conflict: plan.summary || project.storyBible.conflict,
      continuityRules: [
        visualScene ? `保持${visualScene}的空间结构、光色和尺度连续` : '保持主要空间、光色和尺度连续',
        `保持${visualSubject}的形态、运动方向和演化状态连续`,
        '后一镜先承接前一镜尾帧，再推进新的视觉变化',
        '镜头变化服务信息演进，不引入无关人物、场景或道具',
      ],
    } : {}),
  };
  return {
    ...project,
    assets,
    narrativeSummary: plan.summary?.trim() || project.narrativeSummary,
    storyBible,
    storyboard: {
      ...project.storyboard,
      shots: project.storyboard.shots.map((shot, index) => {
        const planned = plan.shots[index];
        const sceneLabel = plan.scenes?.find(scene => scene.id === planned?.sceneId)?.label;
        return planned ? {
          ...shot,
          prompt: planned.prompt || shot.prompt,
          sceneId: planned.sceneId,
          sceneLabel,
          characterIds: planned.characterIds,
          propIds: planned.propIds,
          actionStart: planned.actionStart,
          actionEnd: planned.actionEnd,
          firstFrameDescription: planned.firstFrameDescription,
          lastFrameDescription: planned.lastFrameDescription,
          motionDescription: planned.motionDescription,
          audioIntent: planned.audioIntent,
          ...(!explicitCharacter ? {
            dramaticPurpose: planned.title || planned.prompt || shot.dramaticPurpose,
            emotionShift: planned.audioIntent || story?.emotionalArc?.shift || shot.emotionShift,
          } : {}),
          subtitleText: planned.dialogue?.trim() || '',
          narrationText: planned.narration?.trim() || '',
        } : shot;
      }),
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
    story: basePlan.story,
    characters: basePlan.characters,
    scenes: basePlan.scenes,
    props: basePlan.props,
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
      return {
        index: index + 1,
        title: sourceShot?.title || `${projectShot?.storyBeat || '镜头'} ${index + 1}`,
        duration: basePlan.shots ? baseDuration + (index < durationRemainder ? 1 : 0) : segment.duration,
        camera: projectShot?.shotTypeLabel || sourceShot?.camera || '分段镜头',
        description: sourceShot?.description || sourceShot?.prompt,
        sceneId: sourceShot?.sceneId,
        characterIds: sourceShot?.characterIds,
        propIds: sourceShot?.propIds,
        actionStart: sourceShot?.actionStart,
        actionEnd: sourceShot?.actionEnd,
        firstFrameDescription: sourceShot?.firstFrameDescription,
        lastFrameDescription: sourceShot?.lastFrameDescription,
        motionDescription: sourceShot?.motionDescription,
        dialogue: sourceShot?.dialogue,
        narration: sourceShot?.narration,
        audioIntent: sourceShot?.audioIntent,
        spatialRelation: sourceShot?.spatialRelation,
        temporalRelation: sourceShot?.temporalRelation,
        routeConfidence: sourceShot?.routeConfidence,
        conflictFlags: sourceShot?.conflictFlags,
        continuityPriorities: sourceShot?.continuityPriorities,
        prompt: [
          segment.prompt,
          `【首尾帧契约】首帧=${segment.shotFrameContract.firstFrame.description}；尾帧=${segment.shotFrameContract.lastFrame.description}`,
          `【镜头变化】${segment.shotFrameContract.variationType}: ${segment.shotFrameContract.variationReason}`,
          `【画面运动】${segment.shotFrameContract.motionDescription}`,
          sourceShot?.actionStart ? `【动作起点】${sourceShot.actionStart}` : '',
          sourceShot?.actionEnd ? `【动作终点】${sourceShot.actionEnd}` : '',
          sourceShot?.audioIntent ? `【声音意图】${sourceShot.audioIntent}` : '',
          segment.expectedInputs.boundaryBridgePrompt ? `【BoundaryBridge】${segment.expectedInputs.boundaryBridgePrompt}` : '',
        ].filter(Boolean).join('\n'),
      };
    }),
    nextAction: basePlan.nextAction || assemblyPlan.nextAction || '确认分镜后进入参考图和真实视频生成。',
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
  const planShots = plannerShots(basePlan);
  const suggestions = buildPlannerSuggestions(basePlan);
  const entities = buildPlannerEntities(basePlan, style);
  const generatedProject = buildProductionProject({
    taskId,
    prompt,
    duration,
    segmentDuration,
    style,
    sceneType,
    ratio,
    entities,
    visualAnchors: basePlan.assets.map(asset => ({ element: asset.label, category: asset.kind })),
    narrativeSummary: basePlan.summary.trim(),
    subtitleSuggestion: suggestions.subtitle,
    narrationSuggestion: suggestions.narration,
    shots: planShots,
    authoritativeStoryBible: buildPlannerStoryBible(basePlan, planShots),
    preserveShotNarrative: true,
  });
  const productionProject = applyPlannerNarrativeContext(generatedProject, basePlan);
  const assemblyPlan = buildProductionAssemblyPlan({ productionProject, sourceTaskId: taskId });
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
