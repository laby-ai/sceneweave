import assert from 'node:assert/strict';
import { recoverPersistedVimaxReferenceAssets } from '../src/lib/skills/vimax-short-drama/vimax-reference-assets-recovery';

async function main() {
  const responses = [
    null,
    { task: { result: {} } },
    { task: { result: { vimaxReferenceAssets: [{ url: '/private/reference-1' }] } } },
  ];
  let requestCount = 0;

  const recovered = await recoverPersistedVimaxReferenceAssets({
    taskId: 'task with spaces',
    headers: { Authorization: 'Bearer fixture' },
    isCurrent: () => true,
    pollIntervalMs: 0,
    maxWaitMs: 10_000,
    sleep: async () => {},
    fetchImpl: async (path, init) => {
      assert.equal(path, '/api/tasks/task%20with%20spaces');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture');
      const body = responses[requestCount++];
      if (body === null) throw new Error('temporary disconnect');
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.deepEqual(recovered, [{ url: '/private/reference-1' }]);
  assert.equal(requestCount, 3);

  let cancelledRequests = 0;
  const cancelled = await recoverPersistedVimaxReferenceAssets({
    taskId: 'cancelled',
    headers: {},
    isCurrent: () => false,
    fetchImpl: async () => {
      cancelledRequests += 1;
      return new Response('{}');
    },
  });
  assert.equal(cancelled, null);
  assert.equal(cancelledRequests, 0);

  console.log('vimax reference-assets recovery: passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
