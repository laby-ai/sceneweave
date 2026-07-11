import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getSubjectStoreReadiness } from '../src/lib/subjects/subject-store-readiness';

async function main() {
  const temp = await mkdtemp(path.join(tmpdir(), 'huiying-subject-health-'));
  try {
    const root = path.join(temp, 'subjects');
    const ready = await getSubjectStoreReadiness(root);
    assert.equal(ready.ready, true);
    assert.deepEqual(ready.blockers, []);
    assert.equal(ready.requirements[0]?.name, 'HUIYING_SUBJECT_STORE_PATH');
    assert.doesNotMatch(JSON.stringify(ready), new RegExp(temp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await assert.rejects(() => stat(path.join(root, '.health-check')), /ENOENT/);

    const blockedRoot = path.join(temp, 'not-a-directory');
    await writeFile(blockedRoot, 'blocked');
    const blocked = await getSubjectStoreReadiness(blockedRoot);
    assert.equal(blocked.ready, false);
    assert.deepEqual(blocked.blockers, ['subject_store_not_writable']);

    const healthRoute = await readFile(path.join(process.cwd(), 'src/app/api/health/route.ts'), 'utf8');
    const productionQa = await readFile(path.join(process.cwd(), 'scripts/qa-production-readiness.mjs'), 'utf8');
    const generateWorkspace = await readFile(path.join(process.cwd(), 'src/components/generate/generate-workspace.tsx'), 'utf8');
    assert.match(healthRoute, /await getSubjectStoreReadiness\(\)/);
    assert.match(healthRoute, /subjectStore/);
    assert.match(productionQa, /readiness\.subjectStore/);
    assert.match(productionQa, /subjectStoreReady/);
    assert.match(generateWorkspace, /right-0[^\"]*sm:right-auto sm:left-0/, 'subject menu must stay inside mobile viewport');
    assert.match(generateWorkspace, /hidden w-56[^\"]*md:flex/, 'internal history sidebar must not consume the mobile workspace');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

void main();
