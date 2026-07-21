import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createVimaxPlanningProviderError,
  getVimaxPlanningProviderDiagnostic,
  sanitizeVimaxPlanningFailure,
} from '../src/lib/skills/vimax-short-drama/vimax-planning-readiness';

const route = readFileSync('src/app/api/smart/vimax-agent-step/route.ts', 'utf8');
const planningReadiness = readFileSync(
  'src/lib/skills/vimax-short-drama/vimax-planning-readiness.ts',
  'utf8',
);
const streamStart = route.indexOf('async function callArkTextStream');
const streamEnd = route.indexOf('export async function POST', streamStart);

assert.ok(streamStart >= 0 && streamEnd > streamStart, 'Vimax streaming planner must exist');

const streamPlanner = route.slice(streamStart, streamEnd);
assert.match(streamPlanner, /enable_thinking:\s*false/, 'Qwen 3.7 planning must disable thinking for deterministic JSON');
assert.match(streamPlanner, /response_format:\s*\{\s*type:\s*['"]json_object['"]\s*\}/, 'Qwen 3.7 planning must request JSON mode');
assert.doesNotMatch(streamPlanner, /max_tokens\s*:/, 'Structured Qwen planning must not cap JSON output with max_tokens');

const rejection = createVimaxPlanningProviderError(400, {
  error: {
    code: 'InvalidParameter',
    message: 'sensitive provider detail',
  },
});
assert.equal(getVimaxPlanningProviderDiagnostic(rejection), 'http_400_InvalidParameter');
assert.equal(sanitizeVimaxPlanningFailure(rejection).code, 'planning_provider_failed');
assert.doesNotMatch(rejection.message, /sensitive provider detail/);

const authRejection = createVimaxPlanningProviderError(401, { error: { code: 'InvalidApiKey' } });
assert.equal(sanitizeVimaxPlanningFailure(authRejection).code, 'planning_provider_auth_failed');
assert.equal(getVimaxPlanningProviderDiagnostic(authRejection), 'http_401_InvalidApiKey');

assert.match(planningReadiness, /planning\.provider_rejected/);
assert.match(route, /reportVimaxPlanningFailure\(error\)/);

console.log('vimax-qwen37-planning-payload: PASS');
