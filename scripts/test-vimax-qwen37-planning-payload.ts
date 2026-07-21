import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/api/smart/vimax-agent-step/route.ts', 'utf8');
const streamStart = route.indexOf('async function callArkTextStream');
const streamEnd = route.indexOf('export async function POST', streamStart);

assert.ok(streamStart >= 0 && streamEnd > streamStart, 'Vimax streaming planner must exist');

const streamPlanner = route.slice(streamStart, streamEnd);
assert.match(streamPlanner, /enable_thinking:\s*false/, 'Qwen 3.7 planning must disable thinking for deterministic JSON');
assert.match(streamPlanner, /response_format:\s*\{\s*type:\s*['"]json_object['"]\s*\}/, 'Qwen 3.7 planning must request JSON mode');
assert.doesNotMatch(streamPlanner, /max_tokens\s*:/, 'Structured Qwen planning must not cap JSON output with max_tokens');

console.log('vimax-qwen37-planning-payload: PASS');
