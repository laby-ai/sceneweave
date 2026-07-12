import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scannedRoots = ['src'];
const scannedFiles = [
  'package.json',
  'pnpm-lock.yaml',
  'next.config.ts',
  'README.md',
  'AGENTS.md',
  '.github/workflows/ci.yml',
  'scripts/build.sh',
  'scripts/dev.sh',
  'scripts/prepare.sh',
  'scripts/start.sh',
  'scripts/validate.sh',
];
const providerName = ['co', 'ze'].join('');
const forbidden = new RegExp([
  `${providerName}-coding-dev-sdk`,
  `lib/${providerName}-api`,
  `${providerName}_[A-Z0-9_]+`,
  `${providerName}\\.site`,
  `api\\.${providerName}\\.cn`,
].join('|'), 'i');
const nonPortableBuildExternal = /@aws-sdk\/(?:client-s3|lib-storage|s3-request-presigner)-[0-9a-f]{16}/i;

async function collectFiles(entry) {
  const absolute = path.join(root, entry);
  const children = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const child of children) {
    const relative = path.join(entry, child.name);
    if (child.isDirectory()) files.push(...await collectFiles(relative));
    else if (/\.(?:[cm]?[jt]sx?|json|ya?ml|md|sh)$/.test(child.name)) files.push(relative);
  }
  return files;
}

for (const entry of scannedRoots) scannedFiles.push(...await collectFiles(entry));

const violations = [];
for (const relative of scannedFiles) {
  const text = await readFile(path.join(root, relative), 'utf8');
  if (forbidden.test(text)) violations.push(relative.replaceAll('\\', '/'));
}

assert.deepEqual(
  violations,
  [],
  `Forbidden provider dependencies or runtime references remain:\n${violations.join('\n')}`,
);

try {
  await access(path.join(root, '.next', 'server'));
  const serverFiles = await collectFiles(path.join('.next', 'server'));
  const nonPortableExternals = [];
  for (const relative of serverFiles) {
    if (!relative.endsWith('.js')) continue;
    const text = await readFile(path.join(root, relative), 'utf8');
    if (nonPortableBuildExternal.test(text)) {
      nonPortableExternals.push(relative.replaceAll('\\', '/'));
    }
  }
  assert.deepEqual(
    nonPortableExternals,
    [],
    `Non-portable hashed provider externals remain in the build:\n${nonPortableExternals.join('\n')}`,
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('provider-independence gate passed');
