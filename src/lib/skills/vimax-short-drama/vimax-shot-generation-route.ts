import type { VimaxAgentPlan } from './vimax-agent-contract';

export type VimaxShotHandoffIntent = 'strict-frame' | 'reference-flexible';
export type VimaxContinuityPriority = 'action' | 'screen-direction' | 'subject' | 'scene' | 'prop';

export interface VimaxShotGenerationRoute {
  mode: 'first-frame' | 'multi-reference';
  requestedBy: 'planner' | 'server-default';
  reason: string;
  model: string;
  requiresPreviousLastFrame: boolean;
  referenceRoles: Array<'subject' | 'scene' | 'prop' | 'previous-tail'>;
}

interface RouteInput {
  shots: VimaxAgentPlan['shots'];
  provider: string;
  configuredModel: string;
}

function isHappyHorseProvider(provider: string) {
  return provider.trim().toLowerCase() === 'happyhorse-dashscope';
}

function plannerRequestedStrictFrame(shot: VimaxAgentPlan['shots'][number]) {
  return shot.handoffIntent === 'strict-frame';
}

function serverDefaultStrictFrame(shot: VimaxAgentPlan['shots'][number]) {
  return /(承接|继续|同一时刻|同轴|动作连续|不切换场景)/.test(
    `${shot.title} ${shot.camera} ${shot.prompt}`,
  );
}

export function resolveVimaxShotGenerationRoutes(input: RouteInput): VimaxShotGenerationRoute[] {
  return input.shots.map((shot, index) => {
    const hasPlannerIntent = shot.handoffIntent === 'strict-frame'
      || shot.handoffIntent === 'reference-flexible';
    const strictFrame = index > 0 && (hasPlannerIntent
      ? plannerRequestedStrictFrame(shot)
      : serverDefaultStrictFrame(shot));
    const happyHorse = isHappyHorseProvider(input.provider);
    const mode = strictFrame ? 'first-frame' as const : 'multi-reference' as const;
    const model = happyHorse
      ? strictFrame ? 'happyhorse-1.1-i2v' : 'happyhorse-1.1-r2v'
      : input.configuredModel;
    return {
      mode,
      requestedBy: index === 0 || !hasPlannerIntent ? 'server-default' : 'planner',
      reason: index === 0
        ? '第一镜没有上一镜尾帧，使用已批准参考素材建立主体与场景。'
        : shot.handoffReason?.trim()
          || (strictFrame
            ? '同一动作或空间需要从上一镜尾帧继续。'
            : '允许换景或换机位，以批准参考素材保持主体和美术设定。'),
      model,
      requiresPreviousLastFrame: strictFrame,
      referenceRoles: strictFrame
        ? ['previous-tail']
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
}): {
  plan: TPlan;
  assemblyPlan: TAssembly & { segments: Array<TSegment & { generationRoute: VimaxShotGenerationRoute }> };
} {
  const routes = resolveVimaxShotGenerationRoutes({
    shots: input.plan.shots,
    provider: input.provider,
    configuredModel: input.configuredModel,
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
