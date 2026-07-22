import assert from 'node:assert/strict';

import { resolvePaperHostEmbedContext } from '../src/lib/creation-agent/creation-agent-model';

const workspaceKey = 'guest-creation-1234567890abcdef';
const context = resolvePaperHostEmbedContext(`?embed=creation-agent&workspaceKey=${workspaceKey}&taskId=task-12345678`);

assert.equal(context.embedded, true);
assert.equal(context.workspaceKey, workspaceKey);
assert.equal(context.storageScope, `paper-host:${workspaceKey}`);
assert.equal(context.resumeTaskId, 'task-12345678');
assert.deepEqual(context.requestHeaders, {
  'x-paper-host-embed': 'creation-agent',
  'x-paper-host-guest-workspace': workspaceKey,
});

const standalone = resolvePaperHostEmbedContext('?embed=creation-agent&workspaceKey=shared-guest');
assert.equal(standalone.embedded, false);
assert.equal(standalone.workspaceKey, undefined);
assert.equal(standalone.storageScope, undefined);
assert.equal(standalone.resumeTaskId, undefined);
assert.deepEqual(standalone.requestHeaders, {});

const authenticatedResume = resolvePaperHostEmbedContext('?taskId=d693d425-268d-471f-ad97-565ba7cbebb5');
assert.equal(authenticatedResume.embedded, false);
assert.equal(authenticatedResume.resumeTaskId, 'd693d425-268d-471f-ad97-565ba7cbebb5');
assert.deepEqual(authenticatedResume.requestHeaders, {});

const invalidResume = resolvePaperHostEmbedContext('?taskId=../../foreign-task');
assert.equal(invalidResume.resumeTaskId, undefined);

console.log('PASS creation-agent context isolates guest storage and preserves safe task resume links');
