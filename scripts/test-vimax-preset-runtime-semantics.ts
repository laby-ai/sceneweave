import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const taskFile = path.join(tmpdir(), `sceneweave-vimax-preset-runtime-${randomUUID()}.json`);
process.env.HUIYING_TASKS_FILE = taskFile;
process.env.HUIYING_AGENTPLAN_ARK_API_KEY_PRIMARY = 'fixture-key';

interface CapturedRequest {
  system: string;
  user: string;
}

const captured: CapturedRequest[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_input, init) => {
  const body = JSON.parse(String(init?.body || '{}')) as {
    messages?: Array<{ role?: string; content?: string }>;
  };
  captured.push({
    system: body.messages?.find(message => message.role === 'system')?.content || '',
    user: body.messages?.find(message => message.role === 'user')?.content || '',
  });
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          title: '无付费夹具方案',
          summary: '验证预设语义与运行边界。',
          assets: [{ kind: 'reference', label: '参考素材', prompt: '夹具素材' }],
          shots: [{ index: 1, title: '镜头一', duration: 5, camera: '推进', prompt: '夹具镜头' }],
          nextAction: '确认方案',
        }),
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

async function main() {
  const [{ NextRequest }, route, presets, taskManager] = await Promise.all([
    import('next/server'),
    import('../src/app/api/smart/vimax-agent-step/route'),
    import('../src/lib/skills/vimax-short-drama/vimax-skill-presets'),
    import('../src/lib/task-manager'),
  ]);
  const headers = {
    'content-type': 'application/json',
    'x-paper-host-embed': 'creation-agent',
    'x-paper-host-guest-workspace': 'guest-creation-preset-runtime-semantics',
  };

  for (const preset of presets.VIMAX_SKILL_PRESETS) {
    const response = await route.POST(new NextRequest('http://localhost/api/smart/vimax-agent-step', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phase: 'plan',
        prompt: `${preset.name}的无付费运行语义测试`,
        skillId: preset.id,
        sceneType: 'forged-scene-type',
        style: 'forged-style',
        duration: 10,
        segmentDuration: 5,
        segmentCount: 2,
      }),
    }));
    const result = await response.json() as {
      taskId?: string;
      productionPlan?: { workflow?: { operationOrder?: string[] } };
    };
    assert.equal(response.status, 200, `${preset.id} plan route must stay usable with the fixture provider`);
    const outbound = captured.at(-1);
    assert.ok(outbound?.system.includes(preset.name), `${preset.id} system prompt must use the selected preset name`);
    assert.ok(outbound?.system.includes(preset.description), `${preset.id} system prompt must use the selected preset description`);
    assert.ok(outbound?.system.includes(preset.style), `${preset.id} system prompt must use the trusted preset style`);
    assert.ok(outbound?.user.includes(preset.name), `${preset.id} user instruction must retain the selected preset semantics`);
    if (preset.id !== 'short-drama') {
      assert.doesNotMatch(outbound?.system || '', /短剧标题|短剧制作/, `${preset.id} must not inherit short-drama-only semantics`);
    }
    const persistedProject = taskManager.getTaskFresh(result.taskId || '')?.result?.productionProject as {
      sceneType?: string;
      style?: string;
    } | undefined;
    assert.equal(persistedProject?.sceneType, preset.sceneType, `${preset.id} must ignore forged sceneType`);
    assert.equal(persistedProject?.style, preset.style, `${preset.id} must ignore forged style`);

    const operations = result.productionPlan?.workflow?.operationOrder || [];
    if (preset.id === 'storyboard-director') {
      assert.ok(!operations.includes('director.video'));
      assert.ok(!operations.includes('segments.queue'));
      assert.ok(!operations.includes('segments.retry-failed'));
    } else {
      assert.ok(operations.includes('director.video'));
      assert.ok(operations.includes('segments.queue'));
      assert.ok(operations.includes('segments.retry-failed'));
    }
  }

  assert.equal(captured.length, presets.VIMAX_SKILL_PRESETS.length);
  console.log(JSON.stringify({
    ok: true,
    script: 'test-vimax-preset-runtime-semantics',
    presets: presets.VIMAX_SKILL_PRESETS.length,
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
