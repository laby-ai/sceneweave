import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  VIMAX_REFERENCE_REQUEST_TIMEOUT_MS,
  VIMAX_REFERENCE_RUN_TIMEOUT_MS,
} from '../src/lib/skills/vimax-short-drama/vimax-project-session';

const hookSource = readFileSync(
  new URL('../src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill.ts', import.meta.url),
  'utf8',
);

assert.ok(VIMAX_REFERENCE_REQUEST_TIMEOUT_MS >= 300_000, 'Qwen image request must allow synchronous generation');
assert.ok(
  VIMAX_REFERENCE_RUN_TIMEOUT_MS > VIMAX_REFERENCE_REQUEST_TIMEOUT_MS,
  'run coordinator must not cancel before the HTTP request timeout',
);
assert.match(
  hookSource,
  /clientApiRequest\('\/api\/smart\/vimax-agent-step',[\s\S]*?timeoutMs:\s*VIMAX_REFERENCE_REQUEST_TIMEOUT_MS,[\s\S]*?signal:\s*run\.signal/,
  'reference generation must override the 20s client default timeout',
);

console.log('vimax reference request timeout: PASS');
