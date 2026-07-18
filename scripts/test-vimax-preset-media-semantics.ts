import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { VIMAX_PLAN_MODEL } from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';
import {
  approveVimaxProductionPlan,
  buildVimaxProductionPlan,
  type VimaxProductionPlan,
} from '../src/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '../src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';
import { resolveVimaxSkillPresetForRuntime } from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-media-semantics-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.ARK_IMAGE_API_KEY = 'fixture-image-key';

const imagePrompts: string[] = [];
const videoPrompts: string[] = [];
let unexpectedNetworkCalls = 0;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/images/generations')) {
    const body = JSON.parse(String(init?.body || '{}')) as { prompt?: string };
    imagePrompts.push(body.prompt || '');
    return new Response(JSON.stringify({ data: [{ url: 'https://fixture.invalid/reference.png' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.endsWith('/contents/generations/tasks') && init?.method === 'POST') {
    const body = JSON.parse(String(init.body || '{}')) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    videoPrompts.push(body.content?.find(item => item.type === 'text')?.text || '');
    return new Response(JSON.stringify({ id: 'fixture-video-task' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.endsWith('/contents/generations/tasks/fixture-video-task')) {
    return new Response(JSON.stringify({
      status: 'succeeded',
      content: {
        video_url: 'https://fixture.invalid/final.mp4',
        last_frame_url: 'https://fixture.invalid/last-frame.png',
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  unexpectedNetworkCalls += 1;
  throw new Error(`Unexpected network call: ${url}`);
};

function buildReadyPlan(presetId: string): VimaxProductionPlan {
  const base = buildVimaxProductionPlan({
    title: '无付费媒体语义夹具',
    ratio: '16:9',
    resolution: '720p',
    planModel: VIMAX_PLAN_MODEL,
    imageModel: 'doubao-seedream-5-0-260128',
    videoModel: 'doubao-seedance-1-5-pro-251215',
    providerReadiness: { plan: true, referenceAssets: true, video: true },
    assets: [{ kind: 'reference', label: '商品主视觉', prompt: '白色背景中的银色耳机' }],
    shots: [{ index: 1, title: '产品亮相', duration: 5, camera: '缓慢推进', prompt: '银色耳机在柔光中旋转' }],
    workflow: resolveVimaxSkillRuntimeBinding({ skillId: presetId }),
  });
  const approved = approveVimaxProductionPlan(base);
  return {
    ...approved,
    checkpoints: approved.checkpoints.map(checkpoint => (
      checkpoint.id === 'reference_assets' || checkpoint.id === 'video'
        ? { ...checkpoint, status: 'pending' as const }
        : checkpoint
    )),
    governance: { ...approved.governance, status: 'ready' },
    estimatedCost: { ...approved.estimatedCost, amount: 1, status: 'confirmed' },
  };
}

async function main() {
  const { createTask } = await import('../src/lib/task-manager');
  const { persistVimaxPlanTask } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-task');
  const { buildProductionBackedVimaxPlan } = await import('../src/lib/skills/vimax-short-drama/vimax-plan-artifacts');
  const [{ NextRequest }, route] = await Promise.all([
    import('next/server'),
    import('../src/app/api/smart/vimax-agent-step/route'),
  ]);
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': 'guest-creation-preset-media-semantics',
  };
  const plan = {
    title: '银色耳机商品片',
    summary: '突出佩戴舒适和降噪卖点',
    assets: [{ kind: 'reference' as const, label: '商品主视觉', prompt: '白色背景中的银色耳机' }],
    shots: [{ index: 1, title: '产品亮相', duration: 5, camera: '缓慢推进', prompt: '银色耳机在柔光中旋转' }],
    nextAction: '生成参考素材',
  };
  const commercePlan = buildReadyPlan('commerce-video');
  const workspace = 'guest-creation-preset-media-semantics';
  const owner = {
    tenantId: 'paper-host-guest',
    memberId: `guest-${createHash('sha256').update(workspace).digest('hex').slice(0, 32)}`,
  };
  const persistCanonicalPlan = (productionPlan: VimaxProductionPlan, skillId: string) => {
    const preset = resolveVimaxSkillPresetForRuntime(skillId);
    const taskId = createTask('storyboard', { prompt: plan.summary, workflow: 'vimax-agent', skillId }, owner);
    const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
      phase: 'plan', skillId, duration: 5, segmentDuration: 5, segmentCount: 1,
      ratio: productionPlan.preferences.ratio, resolution: productionPlan.preferences.resolution,
      sceneType: preset.sceneType, style: preset.style,
    }, taskId);
    persistVimaxPlanTask({
      taskId,
      prompt: plan.summary,
      plan: built.plan,
      productionProject: built.productionProject,
      assemblyPlan: built.assemblyPlan,
      productionPlan,
    });
    return taskId;
  };
  const commerceTaskId = persistCanonicalPlan(commercePlan, 'commerce-video');

  const referenceResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      taskId: commerceTaskId,
      phase: 'reference_assets',
      skillId: 'short-drama',
      sceneType: 'drama',
      style: '雨夜电影感',
      plan,
      productionPlan: commercePlan,
    }),
  }));
  assert.equal(referenceResponse.status, 200);
  assert.ok(imagePrompts.length > 0, 'reference stage must invoke the existing image route fixture');
  const commerceShotPrompt = imagePrompts.find((prompt) => prompt.includes('创作类型：电商商品片'));
  assert.ok(commerceShotPrompt, 'reference stage must preserve the commerce shot prompt after portrait generation');
  assert.match(commerceShotPrompt, /电商商品片/);
  assert.match(commerceShotPrompt, /明快商业广告/);
  assert.doesNotMatch(commerceShotPrompt, /雨夜|同一部短剧/);

  const videoResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      taskId: commerceTaskId,
      phase: 'video',
      confirm: true,
      skillId: 'short-drama',
      sceneType: 'drama',
      style: '雨夜电影感',
      plan,
      assets: [{ kind: 'reference', label: '商品主视觉', url: 'https://fixture.invalid/reference.png', status: 'generated' }],
      productionPlan: commercePlan,
    }),
  }));
  assert.equal(videoResponse.status, 200);
  assert.equal(videoPrompts.length, 1, 'one-shot fixture must submit exactly one video task');
  assert.match(videoPrompts[0], /电商商品片/);
  assert.match(videoPrompts[0], /明快商业广告/);
  assert.doesNotMatch(videoPrompts[0], /雨夜|同一部短剧/);

  const callsBeforeStoryboard = imagePrompts.length + videoPrompts.length;
  const storyboardTaskId = persistCanonicalPlan(buildReadyPlan('storyboard-director'), 'storyboard-director');
  const storyboardResponse = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      taskId: storyboardTaskId,
      phase: 'video',
      confirm: true,
      skillId: 'commerce-video',
      plan,
      productionPlan: buildReadyPlan('storyboard-director'),
    }),
  }));
  const storyboardBody = await storyboardResponse.json() as { error?: string };
  assert.notEqual(storyboardResponse.status, 200);
  assert.match(storyboardBody.error || '', /不包含视频生成阶段/);
  assert.equal(imagePrompts.length + videoPrompts.length, callsBeforeStoryboard, 'storyboard rejection must happen before provider fetch');
  assert.equal(unexpectedNetworkCalls, 0);

  console.log(JSON.stringify({
    ok: true,
    script: 'test-vimax-preset-media-semantics',
    imageRequests: imagePrompts.length,
    videoRequests: videoPrompts.length,
    providerCalls: 0,
  }));
}

main().finally(() => {
  globalThis.fetch = originalFetch;
  rmSync(taskFile, { force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
