import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

assert.match(panel, /clientApiRequest\('\/api\/film\/compose'/);
assert.doesNotMatch(panel, /fetch\('\/api\/film\/compose'/);
assert.doesNotMatch(panel, /降级：直接使用分镜视频展示/);
assert.doesNotMatch(route, /视频拼接服务暂不可用，已返回首个分镜视频/);

console.log('film compose client contract passed');
