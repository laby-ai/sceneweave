import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const helperPath = path.resolve('scripts/open-source-demo-parity-auth.mjs');
assert.ok(existsSync(helperPath), 'parity QA 必须提供独立的鉴权请求头 helper');

const { requireParityAuthHeaders } = await import(pathToFileURL(helperPath).href);

assert.throws(
  () => requireParityAuthHeaders({}),
  /HUIYING_PARITY_AUTH_TOKEN.*专用测试账号/,
  '缺少专用测试 token 时必须在任何业务请求前明确停止',
);
assert.deepEqual(requireParityAuthHeaders({ HUIYING_PARITY_AUTH_TOKEN: '  qa-token  ' }), {
  Authorization: 'Bearer qa-token',
});
assert.throws(
  () => requireParityAuthHeaders({ HUIYING_PARITY_AUTH_TOKEN: '   ' }),
  /HUIYING_PARITY_AUTH_TOKEN/,
);

console.log(JSON.stringify({ ok: true, script: 'test-open-source-demo-parity-auth', checks: 3 }));
