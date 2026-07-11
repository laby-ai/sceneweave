import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { filmComposeHistoryFingerprint } from '../src/lib/film-creation-panel-model';
import {
  FILM_COMPOSE_STORAGE_NOT_READY,
  getFilmComposeDurabilityReadiness,
} from '../src/lib/film-compose-readiness';
import { filmComposeFailureMessage } from '../src/lib/film-compose-stream';

const storageKeys = [
  'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
  'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
  'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
  'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
] as const;
const originalEnv = Object.fromEntries(storageKeys.map(key => [key, process.env[key]]));

try {
  for (const key of storageKeys) delete process.env[key];
  const blocked = getFilmComposeDurabilityReadiness();
  assert.equal(blocked.ready, false);
  assert.equal(blocked.code, FILM_COMPOSE_STORAGE_NOT_READY);
  assert.equal(blocked.retryable, true);
  assert.equal(blocked.clipsPreserved, true);
  assert.doesNotMatch(JSON.stringify(blocked), /ACCESS_KEY|SECRET|ENDPOINT_URL|BUCKET_NAME/);

  process.env.HUIYING_OBJECT_STORAGE_ENDPOINT_URL = 'https://storage.example.com';
  process.env.HUIYING_OBJECT_STORAGE_BUCKET_NAME = 'huiying';
  process.env.HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID = 'configured';
  process.env.HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY = 'configured';
  assert.equal(getFilmComposeDurabilityReadiness().ready, true);
} finally {
  for (const key of storageKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const cardsWithoutVideo = [{ id: 'shot-1', type: 'shot' as const, name: '镜头1', description: '', promptCn: '' }];
const cardsWithVideo = [{ ...cardsWithoutVideo[0], videoUrl: 'https://video.example/shot-1.mp4' }];
assert.notEqual(
  filmComposeHistoryFingerprint('prompt', 'compose', cardsWithoutVideo),
  filmComposeHistoryFingerprint('prompt', 'compose', cardsWithVideo),
  'adding a generated clip must trigger history persistence',
);

assert.equal(
  filmComposeFailureMessage({
    code: FILM_COMPOSE_STORAGE_NOT_READY,
    error: 'internal detail',
    retryable: true,
    clipsPreserved: true,
  }, 503),
  '最终成片暂时无法稳定保存。已生成镜头均已保留，请稍后重试。',
);
assert.equal(filmComposeFailureMessage({ error: 'provider failed' }, 500), 'provider failed');
assert.equal(filmComposeFailureMessage(null, 502), '合成请求失败（HTTP 502）');

const route = readFileSync(new URL('../src/app/api/film/compose/route.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/components/film-creation-panel.tsx', import.meta.url), 'utf8');
assert.match(route, /getFilmComposeDurabilityReadiness/);
assert.match(route, /FILM_COMPOSE_STORAGE_NOT_READY/);
assert.match(route, /status:\s*503/);
assert.match(route, /clipsPreserved:\s*true/);
assert.ok(
  route.indexOf('getFilmComposeDurabilityReadiness') < route.indexOf('new ReadableStream'),
  'durability must fail before starting the compose stream',
);
assert.match(panel, /requireDurableOutput:\s*true/);
assert.match(panel, /filmComposeHistoryFingerprint/);
assert.match(panel, /filmComposeFailureMessage/);

console.log('film compose durability contract passed');
