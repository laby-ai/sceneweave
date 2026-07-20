import { extractUserInputEntities } from '../src/lib/storyboard-generator';
import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import {
  buildVimaxContinuityContract,
  resolveVimaxProviderHandoffMode,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prompt = [
  '制作一支30秒短剧，6个5秒镜头。',
  '主角是25岁中国女记者林夏，穿深蓝色风衣。',
  '雨夜废弃老火车站，她始终握着红色录音笔追查一段失踪录音。',
  '画面保持冷蓝色调，动作从站台向右推进。',
].join('');

const entities = extractUserInputEntities(prompt);

assert(entities.subject === '林夏', `expected named protagonist 林夏, got ${entities.subject}`);
assert(entities.objects.includes('红色录音笔'), 'expected 红色录音笔 to be a continuity prop');
assert(!entities.objects.includes('画'), '画面 must not be parsed as the prop 画');
assert(entities.location === '雨夜废弃老火车站', `expected detailed station, got ${entities.location}`);

const built = buildProductionBackedVimaxPlan(prompt, {
  title: '雨夜录音',
  summary: '记者追查失踪录音。',
  assets: [],
  shots: Array.from({ length: 6 }, (_, index) => ({
    index: index + 1,
    title: `镜头${index + 1}`,
    duration: 5,
    camera: '向右推进',
    prompt: `林夏握着红色录音笔推进调查，第${index + 1}镜。`,
  })),
  nextAction: '生成视频',
}, {
  phase: 'plan',
  duration: 30,
  segmentDuration: 5,
  segmentCount: 6,
  ratio: '16:9',
  resolution: '720p',
  sceneType: 'drama',
  style: '冷蓝电影感',
  skillId: 'short-drama',
}, 'fixture-entity-anchors');

const continuity = buildVimaxContinuityContract({
  productionProject: built.productionProject,
  assemblyPlan: built.assemblyPlan,
  providerHandoff: resolveVimaxProviderHandoffMode({
    provider: 'happyhorse-dashscope',
    model: 'happyhorse-1.1-t2v',
  }),
});

assert(continuity.subjectBible.includes('主角=林夏'), 'continuity contract must preserve 林夏');
assert(
  continuity.scene.includes('雨夜废弃老火车站'),
  `continuity contract must preserve the detailed scene, got ${continuity.scene}`,
);
assert(continuity.props.some(prop => prop.includes('红色录音笔')), 'continuity contract must preserve 红色录音笔');
assert(!continuity.props.some(prop => prop.startsWith('画：')), 'continuity contract must not contain the false prop 画');

console.log('vimax chinese entity anchors: ok');
