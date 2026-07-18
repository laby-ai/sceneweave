import assert from 'node:assert/strict';

import { buildProductionAssemblyPlan } from '../src/lib/production-assembly-plan';
import { computeProductionArtifactRevision, freshArtifactReadiness } from '../src/lib/production-artifact-stale';
import { buildProductionProject } from '../src/lib/production-project';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import {
  approveVimaxProductionRender,
  assertVimaxProductionFinalDelivery,
  assertVimaxProductionRenderCheckpoint,
  recordVimaxSuccessfulRender,
} from '../src/lib/skills/vimax-short-drama/vimax-render-delivery-lock';
import { generateShotsFromUserPrompt } from '../src/lib/storyboard-generator';

const prompt = '记者在雨夜车站用红色录音笔记录重逢，制作两个连续镜头。';
const generated = generateShotsFromUserPrompt(prompt, 10, {
  maxShotDuration: 5,
  preferredSceneType: 'drama',
});
const productionProject = buildProductionProject({
  taskId: 'render-lock-fixture',
  prompt,
  duration: 10,
  segmentDuration: 5,
  style: '电影感短剧',
  sceneType: 'drama',
  ratio: '16:9',
  entities: generated.entities,
  visualAnchors: generated.visualAnchors as Array<{ element: string; category: string }>,
  narrativeSummary: generated.narrativeSummary,
  subtitleSuggestion: generated.subtitleSuggestion,
  narrationSuggestion: generated.narrationSuggestion,
  shots: generated.shots.map((shot, index) => ({ ...shot, index: index + 1, status: 'planned' })),
});
const artifactVersion = computeProductionArtifactRevision(productionProject);
const baseAssemblyPlan = buildProductionAssemblyPlan({
  productionProject,
  sourceTaskId: 'render-lock-fixture',
});
const assemblyPlan = {
  ...baseAssemblyPlan,
  status: 'completed' as const,
  segments: baseAssemblyPlan.segments.map((segment, index) => ({
    ...segment,
    status: 'completed' as const,
    artifactReadiness: freshArtifactReadiness(productionProject),
    expectedOutputs: {
      ...segment.expectedOutputs,
      videoUrl: `/generated/videos/segment-${index + 1}.mp4`,
    },
  })),
};
const builtPlan = buildVimaxProductionPlan({
  title: '雨夜车站',
  ratio: '16:9',
  resolution: '1080p',
  planModel: 'fixture-plan',
  imageModel: 'fixture-image',
  videoModel: 'fixture-video',
  providerReadiness: { plan: true, referenceAssets: true, video: true },
  assets: [],
  shots: assemblyPlan.segments.map(segment => ({
    index: segment.index + 1,
    title: `镜头 ${segment.index + 1}`,
    duration: segment.duration,
    camera: '连续运镜',
    prompt: segment.prompt,
  })),
});
const planApproval = approveVimaxProductionPlan(builtPlan);
const plan = {
  ...planApproval,
  governance: { ...planApproval.governance, status: 'ready' as const },
  estimatedCost: {
    ...planApproval.estimatedCost,
    amount: 1,
    status: 'confirmed' as const,
  },
};

assert.throws(
  () => assertVimaxProductionRenderCheckpoint(plan, { productionProject, assemblyPlan }),
  /确认当前版本的成片合成/,
);

const approved = approveVimaxProductionRender(plan, { productionProject, assemblyPlan });
assert.equal(approved.render.checkpointDecision?.artifactVersion, artifactVersion);
assert.equal(
  assertVimaxProductionRenderCheckpoint(approved, { productionProject, assemblyPlan }).render.checkpointDecision?.status,
  'approved',
);

const completed = recordVimaxSuccessfulRender(approved, {
  productionProject,
  assemblyPlan,
  videoUrl: '/generated/videos/final-current.mp4',
  completedAt: '2026-07-18T09:00:00.000Z',
});
assert.equal(completed.render.lastSuccessfulResult?.artifactVersion, artifactVersion);
assert.equal(
  assertVimaxProductionFinalDelivery(completed, {
    productionProject,
    videoUrl: '/generated/videos/final-current.mp4',
  }).render.lastSuccessfulResult?.videoUrl,
  '/generated/videos/final-current.mp4',
);

const editedProject = { ...productionProject, prompt: `${productionProject.prompt} 改为清晨。` };
assert.throws(
  () => assertVimaxProductionFinalDelivery(completed, {
    productionProject: editedProject,
    videoUrl: '/generated/videos/final-current.mp4',
  }),
  /当前项目版本不一致/,
);
assert.throws(
  () => assertVimaxProductionFinalDelivery(completed, {
    productionProject,
    videoUrl: '/generated/videos/final-old.mp4',
  }),
  /最后一次成功成片不一致/,
);

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-render-delivery-lock',
  artifactVersion,
  providerCalls: 0,
}));
