import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { VimaxProductionPlanCard } from '../src/components/generate/vimax-production-plan-card';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
  confirmVimaxProductionDraft,
  pauseVimaxProduction,
  prepareVimaxProductionDraft,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';

const approved = approveVimaxProductionPlan(buildVimaxProductionPlan({
  title: '品牌短片',
  ratio: '16:9',
  resolution: '1080p',
  planModel: 'plan-model',
  imageModel: 'image-model',
  videoModel: 'video-model',
  providerReadiness: { plan: true, referenceAssets: true, video: false },
  assets: [{ kind: 'reference', label: '主视觉' }],
  shots: [{ index: 1, title: '开场', duration: 5, camera: '推进', prompt: '产品特写' }],
}));
const taskId = 'fixture-execution-card';
const render = (plan: typeof approved) => renderToStaticMarkup(createElement(VimaxProductionPlanCard, { plan, taskId }));

const awaitingCostHtml = render(approved);
assert.match(awaitingCostHtml, /费用与执行方式/);
assert.match(awaitingCostHtml, /继续无成本草稿/);
assert.match(awaitingCostHtml, /真实媒体费用待供应商确认/);

const ready = confirmVimaxProductionDraft(approved);
const readyHtml = render(ready);
assert.match(readyHtml, /暂停流程/);
assert.match(readyHtml, /准备交付草稿/);
assert.match(readyHtml, /不会调用图像或视频模型/);

const pausedHtml = render(pauseVimaxProduction(ready));
assert.match(pausedHtml, /流程已暂停/);
assert.match(pausedHtml, /继续流程/);

const deliveryHtml = render(prepareVimaxProductionDraft(ready));
assert.match(deliveryHtml, /草稿已可交付/);
assert.match(deliveryHtml, /下载制作草稿/);
assert.doesNotMatch(deliveryHtml, /Vimax|ViMAX|SceneWeave|OpenMontage|LibTV/);
const cardSource = readFileSync(new URL('../src/components/generate/vimax-production-plan-card.tsx', import.meta.url), 'utf8');
assert.match(cardSource, /clientApiFetch<ExportResponse>\(exportPath/);
assert.match(cardSource, /headers: requestHeaders/);
assert.doesNotMatch(cardSource, /<a[\s\S]*api\/production\/export/);

console.log(JSON.stringify({ ok: true, script: 'test-vimax-production-execution-card', checks: 15 }));
