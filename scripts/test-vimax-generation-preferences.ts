import assert from 'node:assert/strict';

import {
  buildVimaxPlanRequest,
  resolveVimaxGenerationSettings,
  VIMAX_PLAN_MODEL,
} from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';

const settings = resolveVimaxGenerationSettings({
  model: VIMAX_PLAN_MODEL,
  ratio: '9:16',
  quality: '超清',
});

assert.deepEqual(settings, {
  planModel: VIMAX_PLAN_MODEL,
  imageModel: 'doubao-seedream-5.0-lite',
  videoModel: 'doubao-seedance-1.5-pro',
  ratio: '9:16',
  resolution: '1080p',
});

assert.deepEqual(
  buildVimaxPlanRequest({
    prompt: '为新品手机制作一支 30 秒竖屏广告',
    duration: 30,
    segmentDuration: 5,
    segmentCount: 6,
    style: '电影感短剧',
    settings,
  }),
  {
    phase: 'plan',
    prompt: '为新品手机制作一支 30 秒竖屏广告',
    duration: 30,
    segmentDuration: 5,
    segmentCount: 6,
    style: '电影感短剧',
    model: VIMAX_PLAN_MODEL,
    ratio: '9:16',
    resolution: '1080p',
    stream: true,
  },
);

assert.deepEqual(
  resolveVimaxGenerationSettings({ model: '', ratio: '2:1', quality: '未知' }),
  {
    planModel: VIMAX_PLAN_MODEL,
    imageModel: 'doubao-seedream-5.0-lite',
    videoModel: 'doubao-seedance-1.5-pro',
    ratio: '16:9',
    resolution: '720p',
  },
);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-generation-preferences',
  checks: 3,
}));
