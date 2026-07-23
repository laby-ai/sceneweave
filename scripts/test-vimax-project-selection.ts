import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(
  new URL('../src/components/generate/generate-workspace.tsx', import.meta.url),
  'utf8',
);

assert.match(
  workspaceSource,
  /const openHistoryProject[\s\S]*?setIgnoreResumeTask\(true\)[\s\S]*?recoveredTaskRef\.current = null[\s\S]*?buildVimaxTaskUrl\(window\.location\.href\)/,
  'opening a project must clear any previous task deep-link before restoring that project',
);

console.log('PASS explicit project selection overrides stale task deep-links');
