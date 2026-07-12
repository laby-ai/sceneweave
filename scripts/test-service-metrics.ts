import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ServiceMetrics, metricsRoute, trustedMetricsRequest } from '../src/lib/service-metrics';

async function main() {
const metrics = new ServiceMetrics('huiying');
await Promise.all(Array.from({ length: 100 }, async (_, index) => {
  metrics.observeHttp('POST', '/api/tasks', index < 96 ? 202 : 500, 0.02);
}));
metrics.observeOperation('generation_task', 'queued');
metrics.observeOperation('generation_task', 'failed', 0.75);
metrics.observeOperation('video_provider', 'started');
metrics.observeOperation('video_provider', 'succeeded', 0.4);

const body = metrics.render();
assert.match(body, /stoneai_http_requests_total\{method="POST",route="\/api\/tasks",service="huiying",status_class="2xx"\} 96/);
assert.match(body, /status_class="5xx"\} 4/);
assert.match(body, /stoneai_http_request_duration_seconds_(count|sum)/);
assert.match(body, /operation="generation_task"/);
assert.match(body, /operation="video_provider"/);
assert.match(body, /stoneai_operation_duration_seconds_(count|sum)/);
assert.equal(metricsRoute('/huiying/api/tasks/private-id?member=raw'), '/api/tasks');
assert.equal(metricsRoute('/huiying/api/video/generate'), '/api/video');
assert.equal(metricsRoute('/huiying/attacker/raw-id'), '/unmatched');
assert.equal(trustedMetricsRequest('127.0.0.1', undefined, undefined), true);
assert.equal(trustedMetricsRequest('127.0.0.1', '203.0.113.5', undefined), false);
assert.equal(trustedMetricsRequest('203.0.113.5', undefined, undefined), false);
for (const forbidden of ['requestId', 'tenantRef', 'memberRef', 'taskRef', 'private-id', 'prompt', 'url=', 'providerKey']) {
  assert.equal(body.includes(forbidden), false, forbidden);
}
const serverSource = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(serverSource, /\/api\/metrics/);
assert.match(serverSource, /trustedMetricsRequest/);
console.log(JSON.stringify({ status: 'pass', service: 'huiying', requests: 100, errors: 4 }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
