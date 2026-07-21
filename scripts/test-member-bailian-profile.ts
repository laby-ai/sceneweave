import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildMemberBailianConnections,
  type MemberProviderProfile,
} from '../src/lib/account/member-bailian-profile';

async function main() {
const profile: MemberProviderProfile = {
  tenant_id: 'tenant-test',
  member_id: 'member-test',
  provider_id: 'aliyun-bailian',
  workspace_id: '',
  region: 'cn-beijing',
  text_model: 'qwen3.7-plus',
  image_model: 'qwen-image-3.0-pro',
  tts_model: 'qwen-audio-3.0-tts-plus',
  api_key: 'fixture-key-not-a-real-secret',
};

const connections = buildMemberBailianConnections(profile);
assert.equal(connections.planning.model, 'qwen3.7-plus');
assert.equal(connections.planning.imageModel, 'qwen-image-3.0-pro');
assert.equal(connections.video.videoModel, 'happyhorse-1.1-i2v');
assert.equal(connections.planning.apiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
assert.equal(connections.video.apiBase, 'https://dashscope.aliyuncs.com/api/v1');

const workspaceConnections = buildMemberBailianConnections({ ...profile, workspace_id: 'ws-member-test' });
assert.equal(workspaceConnections.planning.model, 'qwen3.7-plus');
assert.equal(workspaceConnections.planning.apiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
assert.equal(workspaceConnections.video.apiBase, 'https://dashscope.aliyuncs.com/api/v1');

const rootPage = await readFile(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');
assert.match(rootPage, /redirect\(['"]\/embed\/creation-agent['"]\)/, 'the product root must enter the creation agent');
assert.doesNotMatch(rootPage, /DreamboxHome/, 'the legacy home must stay hidden from the product root');

const control = await readFile(path.join(process.cwd(), 'src/components/generate/bailian-connection-control.tsx'), 'utf8');
assert.match(control, /\/api\/account\/provider-profile/);
assert.doesNotMatch(control, /业务空间 ID|workspaceId|workspace_id/);
assert.doesNotMatch(control, /sessionStorage|localStorage|validateAndSaveBailianSessionConnections/);

const shell = await readFile(path.join(process.cwd(), 'src/components/creation-agent/vimax-creation-agent-shell.tsx'), 'utf8');
assert.match(shell, /creation-agent-dark/);
assert.match(shell, /data-creation-agent-theme="dark"/);
assert.match(shell, /agentOnly/, 'the primary creation entry must not expose legacy mode placeholders');

const provider = await readFile(path.join(process.cwd(), 'src/lib/byok-provider.ts'), 'utf8');
assert.match(provider, /trustedOwner\?: TaskOwner/);
assert.match(provider, /resolveMemberBailianProfileForOwner\(\s*trustedOwner/);

const route = await readFile(path.join(process.cwd(), 'src/app/api/smart/vimax-agent-step/route.ts'), 'utf8');
assert.match(
  route,
  /resolveBYOKConnectionsForRequest\(request, access\.sessionMode === 'member' \? owner : undefined\)/,
  'member planning must resolve the saved profile from the already authenticated owner',
);

console.log('member Bailian profile contract: ok');
}

void main();
