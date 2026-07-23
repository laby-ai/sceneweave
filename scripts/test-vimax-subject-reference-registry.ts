import assert from 'node:assert/strict';

import { callVimaxReferenceImages } from '../src/lib/skills/vimax-short-drama/vimax-reference-assets';
import { buildVimaxPlanMessages } from '../src/lib/skills/vimax-short-drama/vimax-plan-prompt';
import { resolveVimaxSkillPresetForRuntime } from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';
import type { VimaxContinuityContract } from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

const requests: Array<Record<string, unknown>> = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
  requests.push(body);
  const index = requests.length;
  return new Response(JSON.stringify({ data: [{ url: `https://fixture.invalid/image-${index}.png` }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

const continuity: VimaxContinuityContract = {
  version: 'sceneweave-continuity-contract-v1',
  artifactRevision: 'fixture-revision',
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
      shotId: 'shot-1',
      previousShotId: null,
      dependency: '首镜。',
      actionStart: '林夏从画面左侧进入。',
      actionEnd: '林夏侧身停下。',
      screenDirection: '从左向右。',
      framing: '中景侧面',
      lightingPalette: '冷蓝雨夜。',
      audioCue: '雨声。',
      narrativeCause: '发现异常。',
    },
    {
      shotId: 'shot-2',
      previousShotId: 'shot-1',
      dependency: '承接首镜。',
      actionStart: '林夏背对镜头举起录音笔。',
      actionEnd: '录音笔红灯亮起。',
      screenDirection: '保持从左向右。',
      framing: '背面近景',
      lightingPalette: '冷蓝雨夜。',
      audioCue: '电流声。',
      narrativeCause: '收到回应。',
    },
  ],
};

async function main() {
try {
  const preset = resolveVimaxSkillPresetForRuntime('short-drama');
  const planningSystemPrompt = buildVimaxPlanMessages('20秒，4个5秒分镜。', preset)[0].content;
  assert.match(planningSystemPrompt, /每个 shots\[i\]\.prompt 只描述该镜头单帧/);
  assert.match(planningSystemPrompt, /不得重复总时长、clip 数量、每段时长/);
  const result = await callVimaxReferenceImages({
    plan: {
      title: '雨夜回声',
      summary: '林夏在雨夜车站收到神秘录音。',
      assets: [
        { kind: 'character', label: '林夏', prompt: '24岁女性，黑色短发，蓝色雨衣，黑色长裤，白色运动鞋' },
        { kind: 'scene', label: '雨夜车站', prompt: '【制作要求】20秒，4个5秒分镜。冷蓝雨夜，旧车站站台' },
        { kind: 'prop', label: '红色录音笔', prompt: '红色录音笔，指示灯可见' },
      ],
      shots: [
        { index: 1, title: '侧身停步', duration: 5, camera: '中景侧拍', prompt: '【短剧前提】雨夜车站，20秒，4个5秒分镜，无文字无水印，画面连续。林夏侧身从左向右走入站台并停下' },
        { index: 2, title: '背影回应', duration: 5, camera: '背面近景', prompt: '【短剧前提】雨夜车站，20秒，4个5秒分镜，无文字无水印，画面连续。林夏背对镜头举起红色录音笔' },
      ],
      nextAction: '生成参考素材',
    },
    preset,
    continuity,
    config: {
      imageApiBase: 'https://fixture.invalid/v1',
      imageApiKey: 'fixture-key',
      imageModel: 'fixture-image',
    },
  });

  assert.equal(result.subjectRegistry.version, 'sceneweave-subject-reference-registry-v1');
  assert.equal(result.subjectRegistry.subjects.length, 1);
  assert.deepEqual(
    result.subjectRegistry.subjects[0].views.map(view => view.view),
    ['front', 'side', 'back'],
  );
  assert.equal(requests.length, 5, 'one character should create three portraits before two shot references');
  assert.deepEqual(requests[1].reference_images, ['https://fixture.invalid/image-1.png']);
  assert.deepEqual(requests[2].reference_images, ['https://fixture.invalid/image-1.png']);
  assert.deepEqual(
    requests[3].reference_images,
    ['https://fixture.invalid/image-2.png'],
    'shot generation must preserve the selected side-view identity anchor',
  );
  assert.deepEqual(
    requests[4].reference_images,
    ['https://fixture.invalid/image-3.png'],
    'shot generation must preserve the selected back-view identity anchor',
  );

  const firstShotPrompt = String(requests[3].prompt || '');
  const secondShotPrompt = String(requests[4].prompt || '');
  assert.match(firstShotPrompt, /侧身停步/);
  assert.match(firstShotPrompt, /中景侧拍/);
  assert.match(secondShotPrompt, /背影回应/);
  assert.match(secondShotPrompt, /背面近景/);
  assert.match(firstShotPrompt, /单张独立的16:9电影画面/);
  assert.match(secondShotPrompt, /不是分镜板、拼贴、四宫格或多面板/);
  assert.doesNotMatch(firstShotPrompt, /20秒|4个5秒分镜/);
  assert.doesNotMatch(secondShotPrompt, /20秒|4个5秒分镜/);

  const shotAssets = result.assets.filter(asset => asset.kind === 'shot');
  assert.deepEqual(shotAssets.map(asset => (
    'selectedSubjectViews' in asset ? asset.selectedSubjectViews?.[0]?.view : undefined
  )), ['side', 'back']);
  assert.deepEqual(shotAssets.map(asset => ('shotIndex' in asset ? asset.shotIndex : undefined)), [1, 2]);

  console.log(JSON.stringify({
    ok: true,
    requestCount: requests.length,
    subjectCount: result.subjectRegistry.subjects.length,
    selectedViews: shotAssets.map(asset => (
      'selectedSubjectViews' in asset ? asset.selectedSubjectViews?.[0]?.view : undefined
    )),
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
