import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  getFinalVideoStoreReadiness,
  readMemberFinalVideo,
  saveMemberFinalVideo,
} from '../src/lib/final-videos/member-final-video-store';

const ownerA = { tenantId: 'tenant-a', memberId: 'member-a' };
const ownerB = { tenantId: 'tenant-a', memberId: 'member-b' };
const mp4 = Buffer.alloc(2048);
mp4.writeUInt32BE(24, 0);
mp4.write('ftyp', 4, 'ascii');
mp4.write('isom', 8, 'ascii');

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'huiying-final-video-'));
  try {
  assert.equal((await getFinalVideoStoreReadiness(root)).ready, true);
  const saved = await saveMemberFinalVideo(root, ownerA, mp4, { segmentCount: 2 });
  assert.equal(saved.bytes, mp4.length);
  assert.equal(saved.segmentCount, 2);
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(saved.filePath, /tenant-a|member-a/);
  assert.deepEqual(await readFile(saved.filePath), mp4);

  const owned = await readMemberFinalVideo(root, ownerA, saved.id);
  assert.equal(owned.bytes, mp4.length);
  await assert.rejects(() => readMemberFinalVideo(root, ownerB, saved.id), /final_video_not_found/);
  await assert.rejects(() => saveMemberFinalVideo(root, ownerA, Buffer.alloc(2048), { segmentCount: 2 }), /final_video_invalid/);

  const route = await readFile(new URL('../src/app/api/final-videos/[id]/route.ts', import.meta.url), 'utf8');
  assert.match(route, /resolvePaperHostCreationOwnerFromRequest/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /status:\s*404/);
  assert.match(route, /Accept-Ranges/);
  assert.match(route, /Content-Range/);
  assert.match(route, /status:\s*416/);
  assert.match(route, /Cache-Control': 'private/);
  assert.match(route, /X-Content-Type-Options': 'nosniff/);

  const health = await readFile(new URL('../src/app/api/health/route.ts', import.meta.url), 'utf8');
  assert.match(health, /finalVideoStore/);
  const compose = await readFile(new URL('../src/app/api/film/compose/route.ts', import.meta.url), 'utf8');
  assert.match(compose, /resolvePaperHostCreationOwnerFromRequest/);
  assert.match(compose, /saveMemberFinalVideo/);
  assert.match(compose, /mergeMemberFinalVideos/);
  assert.match(compose, /shared-local/);
  assert.doesNotMatch(compose, /FILM_COMPOSE_STORAGE_NOT_READY/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().then(() => console.log('member final video store contract passed')).catch(error => {
  console.error(error);
  process.exit(1);
});
