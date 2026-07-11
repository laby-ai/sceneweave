const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5000';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const response = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
  assert(response.ok, `/api/health returned HTTP ${response.status}`);
  const payload = await response.json();
  const readiness = payload.runtimeReadiness;

  assert(readiness, 'runtimeReadiness missing from /api/health');
  assert(readiness.objectStorage, 'objectStorage readiness missing');
  assert(readiness.publicFrameHandoff, 'publicFrameHandoff readiness missing');
  assert(readiness.base64FrameHandoff, 'base64FrameHandoff readiness missing');
  assert(readiness.handoffUpload, 'handoffUpload readiness missing');
  assert(readiness.durableHandoff, 'durableHandoff readiness missing');
  assert(readiness.realSegmentHandoff, 'realSegmentHandoff readiness missing');
  assert(readiness.videoGenerationRunPlan, 'videoGenerationRunPlan readiness missing');
  assert(readiness.subjectStore, 'subjectStore readiness missing');
  assert(Array.isArray(readiness.objectStorage.requirements), 'objectStorage requirements should be array');
  assert(readiness.videoGenerationRunPlan.noCostReadiness?.ready === true, 'no-cost readiness should always be available');
  assert(
    ['none', 'single-segment-smoke', 'multi-segment-handoff', 'sixty-second-regression', 'delivery-sample'].includes(
      readiness.videoGenerationRunPlan.nextAllowedRealTest
    ),
    `unexpected nextAllowedRealTest: ${readiness.videoGenerationRunPlan.nextAllowedRealTest}`
  );

  const requirementNames = readiness.objectStorage.requirements.map(item => item.name);
  for (const required of [
    'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
    'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
    'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
    'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
  ]) {
    assert(requirementNames.includes(required), `${required} missing from readiness requirements`);
  }

  const serialized = JSON.stringify(payload);
  assert(!/ark-[0-9a-fA-F-]{20,}/.test(serialized), 'health payload leaked an Ark key-like token');
  assert(!/Bearer\s+[A-Za-z0-9._-]+/.test(serialized), 'health payload leaked a bearer token');

  console.log(JSON.stringify({
    ok: true,
    objectStorageReady: readiness.objectStorage.ready,
    publicFrameHandoffReady: readiness.publicFrameHandoff.ready,
    base64FrameHandoffReady: readiness.base64FrameHandoff.ready,
    handoffUploadReady: readiness.handoffUpload.ready,
    durableHandoffReady: readiness.durableHandoff.ready,
    handoffReady: readiness.realSegmentHandoff.ready,
    nextAllowedRealTest: readiness.videoGenerationRunPlan.nextAllowedRealTest,
    subjectStoreReady: readiness.subjectStore.ready,
    blockers: readiness.realSegmentHandoff.blockers,
    requirementCount: readiness.objectStorage.requirements.length,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
