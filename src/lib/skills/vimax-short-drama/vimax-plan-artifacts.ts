import { buildProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionAssemblyPlan, ProductionSegmentPlan } from '@/lib/production-assembly-plan';
import { buildProductionProject } from '@/lib/production-project';
import type { ProductionAsset, ProductionAssetKind, ProductionProject } from '@/lib/production-project';
import { generateShotsFromUserPrompt } from '@/lib/storyboard-generator';
import type { PromptBasedShot } from '@/lib/storyboard-generator';
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

function preservePlannerShotDirection(
  generatedShots: PromptBasedShot[],
  plannedShots: VimaxAgentPlan['shots'],
) {
  if (plannedShots.length === 0) return generatedShots;
  return generatedShots.map((generatedShot, index) => {
    const mappedIndex = Math.min(
      plannedShots.length - 1,
      Math.floor(index * plannedShots.length / generatedShots.length),
    );
    const plannedShot = plannedShots[index] || plannedShots[Math.max(0, mappedIndex)];
    const plannedPrompt = plannedShot?.prompt?.trim();
    const plannedCamera = plannedShot?.camera?.trim();
    return {
      ...generatedShot,
      prompt: plannedPrompt || generatedShot.prompt,
      shotTypeLabel: plannedCamera || generatedShot.shotTypeLabel,
    };
  });
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
    ...(!explicitCharacter ? {
      continuityRules: [
        visualScene ? `保持${visualScene}的空间结构、光色和尺度连续` : '保持主要空间、光色和尺度连续',
        `保持${visualSubject}的形态、运动方向和演化状态连续`,
        '后一镜先承接前一镜尾帧，再推进新的视觉变化',
        '镜头变化服务信息演进，不引入无关人物、场景或道具',
      ],
    } : {}),
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
        return planned ? {
          ...shot,
          prompt: planned.prompt || shot.prompt,
          ...(!explicitCharacter ? {
            dramaticPurpose: planned.title || planned.prompt || shot.dramaticPurpose,
            emotionShift: planned.audioIntent || story?.emotionalArc?.shift || shot.emotionShift,
          } : {}),
          subtitleText: planned.dialogue || (explicitCharacter ? shot.subtitleText : undefined),
          narrationText: planned.narration || (explicitCharacter ? shot.narrationText : undefined),
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
  const plannerBackedShots = preservePlannerShotDirection(generated.shots, basePlan.shots);
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
    narrativeSummary: basePlan.summary?.trim() || generated.narrativeSummary,
    subtitleSuggestion: generated.subtitleSuggestion,
    narrationSuggestion: generated.narrationSuggestion,
    shots: plannerBackedShots.map((shot, index) => ({ ...shot, index: index + 1, status: 'planned' })),
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
