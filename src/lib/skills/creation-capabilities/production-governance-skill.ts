import type { CreationCapabilitySkill } from './types';

export const productionGovernanceSkill = {
  id: 'production-governance',
  name: '制作计划与执行边界',
  description: '在执行前锁定 pipeline、素材清单、provider、成本确认、阶段检查点和 render 路径。',
  sourceProject: 'OpenMontage',
  standard: 'sceneweave-vimax-skill-v1',
  referenceMode: 'behavioral-reference',
  implementation: 'sceneweave-native',
  runtime: 'sceneweave',
  executor: 'existing-sceneweave-chain',
  inputs: ['plan', 'materials', 'providerReadiness', 'ratio', 'resolution'],
  outputs: ['productionPlan', 'providerRoutes', 'checkpoints', 'costBoundary', 'renderDecision'],
  operations: [
    {
      id: 'governance.lock-production-plan',
      name: '锁定制作计划',
      description: '从现有导演方案生成不可静默换模或换 render runtime 的制作计划。',
      runtime: 'sceneweave',
      entrypoint: 'module:src/lib/skills/vimax-short-drama/vimax-production-plan#buildVimaxProductionPlan',
      cost: 'no-cost',
    },
    {
      id: 'governance.validate-stage-route',
      name: '校验阶段路由',
      description: '进入素材或视频阶段前校验 provider、模型、readiness 和 render 决策。',
      runtime: 'sceneweave',
      entrypoint: 'module:src/lib/skills/vimax-short-drama/vimax-production-plan#assertVimaxProductionPlanForPhase',
      cost: 'no-cost',
    },
  ],
} satisfies CreationCapabilitySkill;
