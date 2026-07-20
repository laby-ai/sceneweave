import type { VimaxAgentPlan } from './vimax-agent-contract';

export type VimaxShotHandoffIntent = 'strict-frame' | 'reference-flexible';
export type VimaxContinuityPriority = 'action' | 'screen-direction' | 'subject' | 'scene' | 'prop';

export interface VimaxShotGenerationRoute {
  mode: 'first-frame' | 'multi-reference';
  requestedBy: 'planner' | 'server-default';
  reason: string;
  model: string;
  requiresPreviousLastFrame: boolean;
  canonicalFirstFrameRequired?: boolean;
  referenceRoles: Array<'subject' | 'scene' | 'prop' | 'previous-tail'>;
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

export function resolveVimaxShotGenerationRoutes(input: RouteInput): VimaxShotGenerationRoute[] {
  return input.shots.map((shot, index) => {
    const happyHorse = isHappyHorseProvider(input.provider);
    if (input.routingStrategy === 'legacy-dual-route') {
      const hasPlannerIntent = shot.handoffIntent === 'strict-frame'
        || shot.handoffIntent === 'reference-flexible';
      const strictFrame = index > 0 && (hasPlannerIntent
        ? shot.handoffIntent === 'strict-frame'
        : /(承接|继续|同一时刻|同轴|动作连续|不切换场景)/.test(`${shot.title} ${shot.camera} ${shot.prompt}`));
      return {
        mode: strictFrame ? 'first-frame' : 'multi-reference',
        requestedBy: index === 0 || !hasPlannerIntent ? 'server-default' : 'planner',
        reason: index === 0
          ? '第一镜没有上一镜尾帧，使用已批准参考素材建立主体与场景。'
          : shot.handoffReason?.trim()
            || (strictFrame
              ? '同一动作或空间需要从上一镜尾帧继续。'
              : '允许换景或换机位，以批准参考素材保持主体和美术设定。'),
        model: happyHorse
          ? strictFrame ? 'happyhorse-1.1-i2v' : 'happyhorse-1.1-r2v'
          : input.configuredModel,
        requiresPreviousLastFrame: strictFrame,
        canonicalFirstFrameRequired: false,
        referenceRoles: strictFrame
          ? ['previous-tail']
          : ['subject', 'scene', 'prop', 'previous-tail'],
      };
    }
    return {
      mode: 'first-frame',
      requestedBy: 'server-default',
      reason: index === 0
        ? '使用已批准主体、场景和道具素材编译权威首帧，再进入图生视频。'
        : '使用上一镜尾帧与已批准资产编译当前镜头的权威首帧，再进入图生视频。',
      model: happyHorse ? 'happyhorse-1.1-i2v' : input.configuredModel,
      requiresPreviousLastFrame: index > 0,
      canonicalFirstFrameRequired: true,
      referenceRoles: index === 0
        ? ['subject', 'scene', 'prop']
        : ['subject', 'scene', 'prop', 'previous-tail'],
    };
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
