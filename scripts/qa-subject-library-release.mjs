import assert from 'node:assert/strict';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:5100/huiying').replace(/\/$/, '');
const releaseRoot = process.env.QA_RELEASE_ROOT || process.cwd();

async function expectUnauthorized(method, suffix, body) {
  const response = await fetch(`${baseUrl}${suffix}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  assert.equal(response.status, 401, `${method} ${suffix} must reject unauthenticated access`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.equal((await response.json()).error, 'not_authenticated');
}

const healthResponse = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.runtimeReadiness?.subjectStore?.ready, true, 'subject store readiness must be true');
assert.deepEqual(health.runtimeReadiness.subjectStore.blockers, []);
assert.doesNotMatch(
  JSON.stringify(health.runtimeReadiness.subjectStore),
  /member(?:Id|_id)|tenant(?:Id|_id)|subjects\.json|[A-Z]:\\|\/opt\//i,
  'subject readiness leaked identity or filesystem details'
);

await expectUnauthorized('GET', '/api/subjects');
await expectUnauthorized('POST', '/api/subjects', { name: 'probe', type: 'character', referenceUrl: 'data:image/png;base64,AA==' });
await expectUnauthorized('DELETE', '/api/subjects/release-smoke-probe');

const itemRoute = await readFile(path.join(releaseRoot, 'src/app/api/subjects/[id]/route.ts'), 'utf8');
assert.match(itemRoute, /'Cache-Control': 'private, max-age=300'/);
assert.match(itemRoute, /'X-Content-Type-Options': 'nosniff'/);

if (process.env.QA_EXPECT_SHARED_ARTIFACTS) {
  const artifacts = path.join(releaseRoot, 'artifacts');
  assert.equal((await lstat(artifacts)).isSymbolicLink(), true, 'release artifacts must be a symlink');
  assert.equal(await realpath(artifacts), await realpath(process.env.QA_EXPECT_SHARED_ARTIFACTS));
}

console.log(JSON.stringify({ ok: true, subjectStoreReady: true, unauthenticatedContract: '401-json', privateImageHeaders: true }));
