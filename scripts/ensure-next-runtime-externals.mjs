import { lstat, mkdir, readdir, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTERNAL_PATTERN = /coze-coding-dev-sdk-[a-f0-9]{8,}/g;

async function collectAliases(directory, aliases) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectAliases(filePath, aliases);
    if (!entry.name.endsWith('.js') && !entry.name.endsWith('.json')) return;
    const source = await readFile(filePath, 'utf8');
    for (const match of source.matchAll(EXTERNAL_PATTERN)) aliases.add(match[0]);
  }));
}

export async function ensureNextRuntimeExternals(root = process.cwd()) {
  const nextServer = path.join(root, '.next', 'server');
  const modulesRoot = path.join(root, 'node_modules');
  const sourcePackage = path.join(modulesRoot, 'coze-coding-dev-sdk');
  await lstat(sourcePackage).catch(() => {
    throw new Error('coze_runtime_source_missing');
  });

  const aliases = new Set();
  await collectAliases(nextServer, aliases);
  if (aliases.size === 0) throw new Error('coze_runtime_alias_not_traced');

  await mkdir(modulesRoot, { recursive: true });
  for (const alias of aliases) {
    const aliasPath = path.join(modulesRoot, alias);
    const existing = await lstat(aliasPath).catch(() => null);
    if (existing) await rm(aliasPath, { recursive: true, force: true });
    await symlink(sourcePackage, aliasPath, process.platform === 'win32' ? 'junction' : 'dir');
  }

  return [...aliases].sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const aliases = await ensureNextRuntimeExternals();
  console.log(`next_runtime_externals=${aliases.join(',')}`);
}
