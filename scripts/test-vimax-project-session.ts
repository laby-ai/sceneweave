import assert from 'node:assert/strict';

import {
  loadMessages,
  saveMessages,
  type ChatMessage,
} from '../src/lib/smart-assistant-panel-model';
import {
  createVimaxRunCoordinator,
  recoverVimaxProjectMessages,
} from '../src/lib/skills/vimax-short-drama/vimax-project-session';

let runSequence = 0;
const coordinator = createVimaxRunCoordinator(() => `run-${++runSequence}`);
const firstRun = coordinator.begin({
  projectId: 'project-a',
  phase: 'plan',
  messageId: 'progress-a',
  timeoutMs: 60_000,
});

assert.equal(coordinator.isCurrent(firstRun), true);

const secondRun = coordinator.begin({
  projectId: 'project-b',
  phase: 'plan',
  messageId: 'progress-b',
  timeoutMs: 60_000,
});

assert.equal(firstRun.signal.aborted, true, 'switching projects must abort the previous request');
assert.equal(coordinator.isCurrent(firstRun), false, 'stale project events must be ignored');
assert.equal(coordinator.isCurrent(secondRun), true);

const cancelled = coordinator.cancel();
assert.equal(cancelled?.messageId, 'progress-b');
assert.equal(secondRun.signal.aborted, true);
assert.equal(coordinator.isCurrent(secondRun), false, 'cancelled events must not update the project');

const incremental: ChatMessage[] = [
  {
    id: 'user-a',
    role: 'user',
    content: '制作一支品牌概念片',
    timestamp: 1,
  },
  {
    id: 'progress-a',
    role: 'assistant',
    content: '正在规划「品牌概念片」… 已生成 3 个镜头',
    timestamp: 2,
    generationStatus: 'generating',
    generationProgress: 62,
    generationStepInfo: {
      step: 'vimax-agent-plan',
      progress: 62,
      totalSteps: 4,
      currentStepLabel: '规划：品牌概念片',
    },
  },
];

const restored = recoverVimaxProjectMessages(incremental);
assert.equal(restored[1]?.generationStatus, 'failed');
assert.equal(restored[1]?.generationProgress, 62, 'refresh must preserve the latest visible stage');
assert.equal(restored[1]?.generationStepInfo?.currentStepLabel, '规划：品牌概念片');
assert.match(restored[1]?.content || '', /刷新|中断/);
assert.deepEqual(restored[1]?.quickOptions, ['重新生成']);

const storageValues = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storageValues.get(key) || null,
    setItem: (key: string, value: string) => { storageValues.set(key, value); },
  },
});
saveMessages(incremental, 'guest-a');
assert.equal(loadMessages('guest-a')?.[1]?.generationProgress, 62, 'same workspace refresh must restore incremental progress');
assert.equal(loadMessages('guest-b'), null, 'another guest workspace must not inherit the project');

const completed: ChatMessage[] = [{
  ...incremental[1],
  generationStatus: 'completed',
  generationProgress: 100,
}];
assert.deepEqual(recoverVimaxProjectMessages(completed), completed, 'completed projects must restore unchanged');

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-project-session',
  checks: 13,
}));
