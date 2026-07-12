import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../deploy/linux/promote-release.sh', import.meta.url), 'utf8');

for (const required of [
  'candidate must be below the releases root',
  'SOURCE_COMMIT must be a full commit id',
  'stable environment must be root:root mode 600',
  'candidate artifacts must be a shared-storage symlink',
  'qa-architecture-guard.mjs',
  'qa-spaghetti-growth-guard.mjs',
  'qa-smart-vimax-agent-render.mjs',
  '/huiying/api/subjects',
  '/huiying/api/tasks',
  'mv -Tf "$ROOT/.current-next" "$ROOT/current"',
  'promotion_rollback: restoring previous release',
  'wait_for_health 5100',
]) {
  assert.ok(script.includes(required), `promotion script must include: ${required}`);
}

assert.doesNotMatch(script, /(?:API_KEY|PASSWORD|TOKEN)=['"][^'"]+['"]/);
assert.doesNotMatch(script, /rm\s+-rf/);
assert.ok(
  script.indexOf('PROMOTED=1') < script.indexOf('systemctl stop "$SERVICE"'),
  'rollback protection must be armed before stopping the production service',
);

console.log('release promotion contract passed');
