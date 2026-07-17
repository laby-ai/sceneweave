import assert from 'node:assert/strict';

import type { ChatMessage } from '../src/lib/smart-assistant-panel-model';
import * as deliveryModule from '../src/lib/skills/vimax-short-drama/vimax-result-delivery';

type IterationContext = {
  sourceMessageId: string;
  sourcePrompt: string;
  sourceTitle: string;
  nextAttempt: number;
};

type ResultIterationContract = {
  resolveVimaxResultIteration: (messages: ChatMessage[], sourceMessageId: string) => IterationContext | null;
  buildVimaxContinueEditPrompt: (context: IterationContext) => string;
};

const contract = deliveryModule as unknown as Partial<ResultIterationContract>;
assert.equal(typeof contract.resolveVimaxResultIteration, 'function', 'result iteration resolver must be exported');
assert.equal(typeof contract.buildVimaxContinueEditPrompt, 'function', 'continue-edit prompt builder must be exported');

const messages: ChatMessage[] = [
  { id: 'user-v1', role: 'user', content: '制作一支星际旅行广告，节奏明快', timestamp: 1 },
  {
    id: 'result-v1', role: 'assistant', content: '第一版已完成', timestamp: 2, generationStatus: 'completed',
    vimaxAgent: { phase: 'plan', title: '星际旅行广告', summary: '第一版计划', model: 'fixture', costState: 'not-yet', nextAction: '继续完善' },
  },
  { id: 'user-v2', role: 'user', content: '把结尾改成产品特写', timestamp: 3 },
  {
    id: 'result-v2', role: 'assistant', content: '第二版已完成', timestamp: 4, generationStatus: 'completed',
    vimaxAgent: { phase: 'plan', title: '星际旅行广告第二版', summary: '第二版计划', model: 'fixture', costState: 'not-yet', nextAction: '继续完善' },
  },
];

const resolveIteration = contract.resolveVimaxResultIteration!;
const buildEditPrompt = contract.buildVimaxContinueEditPrompt!;
const first = resolveIteration(messages, 'result-v1');
assert.deepEqual(first, { sourceMessageId: 'result-v1', sourcePrompt: '制作一支星际旅行广告，节奏明快', sourceTitle: '星际旅行广告', nextAttempt: 2 });
assert.equal(resolveIteration(messages, 'missing'), null);
assert.equal(resolveIteration(messages, 'user-v1'), null);
assert.match(buildEditPrompt(first!), /原始需求：制作一支星际旅行广告，节奏明快/);
assert.match(buildEditPrompt(first!), /修改要求：$/);

const frozen = JSON.stringify(messages[1]);
resolveIteration(messages, 'result-v1');
assert.equal(JSON.stringify(messages[1]), frozen, 'resolving an iteration must not mutate the successful source result');

console.log(JSON.stringify({ ok: true, script: 'test-vimax-result-iteration', checks: 9 }));
