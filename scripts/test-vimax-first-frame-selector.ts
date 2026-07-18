import assert from 'node:assert/strict';

import { callVimaxReferenceImages } from '../src/lib/skills/vimax-short-drama/vimax-reference-assets';
import { resolveVimaxSkillPresetForRuntime } from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';
import type { VimaxContinuityContract } from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

const imageRequests: Array<Record<string, unknown>> = [];
const selectorRequests: Array<Record<string, unknown>> = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
  if (url.endsWith('/chat/completions')) {
    selectorRequests.push(body);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            best_image_index: 1,
            reason: '候选2的人物服饰、侧身方向和车站空间关系最一致。',
          }),
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  imageRequests.push(body);
  return new Response(JSON.stringify({
    data: [{ url: `https://fixture.invalid/image-${imageRequests.length}.png` }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const continuity: VimaxContinuityContract = {
  version: 'sceneweave-continuity-contract-v1',
  artifactRevision: 'fixture-first-frame-selector',
  providerHandoff: {
    mode: 'frame-handoff',
    provider: 'fixture',
    model: 'fixture-video',
    supportsFirstFrame: true,
    supportsReferenceImages: true,
    locked: true,
    limitation: 'fixture',
  },
  subjectBible: '林夏，24岁，黑色短发，蓝色雨衣。',
  wardrobe: '蓝色雨衣、黑色长裤、白色运动鞋。',
  scene: '雨夜车站。',
  props: ['红色录音笔'],
  shots: [
    {
      shotId: 'shot-1', previousShotId: null, dependency: '首镜。',
      actionStart: '林夏从画面左侧进入。', actionEnd: '林夏侧身停下。',
      screenDirection: '从左向右。', framing: '中景侧面', lightingPalette: '冷蓝雨夜。',
      audioCue: '雨声。', narrativeCause: '发现异常。',
    },
    {
      shotId: 'shot-2', previousShotId: 'shot-1', dependency: '承接首镜。',
      actionStart: '林夏背对镜头举起录音笔。', actionEnd: '录音笔红灯亮起。',
      screenDirection: '保持从左向右。', framing: '背面近景', lightingPalette: '冷蓝雨夜。',
      audioCue: '电流声。', narrativeCause: '收到回应。',
    },
  ],
};

async function main() {
  try {
    const result = await callVimaxReferenceImages({
      plan: {
        title: '雨夜回声',
        summary: '林夏在雨夜车站收到神秘录音。',
        assets: [
          { kind: 'character', label: '林夏', prompt: '24岁女性，黑色短发，蓝色雨衣，黑色长裤，白色运动鞋' },
          { kind: 'scene', label: '雨夜车站', prompt: '冷蓝雨夜，旧车站站台' },
          { kind: 'prop', label: '红色录音笔', prompt: '红色录音笔，指示灯可见' },
        ],
        shots: [
          { index: 1, title: '侧身停步', duration: 5, camera: '中景侧拍', prompt: '林夏侧身从左向右走入站台并停下' },
          { index: 2, title: '背影回应', duration: 5, camera: '背面近景', prompt: '林夏背对镜头举起红色录音笔' },
        ],
        nextAction: '生成参考素材',
      },
      preset: resolveVimaxSkillPresetForRuntime('short-drama'),
      continuity,
      config: {
        imageApiBase: 'https://fixture.invalid/v1',
        imageApiKey: 'fixture-image-key',
        imageModel: 'fixture-image',
        selectorApiBase: 'https://selector.invalid/v1',
        selectorApiKey: 'fixture-selector-key',
        selectorModel: 'fixture-vlm',
      },
    });

    const shotAssets = result.assets.filter(asset => asset.kind === 'shot') as Array<{
      shotIndex?: number;
      url?: string;
      candidateUrls?: string[];
      selectedCandidateIndex?: number;
      selectionReason?: string;
    }>;
    const firstShot = shotAssets.find(asset => asset.shotIndex === 1);
    const secondShot = shotAssets.find(asset => asset.shotIndex === 2);
    assert.equal(imageRequests.length, 7, 'three portraits + three first-frame candidates + one later shot');
    assert.equal(selectorRequests.length, 1, 'only the first frame should invoke the VLM selector');
    assert.equal(firstShot?.candidateUrls?.length, 3);
    assert.equal(firstShot?.selectedCandidateIndex, 1);
    assert.equal(firstShot?.url, firstShot?.candidateUrls?.[1]);
    assert.match(firstShot?.selectionReason || '', /服饰.*方向.*空间/);
    assert.equal(secondShot?.candidateUrls?.length, 1);
    assert.equal(secondShot?.selectedCandidateIndex, 0);

    console.log(JSON.stringify({
      ok: true,
      path: 'first shot -> three candidates -> VLM consistency selection -> selected artifact',
      imageCalls: imageRequests.length,
      selectorCalls: selectorRequests.length,
      providerCalls: 0,
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
