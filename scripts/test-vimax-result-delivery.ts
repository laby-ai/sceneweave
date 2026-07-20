import assert from 'node:assert/strict';
import {
  buildVimaxResultDelivery,
  createVimaxManifestDataUrl,
} from '../src/lib/skills/vimax-short-drama/vimax-result-delivery';
import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';
import { buildVimaxProductionPlan } from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import type { ChatMessage } from '../src/lib/smart-assistant-panel-model';

const productionPlan = buildVimaxProductionPlan({
  title: '品牌短片',
  ratio: '16:9',
  resolution: '1080p',
  planModel: VIMAX_PLAN_MODEL,
  imageModel: 'doubao-seedream-5-0-260128',
  videoModel: 'doubao-seedance-1-5-pro-251215',
  providerReadiness: { plan: true, referenceAssets: true, video: true },
  assets: [{ kind: 'character', label: '主角' }, { kind: 'scene', label: '城市天台' }],
  shots: [
    { index: 1, title: '开场', duration: 5, camera: '推进', prompt: '主角登场' },
    { index: 2, title: '转折', duration: 5, camera: '环绕', prompt: '品牌揭示' },
  ],
});

const planMessage: ChatMessage = {
  id: 'plan-1',
  role: 'assistant',
  content: '计划已完成',
  timestamp: 1,
  generationStatus: 'completed',
  vimaxAgent: {
    phase: 'plan',
    title: '品牌短片',
    summary: '三镜头品牌片',
    model: VIMAX_PLAN_MODEL,
    costState: 'incurred',
    productionPlan,
    nextAction: '生成参考图',
    assets: [
      { kind: 'character', label: '主角', prompt: '人物设定', status: 'planned' },
      { kind: 'scene', label: '城市天台', prompt: '夜景', status: 'planned' },
    ],
    shots: [
      { index: 1, title: '开场', duration: 5, camera: '推进', prompt: '主角登场', status: 'planned' },
      { index: 2, title: '转折', duration: 5, camera: '环绕', prompt: '品牌揭示', status: 'planned' },
    ],
  },
};

const planDelivery = buildVimaxResultDelivery(planMessage);
assert.equal(planDelivery.stages.find(stage => stage.id === 'plan')?.state, 'completed');
assert.equal(planDelivery.stages.find(stage => stage.id === 'storyboard')?.state, 'completed');
assert.equal(planDelivery.stages.find(stage => stage.id === 'reference')?.state, 'pending');
assert.equal(planDelivery.stages.find(stage => stage.id === 'video')?.state, 'pending');
assert.deepEqual(planDelivery.inventory.map(item => item.label), ['主角', '城市天台']);
assert.equal(planDelivery.downloads.length, 0);

const referenceMessage: ChatMessage = {
  ...planMessage,
  id: 'reference-1',
  generationStatus: 'completed',
  generatedImages: [
    { url: 'https://assets.example/shot-1.png', label: '镜头 1' },
    { url: 'https://assets.example/shot-2.webp', label: '镜头 2' },
  ],
  vimaxAgent: {
    ...planMessage.vimaxAgent!,
    phase: 'reference_assets',
    assets: [
      { kind: 'reference', label: '镜头 1', url: 'https://assets.example/shot-1.png', status: 'generated' },
      { kind: 'reference', label: '镜头 2', url: 'https://assets.example/shot-2.webp', status: 'generated' },
    ],
  },
};

const referenceDelivery = buildVimaxResultDelivery(referenceMessage);
assert.equal(referenceDelivery.stages.find(stage => stage.id === 'reference')?.state, 'completed');
assert.deepEqual(referenceDelivery.downloads.map(item => item.filename), ['01-shot-1.png', '02-shot-2.webp']);

const videoMessage: ChatMessage = {
  ...referenceMessage,
  id: 'video-1',
  generatedVideo: { url: 'https://assets.example/final.mp4', duration: 30 },
  vimaxAgent: {
    ...referenceMessage.vimaxAgent!,
    phase: 'video',
    shots: [
      { index: 1, title: '开场', duration: 5, camera: '推进', prompt: '主角登场', videoUrl: 'https://assets.example/clip-1.mp4', status: 'video' },
      { index: 2, title: '转折', duration: 5, camera: '环绕', prompt: '品牌揭示', videoUrl: 'https://assets.example/clip-2.mp4', status: 'video' },
    ],
  },
};

const videoDelivery = buildVimaxResultDelivery(videoMessage);
assert.equal(videoDelivery.stages.find(stage => stage.id === 'video')?.state, 'completed');
assert.deepEqual(videoDelivery.downloads.map(item => item.kind), ['video', 'video', 'video']);
assert.equal(videoDelivery.downloads[0]?.filename, 'final-video.mp4');

const manifestUrl = createVimaxManifestDataUrl(videoMessage);
assert.ok(manifestUrl.startsWith('data:application/json;charset=utf-8,'));
const manifest = JSON.parse(decodeURIComponent(manifestUrl.split(',')[1] || ''));
assert.equal(manifest.schema, 'sceneweave.vimax.delivery.v1');
assert.equal(manifest.project.title, '品牌短片');
assert.deepEqual(manifest.project.productionPlan, productionPlan);
assert.equal(manifest.storyboard.length, 2);
assert.equal(manifest.results.finalVideoUrl, 'https://assets.example/final.mp4');

const failedVideo = buildVimaxResultDelivery({
  ...videoMessage,
  generatedVideo: undefined,
  generationStatus: 'failed',
});
assert.equal(failedVideo.stages.find(stage => stage.id === 'video')?.state, 'failed');
assert.equal(failedVideo.downloads.some(item => item.label === '完整成片'), false);

console.log('vimax result delivery contract: 15 checks passed');
