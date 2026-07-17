import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { VimaxProductionPlanCard } from '../src/components/generate/vimax-production-plan-card';
import { buildVimaxProductionPlan } from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';

const plan = buildVimaxProductionPlan({
  title: '品牌广告',
  ratio: '16:9',
  resolution: '1080p',
  planModel: VIMAX_PLAN_MODEL,
  imageModel: 'doubao-seedream-5-0-260128',
  videoModel: 'doubao-seedance-1-5-pro-251215',
  providerReadiness: { plan: true, referenceAssets: true, video: false },
  assets: [{ kind: 'character', label: '品牌主角' }],
  shots: [{ index: 1, title: '开场', duration: 5, camera: '推进', prompt: '产品亮相' }],
});

const html = renderToStaticMarkup(createElement(VimaxProductionPlanCard, { plan }));
assert.match(html, /制作计划/);
assert.match(html, /16:9/);
assert.match(html, /1080p/);
assert.match(html, /素材 2 项/);
assert.match(html, /视频服务待就绪/);
assert.match(html, /费用待确认/);
assert.doesNotMatch(html, /Vimax|ViMAX|SceneWeave|OpenMontage/);

console.log(JSON.stringify({ ok: true, script: 'test-vimax-production-plan-card', checks: 7 }));
