import assert from 'node:assert/strict';

import type { ChatMessage } from '../src/lib/smart-assistant-panel-model';
import * as deliveryModule from '../src/lib/skills/vimax-short-drama/vimax-result-delivery';
import { buildVimaxProductionPlan } from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';

type IterationContext = {
  sourceMessageId: string;
  sourcePrompt: string;
  sourceTitle: string;
  nextAttempt: number;
  presetId: string;
};

type ResultIterationContract = {
  resolveVimaxResultIteration: (messages: ChatMessage[], sourceMessageId: string) => IterationContext | null;
  resolveVimaxProjectPresetId: (messages: ChatMessage[]) => string | null;
  buildVimaxContinueEditPrompt: (context: IterationContext) => string;
};

const contract = deliveryModule as unknown as Partial<ResultIterationContract>;
assert.equal(typeof contract.resolveVimaxResultIteration, 'function', 'result iteration resolver must be exported');
assert.equal(typeof contract.resolveVimaxProjectPresetId, 'function', 'project preset resolver must be exported');
assert.equal(typeof contract.buildVimaxContinueEditPrompt, 'function', 'continue-edit prompt builder must be exported');

const commercePlan = buildVimaxProductionPlan({
  title: '星际旅行商品片',
  ratio: '16:9',
  resolution: '1080p',
  planModel: 'fixture-plan',
  imageModel: 'fixture-image',
  videoModel: 'fixture-video',
  providerReadiness: { plan: true, referenceAssets: false, video: false },
  assets: [],
  shots: [],
  workflow: resolveVimaxSkillRuntimeBinding({ skillId: 'commerce-video' }),
});

const forgedBrandPlan = buildVimaxProductionPlan({
  title: '迟到的品牌任务',
  ratio: '16:9',
  resolution: '1080p',
  planModel: 'fixture-plan',
  imageModel: 'fixture-image',
  videoModel: 'fixture-video',
  providerReadiness: { plan: true, referenceAssets: false, video: false },
  assets: [],
  shots: [],
  workflow: resolveVimaxSkillRuntimeBinding({ skillId: 'brand-film' }),
});

const messages: ChatMessage[] = [
  { id: 'user-v1', role: 'user', content: '制作一支星际旅行广告，节奏明快', timestamp: 1 },
  {
    id: 'result-v1', role: 'assistant', content: '第一版已完成', timestamp: 2, generationStatus: 'completed',
    vimaxAgent: { phase: 'plan', title: '星际旅行广告', summary: '第一版计划', model: 'fixture', costState: 'not-yet', nextAction: '继续完善', productionPlan: commercePlan },
  },
  { id: 'user-v2', role: 'user', content: '把结尾改成产品特写', timestamp: 3 },
  {
    id: 'result-v2', role: 'assistant', content: '第二版已完成', timestamp: 4, generationStatus: 'completed',
    vimaxAgent: { phase: 'plan', title: '星际旅行广告第二版', summary: '第二版计划', model: 'fixture', costState: 'not-yet', nextAction: '继续完善', productionPlan: commercePlan },
  },
  {
    id: 'late-brand', role: 'assistant', content: '迟到失败', timestamp: 5, generationStatus: 'failed',
    vimaxAgent: { phase: 'plan', title: '不应覆盖', summary: '失败记录', model: 'fixture', costState: 'blocked', nextAction: '重试', productionPlan: forgedBrandPlan },
  },
];

const resolveIteration = contract.resolveVimaxResultIteration!;
const resolveProjectPreset = contract.resolveVimaxProjectPresetId!;
const buildEditPrompt = contract.buildVimaxContinueEditPrompt!;
const first = resolveIteration(messages, 'result-v1');
assert.deepEqual(first, { sourceMessageId: 'result-v1', sourcePrompt: '制作一支星际旅行广告，节奏明快', sourceTitle: '星际旅行广告', nextAttempt: 2, presetId: 'commerce-video' });
assert.equal(resolveProjectPreset(messages), 'commerce-video', 'failed or stale results must not replace the last successful project preset');
const brandMessages: ChatMessage[] = [
  { id: 'brand-user', role: 'user', content: '制作一支克制的品牌片', timestamp: 1 },
  {
    id: 'brand-result', role: 'assistant', content: '品牌方案已完成', timestamp: 2, generationStatus: 'completed',
    vimaxAgent: { phase: 'plan', title: '品牌概念片', summary: '品牌方案', model: 'fixture', costState: 'not-yet', nextAction: '继续完善', productionPlan: forgedBrandPlan },
  },
];
assert.equal(resolveProjectPreset(brandMessages), 'brand-film');
assert.equal(resolveProjectPreset(messages), 'commerce-video', 'resolving another project must not mutate the first project preset');
assert.equal(resolveIteration(messages, 'missing'), null);
assert.equal(resolveIteration(messages, 'user-v1'), null);
assert.match(buildEditPrompt(first!), /原始需求：制作一支星际旅行广告，节奏明快/);
assert.match(buildEditPrompt(first!), /修改要求：$/);

const frozen = JSON.stringify(messages[1]);
resolveIteration(messages, 'result-v1');
assert.equal(JSON.stringify(messages[1]), frozen, 'resolving an iteration must not mutate the successful source result');

console.log(JSON.stringify({ ok: true, script: 'test-vimax-result-iteration', checks: 13 }));
