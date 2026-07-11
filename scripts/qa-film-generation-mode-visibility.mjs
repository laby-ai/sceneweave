import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/film/film-workflow-sidebar.tsx', import.meta.url),
  'utf8',
);

const controlIndex = source.indexOf('data-testid="film-generation-mode-control"');
const scrollAreaIndex = source.indexOf('{/* 可滚动内容区 */}');

assert.ok(controlIndex >= 0, 'generation mode control must expose a stable test id');
assert.ok(
  controlIndex < scrollAreaIndex,
  'generation mode control must stay in the fixed header before the scroll area',
);
assert.match(source, /aria-pressed=\{generationMode === 'sequential'\}/);
assert.match(source, /aria-pressed=\{generationMode === 'parallel'\}/);
assert.doesNotMatch(
  source,
  /cfgExpand === 'generation_mode'/,
  'generation mode must not remain buried in the collapsible scroll area',
);

console.log('film generation mode visibility QA passed');
