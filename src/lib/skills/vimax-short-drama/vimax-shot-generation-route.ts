import type { VimaxAgentPlan } from './vimax-agent-contract';

export type VimaxShotHandoffIntent = 'strict-frame' | 'reference-flexible';
export type VimaxContinuityPriority = 'action' | 'screen-direction' | 'subject' | 'scene' | 'prop';
export type VimaxShotBoundaryIntent = 'establish' | 'continue' | 'bridge' | 'cut';

export interface VimaxShotGenerationRoute {
  mode: 'first-frame' | 'multi-reference' | 'text-only';
  boundaryIntent: VimaxShotBoundaryIntent;
  requestedBy: 'planner' | 'server-default';
  reason: string;
  model: string;
  requiresPreviousLastFrame: boolean;
  canonicalFirstFrameRequired?: boolean;
  referenceRoles: Array<'subject' | 'scene' | 'prop' | 'previous-tail'>;
  requiresConfirmation: boolean;
  confirmationReason?: string;
}

interface RouteInput {
  shots: VimaxAgentPlan['shots'];
  provider: string;
  configuredModel: string;
  routingStrategy?: 'canonical-i2v' | 'legacy-dual-route';
}

function isHappyHorseProvider(provider: string) {
  return provider.trim().toLowerCase() === 'happyhorse-dashscope';
}

function normalizeBoundaryState(value: string | undefined) {
  return value?.trim().replace(/\s+/g, ' ') || '';
}

export function resolveVimaxShotGenerationRoutes(input: RouteInput): VimaxShotGenerationRoute[] {
  return input.shots.map((shot, index) => {
    const previousShot = index > 0 ? input.shots[index - 1] : undefined;
    const happyHorse = isHappyHorseProvider(input.provider);
    if (input.routingStrategy === 'legacy-dual-route') {
      const hasPlannerIntent = shot.handoffIntent === 'strict-frame'
        || shot.handoffIntent === 'reference-flexible';
      const strictFrame = index > 0 && (hasPlannerIntent
        ? shot.handoffIntent === 'strict-frame'
        : false);
      return {
        mode: happyHorse ? 'first-frame' : strictFrame ? 'first-frame' : 'multi-reference',
        boundaryIntent: index === 0 ? 'establish' : strictFrame ? 'continue' : 'cut',
        requestedBy: index === 0 || !hasPlannerIntent ? 'server-default' : 'planner',
        reason: index === 0
          ? '第一镜没有上一镜尾帧，使用已批准参考素材建立主体与场景。'
          : shot.handoffReason?.trim()
            || (strictFrame
              ? '同一动作或空间需要从上一镜尾帧继续。'
              : '允许换景或换机位，以批准参考素材保持主体和美术设定。'),
        model: happyHorse ? 'happyhorse-1.1-i2v' : input.configuredModel,
        requiresPreviousLastFrame: strictFrame,
        canonicalFirstFrameRequired: happyHorse && !strictFrame,
        referenceRoles: strictFrame
          ? ['previous-tail']
          : ['subject', 'scene', 'prop', 'previous-tail'],
        requiresConfirmation: false,
      };
    }
    const hasSemanticRoute = Boolean(
      shot.spatialRelation
      && shot.temporalRelation
      && shot.routeConfidence,
    );
    const semanticContinuous = shot.spatialRelation === 'same-scene'
      && shot.temporalRelation === 'continuous';
    const semanticBridge = shot.spatialRelation === 'new-scene'
      && shot.temporalRelation === 'continuous';
    const semanticCut = shot.temporalRelation === 'time-jump'
      || shot.temporalRelation === 'elapsed'
      || (shot.spatialRelation === 'new-scene' && shot.temporalRelation !== 'continuous');
    const boundaryIntent: VimaxShotBoundaryIntent = index === 0
      ? 'establish'
      : semanticContinuous
        ? 'continue'
        : semanticBridge
          ? 'bridge'
          : 'cut';
    const continuousSceneMismatch = index > 0
      && semanticContinuous
      && (
        !previousShot?.sceneId
        || !shot.sceneId
        || previousShot.sceneId !== shot.sceneId
      );
    const previousActionEnd = normalizeBoundaryState(previousShot?.actionEnd);
    const currentActionStart = normalizeBoundaryState(shot.actionStart);
    const continuousActionMismatch = index > 0
      && (semanticContinuous || semanticBridge)
      && (
        !previousActionEnd
        || !currentActionStart
        || previousActionEnd !== currentActionStart
      );
    const plannerConflicts = shot.conflictFlags?.filter(Boolean) || [];
    const requiresConfirmation = !hasSemanticRoute
      || (!semanticContinuous && !semanticBridge && !semanticCut)
      || shot.routeConfidence !== 'high'
      || continuousSceneMismatch
      || continuousActionMismatch
      || plannerConflicts.length > 0;
    const requiresPreviousTail = index > 0 && (semanticContinuous || semanticBridge);
    const canonicalFirstFrameRequired = happyHorse && !requiresPreviousTail;

    return {
      mode: happyHorse ? 'first-frame' : requiresPreviousTail ? 'first-frame' : 'multi-reference',
      boundaryIntent,
      requestedBy: index === 0 ? 'server-default' : 'planner',
      reason: index === 0
        ? '第一镜先由批准素材编译权威首帧，再统一进入图生视频。'
        : semanticContinuous
          ? '同一场景中的连续动作从上一镜真实尾帧继续。'
          : semanticBridge
            ? '连续跨越空间边界，从上一镜真实尾帧完成过门动作并落到下一场景。'
            : '明确换景或时间推进，先编译新场景权威首帧再进入图生视频。',
      model: happyHorse ? 'happyhorse-1.1-i2v' : input.configuredModel,
      requiresPreviousLastFrame: requiresPreviousTail,
      canonicalFirstFrameRequired,
      referenceRoles: requiresPreviousTail
        ? ['previous-tail']
        : ['subject', 'scene', 'prop'],
      requiresConfirmation,
      confirmationReason: requiresConfirmation
        ? [
          !hasSemanticRoute ? '当前项目缺少新版镜头时空与置信度合同。' : '',
          !semanticContinuous && !semanticBridge && !semanticCut ? '镜头时空关系无法映射到受支持的生成路线。' : '',
          shot.routeConfidence === 'medium' ? '规划模型对镜头衔接判断为中置信度。' : '',
          shot.routeConfidence === 'low' ? '规划模型对镜头衔接判断为低置信度。' : '',
          continuousSceneMismatch ? '连续镜头的场景 ID 不一致或缺失。' : '',
          continuousActionMismatch ? '连续镜头的动作边界没有逐字承接上一镜尾态。' : '',
          ...plannerConflicts,
        ].filter(Boolean).join(' ')
        : undefined,
    };
  });
}

export interface VimaxShotRouteIssue {
  shotIndex: number;
  code: 'legacy-plan-route-contract-missing' | 'shot-route-confirmation-required';
  reason: string;
}

export function collectVimaxShotRouteIssues(
  assemblyPlan: { segments?: Array<{ index?: number; generationRoute?: VimaxShotGenerationRoute }> },
): VimaxShotRouteIssue[] {
  return (assemblyPlan.segments || []).flatMap((segment, index) => {
    const route = segment.generationRoute;
    if (!route) {
      return [{
        shotIndex: Number.isInteger(segment.index) ? Number(segment.index) + 1 : index + 1,
        code: 'legacy-plan-route-contract-missing' as const,
        reason: '当前项目缺少新版镜头生成路线。',
      }];
    }
    if (!route.requiresConfirmation) return [];
    const reason = route.confirmationReason || '镜头生成路线需要确认。';
    return [{
      shotIndex: Number.isInteger(segment.index) ? Number(segment.index) + 1 : index + 1,
      code: /缺少新版镜头时空与置信度合同/.test(reason)
        ? 'legacy-plan-route-contract-missing'
        : 'shot-route-confirmation-required',
      reason,
    }];
  });
}

export function applyVimaxShotGenerationRoutes<
  TPlan extends VimaxAgentPlan,
  TSegment extends object,
  TAssembly extends { segments: TSegment[] },
>(input: {
  plan: TPlan;
  assemblyPlan: TAssembly;
  provider: string;
  configuredModel: string;
  routingStrategy?: 'canonical-i2v' | 'legacy-dual-route';
}): {
  plan: TPlan;
  assemblyPlan: TAssembly & { segments: Array<TSegment & { generationRoute: VimaxShotGenerationRoute }> };
} {
  const routes = resolveVimaxShotGenerationRoutes({
    shots: input.plan.shots,
    provider: input.provider,
    configuredModel: input.configuredModel,
    routingStrategy: input.routingStrategy,
  });
  return {
    plan: input.plan,
    assemblyPlan: {
      ...input.assemblyPlan,
      segments: input.assemblyPlan.segments.map((segment, index) => ({
        ...segment,
        generationRoute: routes[index],
      })),
    } as TAssembly & { segments: Array<TSegment & { generationRoute: VimaxShotGenerationRoute }> },
  };
}
