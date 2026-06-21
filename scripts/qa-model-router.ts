import assert from 'node:assert/strict';
import {
  DegradeError,
  getCurrentRoute,
  routeWithFallback,
} from '../src/lib/model-router';

async function main() {
  const unconfigured = getCurrentRoute('video');
  assert.equal(unconfigured.primary, 'unconfigured', 'empty route primary should be unconfigured');
  assert.equal(unconfigured.current, 'unconfigured', 'empty route current should be unconfigured');
  assert.deepEqual(unconfigured.chain, [], 'empty route chain should be empty');

  const calls: string[] = [];
  const first = await routeWithFallback('llm', {
    alpha: async () => {
      calls.push('alpha');
      return 'ok';
    },
    beta: async () => {
      calls.push('beta');
      return 'unused';
    },
  });

  assert.equal(first.data, 'ok', 'first executor result mismatch');
  assert.equal(first.provider, 'alpha', 'router should use first healthy executor');
  assert.equal(first.degraded, false, 'first executor should not be degraded');
  assert.deepEqual(calls, ['alpha'], 'router should not call later executor after success');

  const fallbackCalls: string[] = [];
  const fallback = await routeWithFallback('image', {
    alpha: async () => {
      fallbackCalls.push('alpha');
      throw new Error('alpha failed');
    },
    beta: async () => {
      fallbackCalls.push('beta');
      return { url: 'asset://beta' };
    },
  });

  assert.deepEqual(fallbackCalls, ['alpha', 'beta'], 'router should follow executor insertion order');
  assert.equal(fallback.provider, 'beta', 'router should report fallback provider');
  assert.equal(fallback.degraded, true, 'fallback provider should be degraded');
  assert.equal(fallback.originalProvider, 'alpha', 'original provider should be first executor');
  assert.equal(fallback.data.url, 'asset://beta', 'fallback data mismatch');

  await assert.rejects(
    () => routeWithFallback('tts', {}),
    (error) => error instanceof DegradeError && error.errors.length === 0,
    'empty executor map should fail fast with DegradeError'
  );

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'empty-route-unconfigured',
      'executor-order-primary',
      'executor-order-fallback',
      'empty-executor-fail-fast',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
