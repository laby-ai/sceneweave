import assert from 'node:assert/strict';
import { getVideoGenerationRunPlan } from '../src/lib/video-generation-run-plan';
import type { CapabilityReadiness } from '../src/lib/runtime-readiness';

const blockedStorage: CapabilityReadiness = {
  ready: false,
  blockers: [
    'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
    'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
    'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
    'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
  ],
  requirements: [
    {
      name: 'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
      configured: false,
      purpose: 'object storage endpoint for uploading generated assets and extracted tail frames',
    },
    {
      name: 'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
      configured: false,
      purpose: 'object storage bucket for generated assets and extracted tail frames',
    },
    {
      name: 'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
      configured: false,
      purpose: 'object storage upload credential id',
    },
    {
      name: 'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
      configured: false,
      purpose: 'object storage upload credential secret',
    },
  ],
  note: 'blocked for QA',
};

const readyStorage: CapabilityReadiness = {
  ready: true,
  blockers: [],
  requirements: blockedStorage.requirements.map(item => ({
    ...item,
    configured: true,
    configuredVia: item.name,
  })),
  note: 'ready for QA',
};

const readyBase64Handoff: CapabilityReadiness = {
  ready: true,
  blockers: [],
  requirements: [
    {
      name: 'HUIYING_HANDOFF_UPLOAD_CHANNEL',
      configured: true,
      configuredVia: 'base64-data-url',
      purpose: 'base64 fallback for low-cost two-segment handoff proof',
    },
  ],
  note: 'base64 handoff ready for QA',
};

const blockedDurableHandoff: CapabilityReadiness = {
  ready: false,
  blockers: ['HUIYING_DURABLE_HANDOFF_CHANNEL'],
  requirements: [
    {
      name: 'HUIYING_DURABLE_HANDOFF_CHANNEL',
      configured: false,
      purpose: 'object storage or public HTTPS handoff channel required for 60s regression',
    },
  ],
  note: 'durable handoff blocked for QA',
};

const realArkEnv = {
  HUIYING_REAL_ARK_API_KEY: 'ark-redacted-for-qa',
  HUIYING_REAL_ARK_API_BASE: 'https://ark.cn-beijing.volces.com/api/v3',
  HUIYING_REAL_ARK_VIDEO_MODEL: 'doubao-seedance-1-5-pro-251215',
  HUIYING_ALLOW_REAL_VIDEO_COST: 'true',
};

const noKeyPlan = getVideoGenerationRunPlan({
  env: {},
  objectStorage: blockedStorage,
});
assert.equal(noKeyPlan.noCostReadiness.ready, true);
assert.equal(noKeyPlan.singleSegmentSmoke.ready, false);
assert.equal(noKeyPlan.multiSegmentHandoff.ready, false);
assert.equal(noKeyPlan.sixtySecondRegression.ready, false);
assert.equal(noKeyPlan.deliverySample.ready, false);
assert.equal(noKeyPlan.nextAllowedRealTest, 'none');

const smokeOnlyPlan = getVideoGenerationRunPlan({
  env: realArkEnv,
  objectStorage: blockedStorage,
});
assert.equal(smokeOnlyPlan.singleSegmentSmoke.ready, true);
assert.equal(smokeOnlyPlan.multiSegmentHandoff.ready, false);
assert.equal(smokeOnlyPlan.sixtySecondRegression.ready, false);
assert.equal(smokeOnlyPlan.deliverySample.ready, false);
assert.equal(smokeOnlyPlan.nextAllowedRealTest, 'single-segment-smoke');
assert.match(smokeOnlyPlan.conservativeReason || '', /尾帧回传/);

const base64HandoffPlan = getVideoGenerationRunPlan({
  env: realArkEnv,
  objectStorage: blockedStorage,
  handoffUpload: readyBase64Handoff,
  durableHandoff: blockedDurableHandoff,
  recentSingleSegmentSmokePassed: true,
});
assert.equal(base64HandoffPlan.singleSegmentSmoke.ready, true);
assert.equal(base64HandoffPlan.multiSegmentHandoff.ready, true);
assert.equal(base64HandoffPlan.sixtySecondRegression.ready, false);
assert.equal(base64HandoffPlan.deliverySample.ready, false);
assert.equal(base64HandoffPlan.nextAllowedRealTest, 'multi-segment-handoff');

const handoffPlan = getVideoGenerationRunPlan({
  env: realArkEnv,
  objectStorage: readyStorage,
  handoffUpload: readyStorage,
  durableHandoff: readyStorage,
  recentSingleSegmentSmokePassed: true,
});
assert.equal(handoffPlan.singleSegmentSmoke.ready, true);
assert.equal(handoffPlan.multiSegmentHandoff.ready, true);
assert.equal(handoffPlan.sixtySecondRegression.ready, false);
assert.equal(handoffPlan.deliverySample.ready, false);
assert.equal(handoffPlan.nextAllowedRealTest, 'multi-segment-handoff');

const sixtySecondPlan = getVideoGenerationRunPlan({
  env: {
    ...realArkEnv,
    HUIYING_ALLOW_REAL_60S_REGRESSION: 'true',
  },
  objectStorage: readyStorage,
  handoffUpload: readyStorage,
  durableHandoff: readyStorage,
  recentSingleSegmentSmokePassed: true,
  recentHandoffProofPassed: true,
});
assert.equal(sixtySecondPlan.singleSegmentSmoke.ready, true);
assert.equal(sixtySecondPlan.multiSegmentHandoff.ready, true);
assert.equal(sixtySecondPlan.sixtySecondRegression.ready, true);
assert.equal(sixtySecondPlan.deliverySample.ready, false);
assert.equal(sixtySecondPlan.nextAllowedRealTest, 'sixty-second-regression');
assert(sixtySecondPlan.deliverySample.blockers.includes('recentMultitypePayloadProofPassed'));
assert(sixtySecondPlan.deliverySample.blockers.includes('HUIYING_REAL_VIDEO_GENERATE_AUDIO'));
assert(sixtySecondPlan.deliverySample.blockers.includes('HUIYING_ALLOW_DELIVERY_SAMPLE'));
assert(sixtySecondPlan.deliverySample.blockers.includes('HUIYING_ALLOW_SEEDANCE2_DELIVERY_SAMPLE'));
assert(sixtySecondPlan.deliverySample.blockers.includes('HUIYING_REAL_ARK_VIDEO_MODEL=Seedance 2.0'));

const blockedDeliveryModelPlan = getVideoGenerationRunPlan({
  env: {
    ...realArkEnv,
    HUIYING_ALLOW_REAL_60S_REGRESSION: 'true',
    HUIYING_REAL_VIDEO_GENERATE_AUDIO: 'true',
    HUIYING_ALLOW_DELIVERY_SAMPLE: 'true',
    HUIYING_ALLOW_SEEDANCE2_DELIVERY_SAMPLE: 'true',
  },
  objectStorage: readyStorage,
  handoffUpload: readyStorage,
  durableHandoff: readyStorage,
  recentSingleSegmentSmokePassed: true,
  recentHandoffProofPassed: true,
  recentMultitypePayloadProofPassed: true,
});
assert.equal(blockedDeliveryModelPlan.sixtySecondRegression.ready, true);
assert.equal(blockedDeliveryModelPlan.deliverySample.ready, false);
assert.equal(blockedDeliveryModelPlan.nextAllowedRealTest, 'sixty-second-regression');
assert(blockedDeliveryModelPlan.deliverySample.blockers.includes('HUIYING_REAL_ARK_VIDEO_MODEL=Seedance 2.0'));

const deliverySamplePlan = getVideoGenerationRunPlan({
  env: {
    ...realArkEnv,
    HUIYING_REAL_ARK_VIDEO_MODEL: 'doubao-seedance-2-0-260128',
    HUIYING_ALLOW_REAL_60S_REGRESSION: 'true',
    HUIYING_REAL_VIDEO_GENERATE_AUDIO: 'true',
    HUIYING_ALLOW_DELIVERY_SAMPLE: 'true',
    HUIYING_ALLOW_SEEDANCE2_DELIVERY_SAMPLE: 'true',
  },
  objectStorage: readyStorage,
  handoffUpload: readyStorage,
  durableHandoff: readyStorage,
  recentSingleSegmentSmokePassed: true,
  recentHandoffProofPassed: true,
  recentMultitypePayloadProofPassed: true,
});
assert.equal(deliverySamplePlan.singleSegmentSmoke.ready, true);
assert.equal(deliverySamplePlan.multiSegmentHandoff.ready, true);
assert.equal(deliverySamplePlan.sixtySecondRegression.ready, true);
assert.equal(deliverySamplePlan.deliverySample.ready, true);
assert.equal(deliverySamplePlan.nextAllowedRealTest, 'delivery-sample');

const serialized = JSON.stringify(deliverySamplePlan);
assert(!/ark-d8f5|Bearer\s+/i.test(serialized), 'run plan leaked a real-looking secret');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'missing Ark env blocks paid smoke',
    'configured Ark env plus missing storage only allows single-segment smoke',
    'base64 handoff can prove 2 segments but not 60s durable readiness',
    'fresh smoke plus durable handoff allows 2-segment handoff before 60s',
    '60s requires fresh handoff proof and explicit 60s authorization',
    'Seedance 2.0 audio deliverable sample is gated behind model, audio, multi-type proof, and explicit delivery authorization',
  ],
}, null, 2));
