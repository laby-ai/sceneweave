import assert from 'node:assert/strict';

import {
  buildVimaxContinuityContract,
  resolveVimaxProviderHandoffMode,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';
import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';

const prompt = [
  '制作《全球 AI 态势》宣传片开头 30 秒，16:9，严格 6 个连续 5 秒镜头。',
  '0-10 秒表现模型、Agent、芯片、金融、政策与安全信息过载；',
  '10-22 秒让信息流汇入同一蓝青色数字孪生态势驾驶舱；',
  '22-30 秒呈现事实、影响、区域、可信度、来源的分层结构。',
  '同一空间、同一光色和同一信息流方向，无人物、无文字、无水印。',
].join('');

const basePlan = {
  title: '全球 AI 态势：从混沌到秩序',
  summary: '海量 AI 信号由混沌汇聚为可核验的全球态势结构。',
  assets: [
    {
      kind: 'scene' as const,
      label: '深蓝数字孪生态势驾驶舱',
      prompt: '深蓝数字空间，蓝青色信息流由画面外汇入中央态势核心。',
    },
    {
      kind: 'prop' as const,
      label: '六类 AI 信号',
      prompt: '模型、Agent、芯片、金融、政策、安全六类抽象光点。',
    },
    {
      kind: 'reference' as const,
      label: '全球态势全息投影',
      prompt: '由光点构成的抽象全球连接网络，不含文字。',
    },
  ],
  shots: [
    { index: 1, title: '信息涌入', duration: 5, camera: '广角缓推', prompt: '六类 AI 信号从深色空间四周快速涌入，同向运动，画面逐渐拥挤。' },
    { index: 2, title: '压力叠加', duration: 5, camera: '穿行推进', prompt: '镜头穿过密集信号层，模型、Agent、芯片、金融、政策、安全以抽象视觉形态交错。' },
    { index: 3, title: '开始归拢', duration: 5, camera: '俯视旋转', prompt: '杂乱信号沿统一轨道转向，向同一蓝青色核心收束。' },
    { index: 4, title: '来源汇流', duration: 5, camera: '中景跟随', prompt: '多路来源流在同一驾驶舱空间汇合，形成稳定的全球态势全息投影。' },
    { index: 5, title: '态势驾驶舱', duration: 5, camera: '缓慢拉远', prompt: '镜头拉远展示完整数字孪生态势驾驶舱，信息层级清楚，空间和光色延续前镜。' },
    { index: 6, title: '事实分层', duration: 5, camera: '近景推进', prompt: '事实、影响、区域、可信度、来源化为五层透明结构依次展开，不出现可读文字。' },
  ],
  nextAction: '确认计划后生成六张连续参考图。',
};

const built = buildProductionBackedVimaxPlan(prompt, basePlan, {
  phase: 'plan',
  skillId: 'brand-film',
  sceneType: 'advertisement',
  style: '克制高级品牌片',
  duration: 30,
  segmentDuration: 5,
  segmentCount: 6,
  ratio: '16:9',
  resolution: '720p',
}, 'fixture-global-ai-30s');

assert.equal(built.plan.shots.length, 6);
assert.deepEqual(built.plan.shots.map(shot => shot.duration), [5, 5, 5, 5, 5, 5]);
assert.deepEqual(built.plan.shots.map(shot => shot.title), basePlan.shots.map(shot => shot.title));

const planText = JSON.stringify(built.plan);
assert.match(planText, /数字孪生态势驾驶舱/);
assert.match(planText, /模型、Agent、芯片、金融、政策、安全/);
assert.match(planText, /事实、影响、区域、可信度、来源/);
assert.doesNotMatch(planText, /短剧主角|宁静的水域|水面波光粼粼|浪漫唯美|关键物件「画」/);

assert.equal(
  built.plan.assets.some(asset => asset.kind === 'character'),
  false,
  'a non-narrative plan without an explicit character must not synthesize a character asset',
);
assert.equal(
  built.productionProject.assets.some(asset => asset.kind === 'character'),
  false,
  'the canonical project must not force character continuity for an abstract brand film',
);
assert.deepEqual(
  built.productionProject.storyboard.shots.map(shot => shot.prompt),
  basePlan.shots.map(shot => shot.prompt),
  'the model-authored visible shot semantics must remain authoritative',
);
const continuity = buildVimaxContinuityContract({
  productionProject: built.productionProject,
  assemblyPlan: built.assemblyPlan,
  imageModel: 'qwen-image-2.0-pro',
  providerHandoff: resolveVimaxProviderHandoffMode({
    provider: 'ark-video-v3',
    model: 'happyhorse-1.1-i2v',
  }),
});
const continuityText = JSON.stringify(continuity);
assert.match(continuityText, /深蓝数字孪生态势驾驶舱/);
assert.doesNotMatch(continuityText, /短剧主角|宁静的水域|水面波光粼粼|浪漫唯美|关键物件「画」/);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-non-narrative-plan-semantics',
  shots: built.plan.shots.length,
  providerCalls: 0,
}));
