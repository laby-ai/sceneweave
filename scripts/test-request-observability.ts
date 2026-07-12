import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';

import { observeRequest } from '../src/lib/request-observability';

type ProbeResult = {
  body: string;
  requestId: string;
  status: number;
};

async function runProbe(headers: Record<string, string> = {}): Promise<ProbeResult & { logs: string[] }> {
  const logs: string[] = [];
  const server = createServer((req, res) => {
    observeRequest(req, res, line => logs.push(line));
    const observedRequestId = String(req.headers['x-request-id'] || '');
    res.statusCode = 204;
    res.setHeader('x-observed-request-id', observedRequestId);
    res.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');

  try {
    const result = await new Promise<ProbeResult>((resolve, reject) => {
      const probe = request({
        host: '127.0.0.1',
        port: address.port,
        method: 'POST',
        path: '/api/tasks?token=query-secret',
        headers: {
          authorization: 'Bearer header-secret',
          cookie: 'session=cookie-secret',
          'content-type': 'application/json',
          ...headers,
        },
      }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({
          body,
          requestId: String(response.headers['x-request-id'] || ''),
          status: response.statusCode || 0,
        }));
      });
      probe.on('error', reject);
      probe.end(JSON.stringify({ password: 'body-secret' }));
    });
    await new Promise(resolve => setImmediate(resolve));
    return { ...result, logs };
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

async function main() {
  const trusted = await runProbe({ 'x-request-id': 'client-request-123' });
assert.equal(trusted.status, 204);
assert.equal(trusted.requestId, 'client-request-123');
assert.equal(trusted.logs.length, 1);

  const event = JSON.parse(trusted.logs[0]);
assert.deepEqual(Object.keys(event).sort(), [
  'durationMs',
  'event',
  'level',
  'method',
  'path',
  'requestId',
  'service',
  'status',
  'timestamp',
].sort());
assert.equal(event.event, 'http_request');
assert.equal(event.level, 'info');
assert.equal(event.method, 'POST');
assert.equal(event.path, '/api/tasks');
assert.equal(event.requestId, trusted.requestId);
assert.equal(event.service, 'huiying');
assert.equal(event.status, 204);
assert.equal(typeof event.durationMs, 'number');
assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);

  const serialized = trusted.logs.join('\n');
  for (const secret of ['query-secret', 'header-secret', 'cookie-secret', 'body-secret', 'authorization', 'cookie', 'password']) {
    assert.equal(serialized.includes(secret), false, `structured log leaked ${secret}`);
  }

  const invalid = await runProbe({ 'x-request-id': 'bad request id forged' });
  assert.match(invalid.requestId, /^[0-9a-f-]{36}$/i);
  assert.notEqual(invalid.requestId, 'bad request id forged');
  assert.equal(JSON.parse(invalid.logs[0]).requestId, invalid.requestId);

  console.log('request observability contract passed');
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
