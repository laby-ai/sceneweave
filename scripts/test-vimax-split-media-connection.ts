import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildMemberBailianConnections } from '../src/lib/account/member-bailian-profile';

async function main() {
  const connections = buildMemberBailianConnections({
    tenant_id: 'tenant-fixture',
    member_id: 'member-fixture',
    provider_id: 'aliyun-bailian',
    workspace_id: '',
    region: 'cn-beijing',
    text_model: 'qwen3.7-plus',
    image_model: 'qwen-image-2.0-pro',
    tts_model: 'qwen-audio-3.0-tts-plus',
    api_key: 'fixture-key',
  });

  assert.equal(connections.planning.imageModel, 'qwen-image-2.0-pro');
  assert.notEqual(connections.planning.apiBase, connections.video.apiBase);

  const [routeSource, orchestratorSource, segmentRouteSource] = await Promise.all([
    readFile('src/app/api/smart/vimax-agent-step/route.ts', 'utf8'),
    readFile('src/lib/skills/vimax-short-drama/vimax-production-video-orchestrator.ts', 'utf8'),
    readFile('src/app/api/production/assembly-plan/segment/start/route.ts', 'utf8'),
  ]);
  assert.doesNotMatch(routeSource, /imageConnection:\s*planConnection/);
  assert.doesNotMatch(orchestratorSource, /imageConnection/);
  assert.match(segmentRouteSource, /startProductionAssemblySegment\(body, byokConnection\)/);

  console.log(JSON.stringify({
    ok: true,
    planningProvider: connections.planning.provider,
    planningImageModel: connections.planning.imageModel,
    videoProvider: connections.video.provider,
  }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
