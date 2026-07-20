import assert from 'node:assert/strict';

import {
  buildVimaxPlanRequest,
  resolveVimaxGenerationSettings,
  VIMAX_PLAN_MODEL,
} from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';
import { DEFAULT_PLANNING_MODEL } from '../src/lib/byok-client';

assert.equal(VIMAX_PLAN_MODEL, 'qwen3.7-plus', 'new creation plans must default to Bailian Qwen 3.7 Plus');
assert.equal(DEFAULT_PLANNING_MODEL, VIMAX_PLAN_MODEL, 'connection UI and runtime must share one planning default');

const settings = resolveVimaxGenerationSettings({
  model: VIMAX_PLAN_MODEL,
  ratio: '9:16',
  quality: '超清',
});

assert.deepEqual(settings, {
  planModel: VIMAX_PLAN_MODEL,
  imageModel: 'wan2.7-image',
  videoModel: 'happyhorse-1.1-r2v',
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
    imageModel: 'wan2.7-image',
    videoModel: 'happyhorse-1.1-r2v',
    ratio: '16:9',
    resolution: '720p',
  },
);

assert.deepEqual(
  resolveVimaxGenerationSettings({ model: 'Qwen3.6-Plus', ratio: '16:9', quality: '高清' }),
  {
    planModel: 'Qwen3.6-Plus',
    imageModel: 'wan2.7-image',
    videoModel: 'happyhorse-1.1-r2v',
    ratio: '16:9',
    resolution: '720p',
  },
  'an explicit model locked by an existing project must not be migrated',
);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-generation-preferences',
  checks: 7,
}));
