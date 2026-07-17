import type { CreationCapabilitySkillId } from '@/lib/skills/creation-capabilities';

export interface VimaxSkillCapabilityComposition {
  presetId: string;
  standard: 'sceneweave-vimax-skill-v1';
  runtime: 'sceneweave';
  executor: 'existing-sceneweave-chain';
  requiredCapabilityIds: CreationCapabilitySkillId[];
  operationOrder: string[];
  readiness: {
    checkBeforeOperationIds: string[];
    requiredKeys: string[];
    missingRequirementPolicy: 'fail-closed';
  };
  costBoundary: {
    promptSubmissionOperationIds: string[];
    confirmBeforeOperationIds: string[];
  };
  failurePolicy: {
    mode: 'fail-closed';
    preserveCompletedOutputs: true;
    retryOperationIds: string[];
  };
  resultDelivery: {
    capabilityId: 'session-delivery';
    operationIds: string[];
  };
}

const MEDIA_CAPABILITY_IDS: CreationCapabilitySkillId[] = [
  'session-delivery',
  'director-artifacts',
  'production-governance',
  'segmented-production',
];

const MEDIA_OPERATION_ORDER = [
  'delivery.manage-tasks',
  'director.plan',
  'governance.lock-production-plan',
  'governance.validate-stage-route',
  'director.reference-assets',
  'segments.plan',
  'segments.queue',
  'director.video',
  'delivery.stream-task-events',
  'segments.retry-failed',
  'segments.export-cut-draft',
  'delivery.download-cut-draft',
];

const STORYBOARD_OPERATION_ORDER = [
  'delivery.manage-tasks',
  'director.plan',
  'governance.lock-production-plan',
  'workbench.load-project-assets',
  'workbench.write-project-asset',
  'workbench.write-storyboard-shot',
  'governance.validate-stage-route',
  'director.reference-assets',
  'delivery.stream-task-events',
  'delivery.download-cut-draft',
];

function createMediaComposition(presetId: string): VimaxSkillCapabilityComposition {
  return {
    presetId,
    standard: 'sceneweave-vimax-skill-v1',
    runtime: 'sceneweave',
    executor: 'existing-sceneweave-chain',
    requiredCapabilityIds: [...MEDIA_CAPABILITY_IDS],
    operationOrder: [...MEDIA_OPERATION_ORDER],
    readiness: {
      checkBeforeOperationIds: ['director.plan', 'director.reference-assets', 'director.video', 'segments.retry-failed'],
      requiredKeys: ['plan-provider', 'reference-assets-provider', 'video-provider'],
      missingRequirementPolicy: 'fail-closed',
    },
    costBoundary: {
      promptSubmissionOperationIds: ['director.plan'],
      confirmBeforeOperationIds: ['director.reference-assets', 'director.video', 'segments.retry-failed'],
    },
    failurePolicy: {
      mode: 'fail-closed',
      preserveCompletedOutputs: true,
      retryOperationIds: ['segments.retry-failed'],
    },
    resultDelivery: {
      capabilityId: 'session-delivery',
      operationIds: ['delivery.stream-task-events', 'segments.export-cut-draft', 'delivery.download-cut-draft'],
    },
  };
}

const storyboardComposition: VimaxSkillCapabilityComposition = {
  presetId: 'storyboard-director',
  standard: 'sceneweave-vimax-skill-v1',
  runtime: 'sceneweave',
  executor: 'existing-sceneweave-chain',
  requiredCapabilityIds: [
    'session-delivery',
    'director-artifacts',
    'production-governance',
    'project-asset-workbench',
  ],
  operationOrder: [...STORYBOARD_OPERATION_ORDER],
  readiness: {
    checkBeforeOperationIds: ['director.plan', 'director.reference-assets'],
    requiredKeys: ['plan-provider', 'reference-assets-provider'],
    missingRequirementPolicy: 'fail-closed',
  },
  costBoundary: {
    promptSubmissionOperationIds: ['director.plan'],
    confirmBeforeOperationIds: ['director.reference-assets'],
  },
  failurePolicy: {
    mode: 'fail-closed',
    preserveCompletedOutputs: true,
    retryOperationIds: ['director.plan'],
  },
  resultDelivery: {
    capabilityId: 'session-delivery',
    operationIds: ['delivery.stream-task-events', 'delivery.download-cut-draft'],
  },
};

export const VIMAX_SKILL_CAPABILITY_COMPOSITIONS: VimaxSkillCapabilityComposition[] = [
  createMediaComposition('short-drama'),
  createMediaComposition('commerce-video'),
  storyboardComposition,
  createMediaComposition('brand-film'),
  createMediaComposition('art-film'),
  createMediaComposition('game-pv'),
];

export function resolveVimaxSkillCapabilityComposition(presetId: string): VimaxSkillCapabilityComposition {
  const composition = VIMAX_SKILL_CAPABILITY_COMPOSITIONS.find(candidate => candidate.presetId === presetId);
  if (!composition) throw new Error(`Unknown creation preset composition: ${presetId}`);
  return composition;
}
