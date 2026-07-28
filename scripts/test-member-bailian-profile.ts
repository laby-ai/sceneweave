import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildMemberBailianConnections,
  type MemberProviderProfile,
} from '../src/lib/account/member-bailian-profile';
import { resolveBYOKConnectionsForRequest } from '../src/lib/byok-provider';

async function main() {
const profile: MemberProviderProfile = {
  tenant_id: 'tenant-test',
  member_id: 'member-test',
  provider_id: 'aliyun-bailian',
  workspace_id: '',
  region: 'cn-beijing',
  text_model: 'qwen3.7-plus',
  image_model: 'wan2.7-image-pro',
  tts_model: 'qwen-audio-3.0-tts-plus',
  api_key: 'fixture-key-not-a-real-secret',
};

const connections = buildMemberBailianConnections(profile);
assert.equal(connections.planning.model, 'qwen3.7-plus');
assert.equal(connections.planning.imageModel, 'wan2.7-image-pro');
assert.equal(connections.video.videoModel, 'happyhorse-1.1-i2v');
assert.equal(connections.planning.apiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
assert.equal(connections.video.apiBase, 'https://dashscope.aliyuncs.com/api/v1');

const workspaceConnections = buildMemberBailianConnections({ ...profile, workspace_id: 'ws-membertest' });
assert.equal(workspaceConnections.planning.model, 'qwen3.7-plus');
assert.equal(workspaceConnections.planning.apiBase, 'https://ws-membertest.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
assert.equal(workspaceConnections.video.apiBase, 'https://ws-membertest.cn-beijing.maas.aliyuncs.com/api/v1');

const originalFetch = globalThis.fetch;
const accountEnv = {
  ACCOUNT_CENTER_API_BASE: process.env.ACCOUNT_CENTER_API_BASE,
  ACCOUNT_CENTER_APP_KEY: process.env.ACCOUNT_CENTER_APP_KEY,
  ACCOUNT_CENTER_CREDENTIAL_KEY: process.env.ACCOUNT_CENTER_CREDENTIAL_KEY,
  ACCOUNT_CENTER_CLIENT_SECRET: process.env.ACCOUNT_CENTER_CLIENT_SECRET,
};
process.env.ACCOUNT_CENTER_API_BASE = 'https://account.fixture.invalid';
process.env.ACCOUNT_CENTER_APP_KEY = 'fixture-app';
process.env.ACCOUNT_CENTER_CREDENTIAL_KEY = 'fixture-credential';
process.env.ACCOUNT_CENTER_CLIENT_SECRET = 'fixture-secret';
let profileResolveCalls = 0;
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), 'https://account.fixture.invalid/v1/internal/provider-key-profile/resolve');
  assert.equal(init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(init?.body)), {
    tenant_id: profile.tenant_id,
    member_id: profile.member_id,
  });
  profileResolveCalls += 1;
  return Response.json(profile);
};
try {
  const connectionsForMember = await resolveBYOKConnectionsForRequest(new Request('https://huiying.fixture.invalid/api/smart/vimax-agent-step', {
    headers: {
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': 'https://ark.cn-beijing.volces.com/api/v3',
      'x-yh-api-key': 'legacy-header-key',
      'x-yh-model': 'qwen3.7-plus',
    },
  }), { tenantId: profile.tenant_id, memberId: profile.member_id });
  assert.equal(profileResolveCalls, 1, 'a trusted member must resolve the encrypted account profile');
  assert.equal(connectionsForMember.planning?.apiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.equal(connectionsForMember.planning?.provider, 'openai-compatible');
  assert.equal(connectionsForMember.video?.provider, 'happyhorse-dashscope');
} finally {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(accountEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const rootPage = await readFile(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');
assert.match(rootPage, /redirect\(['"]\/embed\/creation-agent['"]\)/, 'the product root must enter the creation agent');
assert.doesNotMatch(rootPage, /DreamboxHome/, 'the legacy home must stay hidden from the product root');

const control = await readFile(path.join(process.cwd(), 'src/components/generate/bailian-connection-control.tsx'), 'utf8');
assert.match(control, /\/api\/account\/provider-profile/);
assert.doesNotMatch(control, /业务空间 ID/);
assert.doesNotMatch(control, /API Base/);
assert.doesNotMatch(control, /workspace_id/);
assert.doesNotMatch(control, /sessionStorage|localStorage|validateAndSaveBailianSessionConnections/);

const shell = await readFile(path.join(process.cwd(), 'src/components/creation-agent/vimax-creation-agent-shell.tsx'), 'utf8');
assert.match(shell, /creation-agent-dark/);
assert.match(shell, /data-creation-agent-theme="dark"/);
assert.match(
  shell,
  /\bagentOnly\b/,
  'the primary creation entry must stay on the single short-drama agent workflow',
);
assert.doesNotMatch(
  shell,
  /\bavailableModes=/,
  'the primary creation entry must not expose internal image/video mode routing',
);

const provider = await readFile(path.join(process.cwd(), 'src/lib/byok-provider.ts'), 'utf8');
assert.match(provider, /trustedOwner\?: TaskOwner/);
assert.match(provider, /resolveMemberBailianProfileForOwner\(\s*trustedOwner/);

const server = await readFile(path.join(process.cwd(), 'src/server.ts'), 'utf8');
assert.doesNotMatch(server, /req\.headers\[['"]x-yh-api-key['"]\]\s*=/, 'the HTTP server must not forge client BYOK headers');

const route = await readFile(path.join(process.cwd(), 'src/app/api/smart/vimax-agent-step/route.ts'), 'utf8');
assert.match(
  route,
  /resolveBYOKConnectionsForRequest\(request, access\.sessionMode === 'member' \? owner : undefined\)/,
  'member planning must resolve the saved profile from the already authenticated owner',
);
assert.match(
  route,
  /phase === 'planning_connection_validate' && access\.sessionMode !== 'member'/,
  'member connection checks must use the saved account profile instead of request headers',
);
assert.doesNotMatch(route, /MemberBailianApiBaseRequiredError/, 'the member route must not require user-supplied API Base');

console.log('member Bailian profile contract: ok');
}

void main();
