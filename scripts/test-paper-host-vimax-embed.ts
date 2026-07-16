import assert from 'node:assert/strict';

import { resolvePaperHostEmbedContext } from '../src/lib/creation-agent/creation-agent-model';

const workspaceKey = 'guest-creation-1234567890abcdef';
const context = resolvePaperHostEmbedContext(`?embed=creation-agent&workspaceKey=${workspaceKey}`);

assert.equal(context.embedded, true);
assert.equal(context.workspaceKey, workspaceKey);
assert.equal(context.storageScope, `paper-host:${workspaceKey}`);
assert.deepEqual(context.requestHeaders, {
  'x-paper-host-embed': 'creation-agent',
  'x-paper-host-guest-workspace': workspaceKey,
});

const standalone = resolvePaperHostEmbedContext('?embed=creation-agent&workspaceKey=shared-guest');
assert.equal(standalone.embedded, false);
assert.equal(standalone.workspaceKey, undefined);
assert.equal(standalone.storageScope, undefined);
assert.deepEqual(standalone.requestHeaders, {});

console.log('PASS paper-host Vimax embed context isolates guest requests and storage');
