import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'sceneweave-vimax-initial-references-'));
  process.env.HUIYING_SUBJECT_STORE_PATH = root;
  const owner = { tenantId: 'tenant-a', memberId: 'member-a' };
  const foreignOwner = { tenantId: 'tenant-a', memberId: 'member-b' };
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const webp = Buffer.from('524946460800000057454250', 'hex');

  const [
    { createSubject },
    {
      appendVimaxInitialReferenceContext,
      materializeVimaxInitialReferenceAssets,
      normalizeVimaxInitialReferenceIds,
      resolveVimaxInitialReferenceRecords,
    },
    { callVimaxReferenceImages },
    { resolveVimaxSkillPresetForRuntime },
  ] = await Promise.all([
    import('../src/lib/subjects/subject-store'),
    import('../src/lib/skills/vimax-short-drama/vimax-initial-references'),
    import('../src/lib/skills/vimax-short-drama/vimax-reference-assets'),
    import('../src/lib/skills/vimax-short-drama/vimax-skill-presets'),
  ]);

  try {
    const character = await createSubject(root, owner, {
      name: '林夏',
      type: 'character',
      source: 'uploaded',
      image: webp,
      mimeType: 'image/webp',
      context: 'creation-agent',
    });
    const scene = await createSubject(root, owner, {
      name: '雨夜旧车站',
      type: 'scene',
      source: 'uploaded',
      image: png,
      mimeType: 'image/png',
      context: 'creation-agent',
    });
    const foreign = await createSubject(root, foreignOwner, {
      name: '其他成员角色',
      type: 'character',
      source: 'uploaded',
      image: png,
      mimeType: 'image/png',
      context: 'creation-agent',
    });

    assert.deepEqual(
      normalizeVimaxInitialReferenceIds([scene.id, character.id, scene.id, '', null]),
      [scene.id, character.id],
      'reference order must stay stable while duplicates are removed',
    );
    const records = await resolveVimaxInitialReferenceRecords(owner, [scene.id, character.id]);
    assert.deepEqual(records.map(record => record.id), [scene.id, character.id]);
    await assert.rejects(
      () => resolveVimaxInitialReferenceRecords(owner, [foreign.id]),
      /initial_reference_not_found/,
      'foreign references must fail closed before any provider call',
    );

    const prompt = appendVimaxInitialReferenceContext('制作 10 秒连续短剧', records);
    assert.match(prompt, /参考1：场景「雨夜旧车站」/);
    assert.match(prompt, /参考2：角色「林夏」/);
    const assets = await materializeVimaxInitialReferenceAssets(owner, records);
    assert.deepEqual(assets.map(asset => [asset.kind, asset.label]), [
      ['scene', '雨夜旧车站'],
      ['character', '林夏'],
    ]);
    assert.match(assets[0]?.url || '', /^data:image\/png;base64,/);
    assert.match(assets[1]?.url || '', /^data:image\/webp;base64,/);

    const originalFetch = globalThis.fetch;
    let imageRequest: { input?: { messages?: Array<{ content?: Array<{ image?: string; text?: string }> }> } } | null = null;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      imageRequest = JSON.parse(String(init?.body || '{}'));
      return Response.json({
        output: {
          choices: [{ message: { content: [{ type: 'image', image: 'https://fixture.invalid/shot.png' }] } }],
        },
      });
    }) as typeof fetch;
    try {
      await callVimaxReferenceImages({
        plan: {
          title: '连续短剧',
          summary: '林夏在雨夜旧车站寻找遗失的信件。',
          assets: [],
          shots: [{
            index: 1,
            title: '站台寻信',
            duration: 5,
            camera: '中景跟拍',
            prompt: '林夏沿雨夜站台向右寻找信件',
          }],
          nextAction: '确认参考图',
        },
        preset: resolveVimaxSkillPresetForRuntime('short-drama'),
        continuity: {
          version: 'sceneweave-continuity-contract-v1',
          artifactRevision: 'fixture',
          providerHandoff: {
            mode: 'frame-handoff',
            provider: 'happyhorse-dashscope',
            model: 'happyhorse-1.1-i2v',
            supportsFirstFrame: true,
            supportsReferenceImages: false,
            locked: true,
            limitation: 'fixture',
          },
          subjectBible: '林夏',
          wardrobe: '深色风衣',
          scene: '雨夜旧车站',
          props: ['信件'],
          shots: [{
            shotId: 'shot-1',
            previousShotId: null,
            dependency: '首镜建立人物与场景。',
            actionStart: '林夏进入站台',
            actionEnd: '林夏找到信件',
            screenDirection: '从左向右',
            framing: '中景',
            lightingPalette: '蓝灰雨夜',
            audioCue: '雨声',
            narrativeCause: '寻找信件',
          }],
        },
        config: {
          imageApiBase: 'https://dashscope.aliyuncs.com',
          imageApiKey: 'fixture-key',
          imageModel: 'wan2.7-image-pro',
          selectorApiBase: '',
          selectorApiKey: '',
          selectorModel: '',
        },
        initialReferenceAssets: assets,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    const capturedImageRequest = JSON.parse(JSON.stringify(imageRequest || {})) as {
      input?: { messages?: Array<{ content?: Array<{ image?: string; text?: string }> }> };
    };
    const content = capturedImageRequest.input?.messages?.[0]?.content || [];
    assert.equal(content[0]?.image, assets[0]?.url, 'Wan reference image order must preserve the user order');
    assert.equal(content[1]?.image, assets[1]?.url, 'Wan reference image order must preserve the user order');
    assert.match(content[2]?.text || '', /图1是场景「雨夜旧车站」/);
    assert.match(content[2]?.text || '', /图2是角色「林夏」/);

    const route = await readFile(path.join(process.cwd(), 'src/app/api/smart/vimax-agent-step/route.ts'), 'utf8');
    const planEnvelope = await readFile(
      path.join(process.cwd(), 'src/lib/skills/vimax-short-drama/vimax-plan-envelope.ts'),
      'utf8',
    );
    const workspace = await readFile(path.join(process.cwd(), 'src/components/generate/generate-workspace.tsx'), 'utf8');
    assert.match(planEnvelope, /referenceIds:\s*normalizeVimaxInitialReferenceIds\(input\.body\.referenceIds\)/);
    assert.match(route, /appendVimaxInitialReferenceContext\(prompt,\s*initialReferenceRecords\)/);
    assert.match(route, /initialReferenceAssets,/);
    assert.match(workspace, /referenceIds:\s*selectedReferences\.map/);
    assert.match(workspace, /aria-label="上传参考图"/);
    assert.doesNotMatch(workspace, /title="上传参考"\s+type="button">\s*<Plus/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main()
  .then(() => console.log('ViMAX initial reference contract: ok'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
