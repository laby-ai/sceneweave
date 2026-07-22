import assert from 'node:assert/strict';

import type { ProductionSegmentPlan } from '../src/lib/production-assembly-plan';
import {
  buildVimaxCanonicalFirstFrameSpec,
  compileVimaxCanonicalFirstFrame,
  evaluateVimaxCanonicalFirstFrameReadiness,
} from '../src/lib/skills/vimax-short-drama/vimax-canonical-first-frame';

const segment = {
  index: 1,
  shotId: 'shot-2',
  dependencies: {
    characterAssetIds: ['character-red-hood'],
    sceneAssetIds: ['scene-forest'],
    propAssetIds: ['prop-lantern'],
  },
  expectedInputs: {
    previousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
  },
  shotFrameContract: {
    firstFrame: { description: '小红帽从画面左侧向右跑入森林深处。' },
    motionDescription: '保持向右运动，抬起灯笼照向钟楼。',
    handoff: { entryContinuity: '承接上一镜跑动终态。' },
    visualStoryEvidence: { conflictEvidence: '远处钟楼灯光熄灭。' },
  },
} as unknown as ProductionSegmentPlan;

const spec = buildVimaxCanonicalFirstFrameSpec({
  segment,
  artifactVersion: 'rev-test-2',
  referenceAssets: [
    {
      kind: 'shot',
      shotIndex: 2,
      url: 'https://example.invalid/shot-2-approved.jpg',
      selectedSubjectViews: [{
        subjectId: 'red-hood',
        label: '小红帽',
        view: 'side',
        viewId: 'red-hood-side-v3',
        url: 'https://example.invalid/red-hood-side-v3.jpg',
      }],
    },
  ],
});

assert.deepEqual(spec.referenceImages, [
  'https://example.invalid/shot-1-tail.jpg',
  'https://example.invalid/shot-2-approved.jpg',
  'https://example.invalid/red-hood-side-v3.jpg',
]);
assert.equal(spec.firstFrameImage, 'https://example.invalid/shot-1-tail.jpg');
assert.equal(spec.strategy, 'direct-previous-tail');
assert.equal(spec.sourcePreviousLastFrameUrl, 'https://example.invalid/shot-1-tail.jpg');
assert.equal(spec.artifactVersion, 'rev-test-2');
assert.match(spec.prompt, /向右/);
assert.match(spec.prompt, /批准版本/);

assert.deepEqual(evaluateVimaxCanonicalFirstFrameReadiness({
  state: {
    version: 'sceneweave-canonical-first-frame-v1',
    status: 'ready',
    artifactVersion: 'rev-test-2',
    imageUrl: 'https://example.invalid/shot-1-tail.jpg',
    sourcePreviousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
    sourceReferenceUrls: spec.referenceImages,
  },
  artifactVersion: 'rev-test-2',
  requiresPreviousLastFrame: true,
  previousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
}), { ok: true, imageUrl: 'https://example.invalid/shot-1-tail.jpg' });

const regeneratedFrame = evaluateVimaxCanonicalFirstFrameReadiness({
  state: {
    version: 'sceneweave-canonical-first-frame-v1',
    status: 'ready',
    artifactVersion: 'rev-test-2',
    imageUrl: 'https://example.invalid/compiled-shot-2.jpg',
    sourcePreviousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
    sourceReferenceUrls: spec.referenceImages,
  },
  artifactVersion: 'rev-test-2',
  requiresPreviousLastFrame: true,
  previousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
});
assert.deepEqual(regeneratedFrame, { ok: false, code: 'canonical-first-frame-not-direct-tail' });

const stale = evaluateVimaxCanonicalFirstFrameReadiness({
  state: {
    version: 'sceneweave-canonical-first-frame-v1',
    status: 'ready',
    artifactVersion: 'rev-old',
    imageUrl: 'https://example.invalid/compiled-shot-2.jpg',
    sourcePreviousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
    sourceReferenceUrls: spec.referenceImages,
  },
  artifactVersion: 'rev-test-2',
  requiresPreviousLastFrame: true,
  previousLastFrameUrl: 'https://example.invalid/shot-1-tail.jpg',
});
assert.equal(stale.ok, false);
assert.equal(stale.code, 'canonical-first-frame-stale');

const missingTail = buildVimaxCanonicalFirstFrameSpec({
  segment: {
    ...segment,
    expectedInputs: { ...segment.expectedInputs, previousLastFrameUrl: null },
  },
  artifactVersion: 'rev-test-2',
  referenceAssets: [],
});
assert.equal(missingTail.ready, false);
assert.ok(missingTail.blockers.includes('previous-tail-missing'));

const originalFetch = global.fetch;
void (async () => {
  let imageProviderCalls = 0;
  global.fetch = (async () => {
    imageProviderCalls += 1;
    throw new Error('canonical first-frame resolution must not call an image provider');
  }) as typeof fetch;
  const compiled = await compileVimaxCanonicalFirstFrame({
    segment,
    artifactVersion: 'rev-test-2',
    referenceAssets: [{
      kind: 'shot',
      shotIndex: 2,
      url: 'https://example.invalid/shot-2-approved.jpg',
      selectedSubjectViews: [{
        subjectId: 'red-hood', label: '小红帽', view: 'side', viewId: 'red-hood-side-v3',
        url: 'https://example.invalid/red-hood-side-v3.jpg',
      }],
    }],
    continuityPrompt: '角色与服饰批准版本 v3，保持从左向右。',
  });
  assert.equal(compiled.imageUrl, 'https://example.invalid/shot-1-tail.jpg');
  assert.deepEqual(compiled.sourceReferenceUrls, ['https://example.invalid/shot-1-tail.jpg']);
  assert.equal(imageProviderCalls, 0);

  const openingSegment = {
    ...segment,
    index: 0,
    expectedInputs: { ...segment.expectedInputs, previousLastFrameUrl: null },
    generationRoute: { requiresPreviousLastFrame: false },
  } as unknown as ProductionSegmentPlan;
  const opening = await compileVimaxCanonicalFirstFrame({
    segment: openingSegment,
    artifactVersion: 'rev-test-2',
    referenceAssets: [{
      kind: 'shot',
      shotIndex: 1,
      url: 'https://example.invalid/shot-1-approved.jpg',
    }],
  });
  assert.equal(opening.imageUrl, 'https://example.invalid/shot-1-approved.jpg');
  assert.deepEqual(opening.sourceReferenceUrls, ['https://example.invalid/shot-1-approved.jpg']);
  assert.equal(imageProviderCalls, 0);

  const fourShotFirstFrames = await Promise.all([
    openingSegment,
    ...[1, 2, 3].map(index => ({
      ...segment,
      index,
      expectedInputs: {
        ...segment.expectedInputs,
        previousLastFrameUrl: `https://example.invalid/shot-${index}-tail.jpg`,
      },
      generationRoute: { requiresPreviousLastFrame: true },
    } as unknown as ProductionSegmentPlan)),
  ].map((currentSegment, index) => compileVimaxCanonicalFirstFrame({
    segment: currentSegment,
    artifactVersion: 'rev-four-shot-chain',
    referenceAssets: [{
      kind: 'shot',
      shotIndex: index + 1,
      url: `https://example.invalid/shot-${index + 1}-approved.jpg`,
    }],
  })));
  assert.deepEqual(fourShotFirstFrames.map(frame => frame.imageUrl), [
    'https://example.invalid/shot-1-approved.jpg',
    'https://example.invalid/shot-1-tail.jpg',
    'https://example.invalid/shot-2-tail.jpg',
    'https://example.invalid/shot-3-tail.jpg',
  ]);
  assert.equal(imageProviderCalls, 0);

  let blockedProviderCalls = 0;
  global.fetch = (async () => {
    blockedProviderCalls += 1;
    throw new Error('provider must not be called');
  }) as typeof fetch;
  await assert.rejects(() => compileVimaxCanonicalFirstFrame({
    segment: {
      ...segment,
      expectedInputs: { ...segment.expectedInputs, previousLastFrameUrl: null },
    },
    artifactVersion: 'rev-test-2',
    referenceAssets: [],
  }), /权威首帧素材未就绪/);
  global.fetch = originalFetch;
  assert.equal(blockedProviderCalls, 0, 'missing canonical inputs must fail before image or video provider submission');

  console.log(JSON.stringify({
    ok: true,
    imageProviderCalls,
    blockedProviderCalls,
    videoProviderCalls: 0,
    incurredCost: false,
    route: 'direct-tail-frame-to-i2v',
    fourShotChain: fourShotFirstFrames.map(frame => frame.imageUrl),
  }));
})().catch(error => {
  global.fetch = originalFetch;
  console.error(error);
  process.exitCode = 1;
});
