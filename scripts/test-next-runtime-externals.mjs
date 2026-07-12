import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ensureNextRuntimeExternals } from './ensure-next-runtime-externals.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'huiying-runtime-externals-'));
try {
  const sourcePackage = path.join(root, 'node_modules', 'coze-coding-dev-sdk');
  const nextServer = path.join(root, '.next', 'server', 'chunks');
  await mkdir(sourcePackage, { recursive: true });
  await mkdir(nextServer, { recursive: true });
  await writeFile(path.join(sourcePackage, 'package.json'), JSON.stringify({ name: 'coze-coding-dev-sdk', main: 'index.js' }));
  await writeFile(path.join(sourcePackage, 'index.js'), 'module.exports = { ready: true };\n');
  await writeFile(path.join(nextServer, 'external.js'), 'require("coze-coding-dev-sdk-deadbeef12345678");\n');

  const aliases = await ensureNextRuntimeExternals(root);
  assert.deepEqual(aliases, ['coze-coding-dev-sdk-deadbeef12345678']);
  const linkedPackage = JSON.parse(await (await import('node:fs/promises')).readFile(
    path.join(root, 'node_modules', aliases[0], 'package.json'),
    'utf8',
  ));
  assert.equal(linkedPackage.name, 'coze-coding-dev-sdk');
  console.log('next runtime external contract passed');
} finally {
  await rm(root, { recursive: true, force: true });
}
