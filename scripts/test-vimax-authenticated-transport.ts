import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const skill = read('src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill.ts');
const backgroundTask = read('src/lib/skills/vimax-short-drama/vimax-background-video-task.ts');
const taskStream = read('src/lib/creation-agent/creation-task-stream.ts');
const productionPlan = read('src/components/generate/vimax-production-plan-card.tsx');
const protectedMedia = read('src/lib/creation-agent/workspace-protected-media.ts');

assert.match(skill, /import \{[^}]*clientApiRequest[^}]*\} from '@\/lib\/client-api';/);
assert.doesNotMatch(skill, /fetch\('\/api\/smart\/vimax-agent-step'/);
assert.equal(
  (skill.match(/clientApiRequest\('\/api\/smart\/vimax-agent-step'/g) || []).length,
  4,
  'readiness, plan, reference assets, and video must share the authenticated transport',
);

assert.match(backgroundTask, /clientApiRequest\(`\/api\/tasks\/\$\{encodeURIComponent\(input\.taskId\)\}`/);
assert.doesNotMatch(backgroundTask, /fetch\(`\/api\/tasks/);
assert.match(taskStream, /clientApiRequest\(`\/api\/tasks\/\$\{encodeURIComponent\(input\.taskId\)\}\/events/);
assert.doesNotMatch(taskStream, /fetch\(`\/api\/tasks/);

assert.match(productionPlan, /clientApiRequest\(`\/api\/tasks\/\$\{encodeURIComponent\(taskId\)\}`/);
assert.doesNotMatch(productionPlan, /fetch\(clientApiPath\(`/);
assert.match(protectedMedia, /clientApiDownloadBlob\(url/);
assert.doesNotMatch(protectedMedia, /fetch\(url/);

process.stdout.write(`${JSON.stringify({
  ok: true,
  contract: 'vimax browser requests use authenticated base-path transport',
  paidProviderCalls: 0,
})}\n`);
