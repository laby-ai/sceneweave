import assert from 'node:assert/strict';

import type { BackgroundTask } from '../src/lib/task-manager';
import { runVimaxReferenceAssetsPhase } from '../src/lib/skills/vimax-short-drama/vimax-reference-phase';

const task = {
  id: 'fixture-reference-phase',
  type: 'video',
  status: 'completed',
  config: {},
  progress: 100,
  result: {},
  createdAt: Date.now(),
} as BackgroundTask;

async function main() {
  await assert.rejects(
    runVimaxReferenceAssetsPhase({
      task,
      plan: {} as never,
      productionPlan: {} as never,
      config: {
        textModel: 'fixture-plan-model',
        imageModel: 'fixture-image-model',
        videoModel: 'fixture-video-model',
        imageApiKey: '',
        imageApiBase: 'https://fixture.invalid/image',
        selectorApiKey: '',
        selectorApiBase: 'https://fixture.invalid/selector',
      },
    }),
    /制作运行时与已确认计划不一致/,
  );

  console.log('PASS reference phase rejects an invalid plan before provider access');
}

void main();
