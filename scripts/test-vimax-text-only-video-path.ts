import assert from 'node:assert/strict';

import {
  buildVimaxProductionPlan,
  parseVimaxProductionPlan,
  requiresVimaxReferenceAssets,
  skipsVimaxReferenceAssets,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';

function buildPlan(referenceAssetsRequired: boolean, videoModel = 'happyhorse-1.1-t2v') {
  return buildVimaxProductionPlan({
    title: '纯文本连续性夹具',
    ratio: '16:9',
    resolution: '720p',
    planModel: 'Kimi-K3',
    imageModel: 'fixture-image',
    videoModel,
    providerReadiness: { plan: true, referenceAssets: false, video: true },
    referenceAssetsRequired,
    assets: [{ kind: 'character', label: '女记者', prompt: '米色风衣，红色录音笔' }],
    shots: [{ index: 1, title: '进入站台', duration: 5, camera: '向右跟拍', prompt: '女记者从左向右走' }],
    workflow: resolveVimaxSkillRuntimeBinding({ skillId: 'short-drama' }),
  });
}

assert.equal(skipsVimaxReferenceAssets(buildPlan(false)), true, 'text-only plan must skip reference assets');
assert.equal(skipsVimaxReferenceAssets(buildPlan(true)), false, 'frame-capable plan must keep reference assets required');
assert.equal(skipsVimaxReferenceAssets(undefined), false, 'missing server plan must fail closed');
assert.equal(requiresVimaxReferenceAssets('happyhorse-dashscope', 'happyhorse-1.1-t2v'), false);
assert.equal(requiresVimaxReferenceAssets('happyhorse-dashscope', 'happyhorse-1.1-i2v'), true);
assert.equal(requiresVimaxReferenceAssets('happyhorse-dashscope', 'happyhorse-1.1-r2v'), true);
assert.equal(requiresVimaxReferenceAssets('ark-video-v3', 'happyhorse-1.1-t2v'), true);

const legacyI2VPlan = parseVimaxProductionPlan(JSON.parse(JSON.stringify(
  buildPlan(false, 'happyhorse-1.1-i2v'),
)));
assert.equal(
  legacyI2VPlan?.checkpoints.find(checkpoint => checkpoint.id === 'reference_assets')?.status,
  'pending',
  'legacy I2V plans must recover the canonical reference stage instead of remaining skipped',
);
assert.equal(skipsVimaxReferenceAssets(legacyI2VPlan), false);

console.log(JSON.stringify({ ok: true, providerCalls: 0, path: 'plan -> video cost confirm -> video' }));
