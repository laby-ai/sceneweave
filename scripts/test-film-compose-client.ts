import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestFilmComposition } from '../src/lib/film-compose-client';
import { parseFilmComposeStreamLine } from '../src/lib/film-compose-stream';

assert.deepEqual(parseFilmComposeStreamLine('event: ping'), { type: 'ignore' });
assert.deepEqual(parseFilmComposeStreamLine('data: not-json'), { type: 'ignore' });
assert.deepEqual(
  parseFilmComposeStreamLine('data: {"stage":"concat","progress":35,"message":"拼接中"}'),
  { type: 'progress', progress: 35, message: '拼接中' },
);
assert.deepEqual(
  parseFilmComposeStreamLine('data: {"stage":"complete","success":true,"videoUrl":"https://cdn.example/final.mp4","message":"本地合成完成"}'),
  { type: 'complete', videoUrl: 'https://cdn.example/final.mp4', message: '本地合成完成' },
);
assert.deepEqual(
  parseFilmComposeStreamLine('data: {"stage":"error","success":false,"error":"provider failed"}'),
  { type: 'error', message: 'provider failed' },
);
assert.deepEqual(
  parseFilmComposeStreamLine('data: {"stage":"complete","success":true}'),
  { type: 'error', message: '合成服务未返回最终视频' },
);

const panel = readFileSync(
  new URL('../src/components/film-creation-panel.tsx', import.meta.url),
  'utf8',
);
const route = readFileSync(
  new URL('../src/app/api/film/compose/route.ts', import.meta.url),
  'utf8',
);

assert.match(panel, /requestFilmComposition/);
assert.doesNotMatch(panel, /clientApiRequest\('\/api\/film\/compose'/);
assert.doesNotMatch(panel, /fetch\('\/api\/film\/compose'/);
assert.doesNotMatch(panel, /降级：直接使用分镜视频展示/);
assert.doesNotMatch(route, /视频拼接服务暂不可用，已返回首个分镜视频/);

async function main() {
  const baseRequest = {
    shots: [{ id: 'shot-1', videoUrl: '/private/shot-1.mp4', duration: 5 }],
    enableSubtitle: true,
    enableVoice: true,
    bgmType: 'none',
    bgmVolume: 'medium' as const,
    sfxType: null,
    sfxVolume: 'medium' as const,
    style: 'cinematic',
  };

  let capturedBody = '';
  const single = await requestFilmComposition(baseRequest, {
    request: async (_path, init) => {
      capturedBody = String(init?.body || '');
      return Response.json({ success: true, videoUrl: '/private/final-1.mp4', message: '完成' });
    },
  });
  assert.equal(single.videoUrl, '/private/final-1.mp4');
  assert.equal(JSON.parse(capturedBody).requireDurableOutput, true);

  const progress: number[] = [];
  const multi = await requestFilmComposition({
    ...baseRequest,
    shots: [baseRequest.shots[0], { id: 'shot-2', videoUrl: '/private/shot-2.mp4', duration: 5 }],
  }, {
    request: async () => new Response([
      'data: {"stage":"concat","progress":35,"message":"拼接中"}',
      'data: {"stage":"complete","success":true,"videoUrl":"/private/final-2.mp4","message":"完成"}',
      '',
    ].join('\n\n')),
    onProgress(event) { progress.push(event.progress); },
  });
  assert.equal(multi.videoUrl, '/private/final-2.mp4');
  assert.deepEqual(progress, [35]);

  await assert.rejects(
    requestFilmComposition(baseRequest, {
      request: async () => Response.json({ code: 'film_compose_store_not_ready', error: '稍后重试' }, { status: 503 }),
    }),
    /稍后重试/,
  );
  await assert.rejects(
    requestFilmComposition({ ...baseRequest, shots: [] }, { request: async () => Response.json({}) }),
    /没有可合成的视频/,
  );

  console.log('film compose client contract passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
