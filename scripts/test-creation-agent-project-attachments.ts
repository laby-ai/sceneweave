import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/components/generate/generate-workspace.tsx', 'utf8');

assert.match(
  workspace,
  /type="file"[\s\S]{0,240}\bmultiple\b/,
  'the creation composer must accept a batch instead of one file at a time',
);
assert.match(
  workspace,
  /accept="[^"]*image\/[^"]*video\/[^"]*(?:application\/pdf|text\/plain)/,
  'project attachments must accept image, video, and document inputs',
);
assert.match(
  workspace,
  /uploadProjectAttachment/,
  'uploads must use the member-isolated project attachment owner',
);
assert.match(
  workspace,
  /retryProjectAttachment/,
  'a failed item must expose a per-item retry action',
);
assert.match(
  workspace,
  /moveProjectAttachment/,
  'the user must be able to change attachment order',
);
assert.match(
  workspace,
  /removeProjectAttachment/,
  'the user must be able to remove one attachment without clearing the batch',
);

const uploadBlock = workspace.slice(
  workspace.indexOf('const uploadReference'),
  workspace.indexOf('const handleSend'),
);
assert.doesNotMatch(
  uploadBlock,
  /\/api\/subjects|type:\s*'character'/,
  'ordinary project attachments must not be silently written into the reusable subject library',
);

console.log(JSON.stringify({
  ok: true,
  script: 'test-creation-agent-project-attachments',
}));
