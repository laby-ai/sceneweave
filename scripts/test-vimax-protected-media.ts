import assert from 'node:assert/strict';

import {
  canStreamWorkspaceProtectedMedia,
  fetchWorkspaceProtectedMedia,
  isWorkspaceProtectedMediaUrl,
  prepareWorkspaceProtectedMediaStream,
} from '../src/lib/creation-agent/workspace-protected-media';

const originalFetch = globalThis.fetch;

async function main() {
  assert.equal(isWorkspaceProtectedMediaUrl('/sceneweave/api/final-videos/54ab7cb6-b1a4-494c-aa38-6c58b6165187'), true);
  assert.equal(isWorkspaceProtectedMediaUrl('https://cdn.example/video.mp4'), false);
  assert.equal(
    canStreamWorkspaceProtectedMedia('/sceneweave/api/final-videos/54ab7cb6-b1a4-494c-aa38-6c58b6165187', {}),
    true,
  );
  assert.equal(
    canStreamWorkspaceProtectedMedia('/sceneweave/api/final-videos/54ab7cb6-b1a4-494c-aa38-6c58b6165187', {
      'x-paper-host-guest-workspace': 'guest-fixture',
    }),
    false,
  );
  assert.equal(canStreamWorkspaceProtectedMedia('https://cdn.example/video.mp4', {}), false);

  let receivedHeaders: Headers | undefined;
  let receivedInput = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    receivedInput = String(input);
    receivedHeaders = new Headers(init?.headers);
    return new Response(new Blob(['video'], { type: 'video/mp4' }), {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    });
  }) as typeof fetch;

  const blob = await fetchWorkspaceProtectedMedia(
    '/sceneweave/api/final-videos/54ab7cb6-b1a4-494c-aa38-6c58b6165187',
    {
      'x-paper-host-embed': 'creation-agent',
      'x-paper-host-guest-workspace': 'guest-fixture',
    },
  );
  assert.equal(blob.type, 'video/mp4');
  assert.equal(receivedHeaders?.get('x-paper-host-embed'), 'creation-agent');
  assert.equal(receivedHeaders?.get('x-paper-host-guest-workspace'), 'guest-fixture');

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    receivedInput = String(input);
    return Response.json({ member: { id: 'member-fixture' } });
  }) as typeof fetch;
  await prepareWorkspaceProtectedMediaStream();
  assert.equal(receivedInput, '/api/account/me');

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'not_authenticated' }), { status: 401 });
  await assert.rejects(
    () => fetchWorkspaceProtectedMedia('/sceneweave/api/final-videos/54ab7cb6-b1a4-494c-aa38-6c58b6165187', {}),
    /成片读取失败/,
  );
}

main().finally(() => {
  globalThis.fetch = originalFetch;
}).then(() => console.log('workspace protected media contract passed')).catch(error => {
  console.error(error);
  process.exit(1);
});
