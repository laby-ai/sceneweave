import type { CapabilityReadiness } from './runtime-readiness';

type EnvLike = Record<string, string | undefined>;

export type VideoGenerationRealTest =
  | 'none'
  | 'single-segment-smoke'
  | 'multi-segment-handoff'
  | 'sixty-second-regression'
  | 'delivery-sample';

export interface VideoGenerationRunRequirement {
  name: string;
  configured: boolean;
  configuredVia?: string;
  purpose: string;
}

export interface VideoGenerationRunStep {
  ready: boolean;
  blockers: string[];
  requirements: VideoGenerationRunRequirement[];
  note: string;
}

export interface VideoGenerationRunPlan {
  noCostReadiness: VideoGenerationRunStep;
  singleSegmentSmoke: VideoGenerationRunStep;
  multiSegmentHandoff: VideoGenerationRunStep;
  sixtySecondRegression: VideoGenerationRunStep;
  deliverySample: VideoGenerationRunStep;
  nextAllowedRealTest: VideoGenerationRealTest;
  conservativeReason?: string;
}

export interface VideoGenerationRunPlanOptions {
  env?: EnvLike;
  objectStorage: CapabilityReadiness;
  handoffUpload?: CapabilityReadiness;
  durableHandoff?: CapabilityReadiness;
  recentSingleSegmentSmokePassed?: boolean;
  recentHandoffProofPassed?: boolean;
  recentMultitypePayloadProofPassed?: boolean;
}

function readEnv(env: EnvLike, name: string) {
  return env[name]?.trim() || undefined;
}

function envRequirement(
  env: EnvLike,
  names: string[],
  purpose: string,
  defaultConfiguredVia?: string
): VideoGenerationRunRequirement {
  for (const name of names) {
    if (readEnv(env, name)) {
      return {
        name: names.join(' | '),
        configured: true,
        configuredVia: name,
        purpose,
      };
    }
  }

  return {
    name: names.join(' | '),
    configured: Boolean(defaultConfiguredVia),
    configuredVia: defaultConfiguredVia,
    purpose,
  };
}

function blockersFrom(requirements: VideoGenerationRunRequirement[]) {
  return requirements
    .filter(item => !item.configured)
    .map(item => item.name);
}

function booleanEnvRequirement(
  env: EnvLike,
  name: string,
  purpose: string
): VideoGenerationRunRequirement {
  const configured = readEnv(env, name) === 'true';
  return {
    name,
    configured,
    configuredVia: configured ? name : undefined,
    purpose,
  };
}

function seedance2ModelRequirement(env: EnvLike): VideoGenerationRunRequirement {
  const model = readEnv(env, 'HUIYING_REAL_ARK_VIDEO_MODEL') || readEnv(env, 'ARK_VIDEO_MODEL');
  const configured = Boolean(model && /seedance[-_]?2|seedance[-_]?2[-_]?0|2\.0/i.test(model));
  return {
    name: 'HUIYING_REAL_ARK_VIDEO_MODEL=Seedance 2.0',
    configured,
    configuredVia: configured ? (readEnv(env, 'HUIYING_REAL_ARK_VIDEO_MODEL') ? 'HUIYING_REAL_ARK_VIDEO_MODEL' : 'ARK_VIDEO_MODEL') : undefined,
    purpose: 'Seedance 2.0 model id for high-cost audio deliverable sample generation',
  };
}

function stepFrom(requirements: VideoGenerationRunRequirement[], readyNote: string, blockedNote: string): VideoGenerationRunStep {
  const blockers = blockersFrom(requirements);
  return {
    ready: blockers.length === 0,
    blockers,
    requirements,
    note: blockers.length === 0 ? readyNote : blockedNote,
  };
}

export function getVideoGenerationRunPlan(options: VideoGenerationRunPlanOptions): VideoGenerationRunPlan {
  const env = options.env || process.env;
  const apiKey = envRequirement(
    env,
    ['HUIYING_REAL_ARK_API_KEY', 'ARK_API_KEY'],
    'Ark BYOK key for real video smoke tests'
  );
  const apiBase = envRequirement(
    env,
    ['HUIYING_REAL_ARK_API_BASE', 'ARK_API_BASE'],
    'Ark API base for real video smoke tests',
    'default:https://ark.cn-beijing.volces.com/api/v3'
  );
  const videoModel = envRequirement(
    env,
    ['HUIYING_REAL_ARK_VIDEO_MODEL', 'ARK_VIDEO_MODEL'],
    'Ark video model id for real video smoke tests'
  );
  const costAllowed: VideoGenerationRunRequirement = {
    name: 'HUIYING_ALLOW_REAL_VIDEO_COST',
    configured: readEnv(env, 'HUIYING_ALLOW_REAL_VIDEO_COST') === 'true',
    configuredVia: readEnv(env, 'HUIYING_ALLOW_REAL_VIDEO_COST') === 'true' ? 'HUIYING_ALLOW_REAL_VIDEO_COST' : undefined,
    purpose: 'explicit operator acknowledgement before any paid real video test',
  };
  const sixtySecondAllowed: VideoGenerationRunRequirement = {
    name: 'HUIYING_ALLOW_REAL_60S_REGRESSION',
    configured: readEnv(env, 'HUIYING_ALLOW_REAL_60S_REGRESSION') === 'true',
    configuredVia: readEnv(env, 'HUIYING_ALLOW_REAL_60S_REGRESSION') === 'true' ? 'HUIYING_ALLOW_REAL_60S_REGRESSION' : undefined,
    purpose: 'extra operator acknowledgement before a paid 60s regression',
  };
  const audioAllowed = booleanEnvRequirement(
    env,
    'HUIYING_REAL_VIDEO_GENERATE_AUDIO',
    'explicit operator acknowledgement that real paid generation should request audio'
  );
  const deliverySampleAllowed = booleanEnvRequirement(
    env,
    'HUIYING_ALLOW_DELIVERY_SAMPLE',
    'explicit operator acknowledgement before generating a deliverable sample'
  );
  const seedance2DeliveryAllowed = booleanEnvRequirement(
    env,
    'HUIYING_ALLOW_SEEDANCE2_DELIVERY_SAMPLE',
    'extra acknowledgement for high-cost Seedance 2.0 deliverable sample generation'
  );
  const seedance2Model = seedance2ModelRequirement(env);
  const recentSmoke: VideoGenerationRunRequirement = {
    name: 'recentSingleSegmentSmokePassed',
    configured: Boolean(options.recentSingleSegmentSmokePassed),
    configuredVia: options.recentSingleSegmentSmokePassed ? 'current-loop-evidence' : undefined,
    purpose: 'fresh 5s smoke evidence from this loop before multi-step escalation',
  };
  const recentHandoff: VideoGenerationRunRequirement = {
    name: 'recentHandoffProofPassed',
    configured: Boolean(options.recentHandoffProofPassed),
    configuredVia: options.recentHandoffProofPassed ? 'current-loop-evidence' : undefined,
    purpose: 'fresh 2-segment handoff evidence before 60s escalation',
  };
  const recentMultitypePayloadProof: VideoGenerationRunRequirement = {
    name: 'recentMultitypePayloadProofPassed',
    configured: Boolean(options.recentMultitypePayloadProofPassed),
    configuredVia: options.recentMultitypePayloadProofPassed ? 'current-loop-evidence' : undefined,
    purpose: 'fresh multi-type story payload proof before spending on a deliverable sample',
  };

  const singleSegmentSmoke = stepFrom(
    [apiKey, apiBase, videoModel, costAllowed],
    '可执行 5s 无声真实 smoke；仍不得直接升级到多段或 60s。',
    '缺少 Ark BYOK、模型或费用授权时，真实 smoke 必须停止。'
  );

  const handoffUpload = options.handoffUpload || options.objectStorage;
  const durableHandoff = options.durableHandoff || options.objectStorage;
  const handoffRequirements = handoffUpload.requirements.map(item => ({
    name: item.name,
    configured: item.configured,
    configuredVia: item.configuredVia,
    purpose: item.purpose,
  }));
  const durableHandoffRequirements = durableHandoff.requirements.map(item => ({
    name: item.name,
    configured: item.configured,
    configuredVia: item.configuredVia,
    purpose: item.purpose,
  }));
  const multiSegmentHandoff = stepFrom(
    [...singleSegmentSmoke.requirements, recentSmoke, ...handoffRequirements],
    '可执行 2 段 lastFrame -> firstFrame handoff 验证。',
    '多段连续性需要先通过 5s smoke，并具备对象存储、公网 HTTPS 或 base64 尾帧回传通道。'
  );
  const sixtySecondRegression = stepFrom(
    [...singleSegmentSmoke.requirements, recentSmoke, recentHandoff, ...durableHandoffRequirements, sixtySecondAllowed],
    '可执行 60s golden case 回归。',
    '60s 回归必须先有 5s smoke、2 段 handoff 证据、对象存储或公网 HTTPS 尾帧通道，以及额外费用授权。'
  );
  const deliverySample = stepFrom(
    [
      ...sixtySecondRegression.requirements,
      recentMultitypePayloadProof,
      audioAllowed,
      deliverySampleAllowed,
      seedance2DeliveryAllowed,
      seedance2Model,
    ],
    '可执行 Seedance 2.0 有声可交付样片；这是高成本阶段，必须记录样片目标与人工复盘。',
    'Seedance 2.0 有声交付样片需要先通过 5s smoke、2 段 handoff、60s 授权、多类型 payload 证明，并显式授权音频和交付样片成本。'
  );

  let nextAllowedRealTest: VideoGenerationRealTest = 'none';
  let conservativeReason: string | undefined = '缺少 Ark BYOK、模型或费用授权。';
  if (singleSegmentSmoke.ready && !handoffUpload.ready) {
    nextAllowedRealTest = 'single-segment-smoke';
    conservativeReason = '尾帧回传通道未 ready，只允许 5s 单段 smoke，不允许多段或 60s。';
  } else if (singleSegmentSmoke.ready && !options.recentSingleSegmentSmokePassed) {
    nextAllowedRealTest = 'single-segment-smoke';
    conservativeReason = '当前 loop 尚无新鲜 5s smoke 证据。';
  } else if (multiSegmentHandoff.ready && !options.recentHandoffProofPassed) {
    nextAllowedRealTest = 'multi-segment-handoff';
    conservativeReason = '已有 smoke 与尾帧回传条件后，下一步应先测 2 段 handoff。';
  } else if (deliverySample.ready) {
    nextAllowedRealTest = 'delivery-sample';
    conservativeReason = undefined;
  } else if (sixtySecondRegression.ready) {
    nextAllowedRealTest = 'sixty-second-regression';
    conservativeReason = undefined;
  } else if (multiSegmentHandoff.ready && !durableHandoff.ready) {
    conservativeReason = '2 段 handoff 已可测，但缺少对象存储或公网 HTTPS 尾帧通道，不应升级 60s。';
  }

  const plan = {
    noCostReadiness: {
      ready: true,
      blockers: [],
      requirements: [],
      note: '可随时执行结构化 readiness、QA、任务状态和媒体复盘，不产生真实视频费用。',
    },
    singleSegmentSmoke,
    multiSegmentHandoff,
    sixtySecondRegression,
    deliverySample,
    nextAllowedRealTest,
  };
  return conservativeReason ? { ...plan, conservativeReason } : plan;
}
