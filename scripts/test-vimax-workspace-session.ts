import assert from 'node:assert/strict';

import {
  buildVimaxTaskUrl,
  isVimaxExecutionReady,
  latestVimaxTaskId,
  resolveVimaxTaskId,
  shouldClearCachedVimaxProject,
  shouldShowVimaxQuickOption,
} from '../src/lib/skills/vimax-short-drama/vimax-workspace-session';

const readyPlan = {
  governance: { status: 'ready' },
  estimatedCost: { status: 'confirmed' },
} as Parameters<typeof isVimaxExecutionReady>[0];
const pendingPlan = {
  governance: { status: 'awaiting-plan-approval' },
  estimatedCost: { status: 'provider-confirmation-required' },
} as Parameters<typeof isVimaxExecutionReady>[0];

assert.equal(buildVimaxTaskUrl('https://airai.world/huiying/embed/creation-agent?taskId=old&embed=1', 'new'), '/huiying/embed/creation-agent?taskId=new&embed=1');
assert.equal(buildVimaxTaskUrl('https://airai.world/huiying/embed/creation-agent?taskId=old&embed=1'), '/huiying/embed/creation-agent?embed=1');
assert.equal(latestVimaxTaskId([
  { id: 'old', role: 'assistant', content: '', timestamp: 1, vimaxAgent: { phase: 'plan', title: '', summary: '', model: '', costState: 'not-yet', nextAction: '', taskId: 'old' } },
  { id: 'new', role: 'assistant', content: '', timestamp: 2, vimaxAgent: { phase: 'plan', title: '', summary: '', model: '', costState: 'not-yet', nextAction: '', taskId: 'new' } },
]), 'new');
const cachedMessages = [
  { id: 'cached', role: 'assistant', content: '', timestamp: 1, vimaxAgent: { phase: 'video', title: '', summary: '', model: '', costState: 'incurred', nextAction: '', taskId: 'cached-complete' } },
] as Parameters<typeof resolveVimaxTaskId>[0];
assert.equal(resolveVimaxTaskId(cachedMessages, 'deep-link-active'), 'deep-link-active');
assert.equal(resolveVimaxTaskId(cachedMessages, 'deep-link-active', true), 'cached-complete');
assert.equal(
  resolveVimaxTaskId([], 'deep-link-active', true),
  undefined,
  'explicitly selecting a draft project must not restore the previous deep-link task',
);
assert.equal(shouldClearCachedVimaxProject(cachedMessages, 'deep-link-active', 'deep-link-active'), true);
assert.equal(shouldClearCachedVimaxProject(cachedMessages, 'cached-complete', 'cached-complete'), false);
assert.equal(isVimaxExecutionReady(pendingPlan), false);
assert.equal(isVimaxExecutionReady(readyPlan), true);
assert.equal(shouldShowVimaxQuickOption('确认分镜，生成参考图', pendingPlan), false);
assert.equal(shouldShowVimaxQuickOption('确认分镜，生成参考图', readyPlan), true);
assert.equal(shouldShowVimaxQuickOption('调整分镜', pendingPlan), true);

console.log('PASS vimax workspace task routing and execution gate');
