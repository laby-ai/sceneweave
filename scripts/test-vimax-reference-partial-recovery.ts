import assert from 'node:assert/strict';

import { callVimaxReferenceImages } from '../src/lib/skills/vimax-short-drama/vimax-reference-assets';
import { VIMAX_REFERENCE_CONFIRM_REGEX } from '../src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill';
import { resolveVimaxSkillPresetForRuntime } from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';
import type { VimaxContinuityContract } from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

const originalFetch = globalThis.fetch;
const prompts: string[] = [];
let failSecondShot = true;
let inFlight = 0;
let maxInFlight = 0;

globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  const body = JSON.parse(String(init?.body || '{}')) as { prompt?: string };
  const prompt = String(body.prompt || '');
  prompts.push(prompt);
  try {
    await new Promise(resolve => setTimeout(resolve, 5));
    if (failSecondShot && /镜头身份：Clip 2/.test(prompt)) {
      failSecondShot = false;
      return new Response(JSON.stringify({ error: { code: 'fixture_rejected' } }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: [{ url: `https://fixture.invalid/generated-${prompts.length}.png` }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    inFlight -= 1;
  }
}) as typeof fetch;

const continuity: VimaxContinuityContract = {
  version: 'sceneweave-continuity-contract-v1',
  artifactRevision: 'partial-reference-fixture',
  providerHandoff: {
    mode: 'frame-handoff', provider: 'fixture', model: 'fixture-video',
    supportsFirstFrame: true, supportsReferenceImages: true, locked: true, limitation: 'fixture',
  },
  subjectBible: '林夏，蓝色雨衣。',
  wardrobe: '蓝色雨衣。',
  scene: '雨夜天台。',
  props: ['发光胶片'],
  shots: [
    {
      shotId: 'shot-1', previousShotId: null, dependency: '首镜。',
      actionStart: '林夏站在天台。', actionEnd: '胶片在脚边发光。',
      screenDirection: '从左向右。', framing: '广角全景', lightingPalette: '冷蓝雨夜。',
      audioCue: '雨声。', narrativeCause: '发现异常。',
    },
    {
      shotId: 'shot-2', previousShotId: 'shot-1', dependency: '承接首镜。',
      actionStart: '林夏伸手。', actionEnd: '林夏拾起胶片。',
      screenDirection: '保持从左向右。', framing: '手部特写', lightingPalette: '冷蓝雨夜。',
      audioCue: '电流声。', narrativeCause: '触发线索。',
    },
  ],
};

const input = {
  plan: {
    title: '雨夜胶片',
    summary: '林夏在天台发现发光胶片。',
    assets: [{ kind: 'character' as const, label: '林夏', prompt: '年轻女性，蓝色雨衣' }],
    shots: [
      { index: 1, title: '天台全景', duration: 5, camera: '广角全景', prompt: '林夏站在雨夜天台，胶片在脚边发光' },
      { index: 2, title: '拾起胶片', duration: 5, camera: '手部特写', prompt: '林夏伸手拾起发光胶片' },
    ],
    nextAction: '生成参考图',
  },
  preset: resolveVimaxSkillPresetForRuntime('short-drama'),
  continuity,
  config: {
    imageApiBase: 'https://fixture.invalid/v1',
    imageApiKey: 'fixture-key',
    imageModel: 'fixture-image',
  },
};

async function main() {
  assert.match('仅重试缺失参考图', VIMAX_REFERENCE_CONFIRM_REGEX);
  try {
    const first = await callVimaxReferenceImages(input);
    assert.equal(first.complete, false);
    assert.deepEqual(first.failedShotIndices, [2]);
    assert.deepEqual(first.assets.filter(asset => asset.kind === 'shot').map(asset => asset.shotIndex), [1]);

    const callsAfterFirst = prompts.length;
    const second = await callVimaxReferenceImages({
      ...input,
      existingAssets: first.assets,
      existingSubjectRegistry: first.subjectRegistry,
    });

    assert.equal(second.complete, true);
    assert.deepEqual(second.failedShotIndices, []);
    assert.deepEqual(second.assets.filter(asset => asset.kind === 'shot').map(asset => asset.shotIndex), [1, 2]);
    assert.equal(prompts.length - callsAfterFirst, 1, 'retry must call only the missing shot');
    assert.match(prompts.at(-1) || '', /镜头身份：Clip 2/);
    assert.equal(maxInFlight, 1, 'reference generation must respect single-concurrency BYOK quotas');

    console.log(JSON.stringify({
      ok: true,
      firstFailedShots: first.failedShotIndices,
      retryCalls: prompts.length - callsAfterFirst,
      finalShotCount: second.assets.filter(asset => asset.kind === 'shot').length,
      maxInFlight,
      realProviderCalls: 0,
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
