import assert from 'node:assert/strict';

import type { ProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import { applyVimaxBridgeTailRevisionForRetry } from '../src/lib/production-segment-retry';
import { evaluateProductionSegmentTransition } from '../src/lib/production-segment-transition';
import {
  evaluateVimaxBridgeTailAcceptance,
  evaluateVimaxBridgeTailHandoffReadiness,
  reviewVimaxBridgeTail,
} from '../src/lib/skills/vimax-short-drama/vimax-bridge-tail-acceptance';

async function main() {
const contract = {
  sourceLastFrameUrl: 'https://example.invalid/roof-tail.jpg',
  observedLastFrameUrl: 'https://example.invalid/bridge-tail.jpg',
  plannedStartState: '主角在雨夜天台握住锈门把手。',
  plannedEndState: '主角已经完全进入放映室，背后锈门即将合上，放映机清晰可见。',
  nextPlannedStartState: '主角站在放映室内部看向启动的放映机。',
  sceneId: 'scene-projection-room',
  actionPhase: '穿过锈门并进入室内',
  anchors: ['深蓝风衣', '发光胶片', '锈门', '放映机'],
};

const rejected = evaluateVimaxBridgeTailAcceptance({
  ...contract,
  review: {
    accepted: false,
    observedEndState: '主角仍站在雨夜天台，锈门和放映机都没有出现。',
    sceneReached: false,
    actionReached: false,
    anchorConsistency: true,
    blockers: ['仍在屋顶', '没有完成穿门动作'],
  },
});
assert.equal(rejected.status, 'rejected');
assert.equal(rejected.canUpdateCanon, false);
assert.equal(rejected.canStartNextSegment, false);
assert.deepEqual(rejected.blockers, ['still-outside-target-scene', 'bridge-action-incomplete']);
assert.match(rejected.revisionInstruction || '', /真实尾态.*雨夜天台/);
assert.match(rejected.revisionInstruction || '', /目标尾态.*放映室/);
assert.match(rejected.revisionInstruction || '', /下一镜.*放映室内部/);
assert.match(rejected.revisionInstruction || '', /深蓝风衣/);
assert.equal(evaluateVimaxBridgeTailHandoffReadiness(rejected).ok, false);

const accepted = evaluateVimaxBridgeTailAcceptance({
  ...contract,
  review: {
    accepted: true,
    observedEndState: '主角已经进入放映室，锈门在身后，放映机位于前方。',
    sceneReached: true,
    actionReached: true,
    anchorConsistency: true,
    blockers: [],
  },
});
assert.equal(accepted.status, 'accepted');
assert.equal(accepted.canUpdateCanon, true);
assert.equal(accepted.canStartNextSegment, true);
assert.equal(accepted.observedEndState.includes('放映室'), true);
assert.equal(accepted.revisionInstruction, null);
assert.equal(evaluateVimaxBridgeTailHandoffReadiness(accepted).ok, true);
assert.equal(evaluateVimaxBridgeTailHandoffReadiness(undefined).ok, false);

const previousTail = 'https://example.invalid/bridge-tail.jpg';
const assemblyPlan = {
  productionProjectId: 'bridge-tail-qa',
  segments: [{
    id: 'segment-bridge',
    index: 0,
    status: 'completed',
    generationRoute: { boundaryIntent: 'bridge' },
    expectedInputs: {},
    expectedOutputs: {
      taskId: 'child-bridge',
      videoUrl: 'https://example.invalid/bridge.mp4',
      lastFrameUrl: previousTail,
      storyStateCue: '主角已经穿过锈门。',
      bridgeTailAcceptance: rejected,
    },
  }, {
    id: 'segment-next',
    index: 1,
    status: 'queued',
    expectedInputs: {
      firstFrameUrl: previousTail,
      previousLastFrameUrl: previousTail,
      sourceSegmentId: 'segment-bridge',
      sourceAssetId: 'video-segment-bridge',
      continuityPrompt: '从放映室内继续。',
      previousStoryStateCue: '主角已经穿过锈门。',
    },
    expectedOutputs: {},
    storySegmentContract: {
      readiness: { blockers: [], warnings: [] },
      audioContract: { requiresAudioContinuity: false },
    },
  }],
} as unknown as ProductionAssemblyPlan;
const blockedTransition = evaluateProductionSegmentTransition(assemblyPlan, 1);
assert.equal(blockedTransition.ok, false);
assert.match(blockedTransition.reason || '', /结尾还未自然进入下一幕/);

const bridgeRetrySegment = applyVimaxBridgeTailRevisionForRetry({
  ...assemblyPlan.segments[0],
  prompt: '原始镜头剧情与动作保持不变。',
  expectedInputs: {
    ...assemblyPlan.segments[0].expectedInputs,
    continuityPrompt: '承接上一镜真实尾帧。',
  },
} as ProductionAssemblyPlan['segments'][number]);
assert.match(bridgeRetrySegment.prompt, /原始镜头剧情与动作保持不变/);
assert.match(bridgeRetrySegment.prompt, /【本次单镜修正】/);
assert.match(bridgeRetrySegment.prompt, /真实尾态.*雨夜天台/);
assert.match(bridgeRetrySegment.expectedInputs.continuityPrompt || '', /目标尾态.*放映室/);
assert.equal(
  bridgeRetrySegment.expectedOutputs.bridgeTailAcceptance,
  undefined,
  'a new attempt must not carry the rejected acceptance as its current result',
);

assemblyPlan.segments[0].expectedOutputs.bridgeTailAcceptance = accepted;
const acceptedTransition = evaluateProductionSegmentTransition(assemblyPlan, 1);
assert.equal(acceptedTransition.ok, true);

let reviewCalls = 0;
const reviewed = await reviewVimaxBridgeTail({
  ...contract,
  connection: {
    provider: 'openai-compatible',
    apiBase: 'https://example.invalid/compatible-mode/v1',
    apiKey: 'fixture-secret-not-logged',
    model: 'fixture-vision-model',
  },
  fetchImpl: async (_url, init) => {
    reviewCalls += 1;
    const body = JSON.parse(String(init?.body || '{}')) as {
      enable_thinking?: boolean;
      messages?: Array<{
        content?: string | Array<{ type?: string; text?: string; image_url?: { url?: string } }>;
      }>;
    };
    assert.equal(body.enable_thinking, false);
    const userContent = Array.isArray(body.messages?.[1]?.content)
      ? body.messages[1].content
      : [];
    const images = userContent.filter(item => item.type === 'image_url');
    const reviewPrompt = userContent
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('\n');
    assert.equal(images.length, 2);
    assert.match(reviewPrompt, /计划结束状态是当前镜头唯一需要完成的目标/);
    assert.match(reviewPrompt, /不得要求当前镜头提前完成下一镜/);
    assert.match(reviewPrompt, /不要求静态尾帧展示动作过程/);
    assert.match(reviewPrompt, /即使下一镜才会启动道具/);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            accepted: false,
            observedEndState: '仍停留在屋顶。',
            sceneReached: false,
            actionReached: false,
            anchorConsistency: true,
            blockers: ['target scene not reached'],
          }),
        },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
assert.equal(reviewCalls, 1);
assert.equal(reviewed.status, 'rejected');
assert.equal(reviewed.canStartNextSegment, false);
assert.doesNotMatch(JSON.stringify(reviewed), /fixture-secret-not-logged/);

const observedBridgeTail = await reviewVimaxBridgeTail({
  ...contract,
  connection: {
    provider: 'openai-compatible',
    apiBase: 'https://example.invalid/compatible-mode/v1',
    apiKey: 'fixture-secret-not-logged',
    model: 'fixture-vision-model',
  },
  fetchImpl: async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          accepted: true,
          observedEndState: '主角已经进入室内，站在半开的门旁，未启动的放映机位于身前。',
          sceneReached: true,
          actionReached: true,
          anchorConsistency: true,
          blockers: [],
        }),
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
assert.equal(
  observedBridgeTail.status,
  'accepted',
  'the current shot must not be rejected because the projector starts in the next shot',
);
assert.equal(observedBridgeTail.canStartNextSegment, true);

let invalidReviewError: unknown;
try {
  await reviewVimaxBridgeTail({
    ...contract,
    connection: {
      provider: 'openai-compatible',
      apiBase: 'https://example.invalid/compatible-mode/v1',
      apiKey: 'fixture-secret-not-logged',
      model: 'fixture-vision-model',
    },
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'not-json' } }],
    }), { status: 200 }),
  });
} catch (error) {
  invalidReviewError = error;
}
assert(invalidReviewError instanceof Error);
assert.match(invalidReviewError.message, /镜头衔接检查没有返回有效结果/);

let privateImageCalls = 0;
let privateImageError: unknown;
try {
  await reviewVimaxBridgeTail({
    ...contract,
    observedLastFrameUrl: '/huiying/api/final-videos/private-tail',
    connection: {
      provider: 'openai-compatible',
      apiBase: 'https://example.invalid/compatible-mode/v1',
      apiKey: 'fixture-secret-not-logged',
      model: 'qwen3.7-plus',
    },
    fetchImpl: async () => {
      privateImageCalls += 1;
      throw new Error('fetch must not run');
    },
  });
} catch (error) {
  privateImageError = error;
}
assert(privateImageError instanceof Error);
assert.match(privateImageError.message, /镜头衔接检查暂时无法读取真实首尾帧/);
assert.equal(privateImageCalls, 0);

console.log(JSON.stringify({
  ok: true,
  providerCalls: 0,
  reviewCalls,
  rejectedBlocksNext: !rejected.canStartNextSegment,
  acceptedUpdatesCanon: accepted.canUpdateCanon,
  observedBridgeTailAcceptsCurrentEnd: observedBridgeTail.canStartNextSegment,
  runtimeTransitionBlocksRejectedTail: !blockedTransition.ok,
  runtimeTransitionAllowsAcceptedTail: acceptedTransition.ok,
  invalidReviewFailsClosed: invalidReviewError instanceof Error,
  privateImageFailsBeforeProvider: privateImageError instanceof Error && privateImageCalls === 0,
}));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
