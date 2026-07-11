import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ClientRequestError,
  clientApiDownloadBlob,
  clientApiFetch,
  clientApiPath,
  clientApiRequest,
} from '../src/lib/client-api';

async function main() {

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const location = { pathname: '/huiying/workbench', search: '', hash: '', replace: () => {} };
Object.assign(globalThis, { window: { localStorage, sessionStorage, location } });

const contract = JSON.parse(fs.readFileSync(new URL('../contracts/stoneai-request-v1.json', import.meta.url), 'utf8'));
assert.equal(contract.version, 'stoneai-request-v1');
assert.deepEqual(contract.errors, [
  'unauthorized', 'forbidden', 'rate_limited', 'http_error', 'timeout',
  'cancelled', 'network', 'invalid_payload', 'download_error',
]);

process.env.NEXT_PUBLIC_BASE_PATH = '/huiying';
assert.equal(clientApiPath('/api/health'), '/huiying/api/health');
assert.equal(clientApiPath('/huiying/api/health'), '/huiying/api/health');
assert.equal(clientApiPath('https://example.com/file'), 'https://example.com/file');

localStorage.setItem('account_entitlement_token', 'stored-token');
let captured: { input?: RequestInfo | URL; init?: RequestInit } = {};
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  captured = { input, init };
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
await clientApiFetch('/api/me');
assert.equal(captured.input, '/huiying/api/me');
assert.equal(new Headers(captured.init?.headers).get('authorization'), 'Bearer stored-token');
assert.equal(captured.init?.credentials, 'same-origin');

await clientApiRequest('/api/me', { headers: { Authorization: 'Bearer explicit-token' } });
assert.equal(new Headers(captured.init?.headers).get('authorization'), 'Bearer explicit-token');

const abortingFetch = (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
});
globalThis.fetch = abortingFetch as typeof fetch;
await assert.rejects(
  clientApiRequest('/api/slow', { timeoutMs: 5 }),
  (error: unknown) => error instanceof ClientRequestError && error.code === 'timeout',
);
const caller = new AbortController();
const cancelled = clientApiRequest('/api/cancel', { timeoutMs: 1000, signal: caller.signal });
caller.abort();
await assert.rejects(
  cancelled,
  (error: unknown) => error instanceof ClientRequestError && error.code === 'cancelled',
);

globalThis.fetch = (async () => new Response(
  JSON.stringify({ error: 'permission_denied' }),
  { status: 403, headers: { 'content-type': 'application/json' } },
)) as typeof fetch;
await assert.rejects(
  clientApiFetch('/api/private'),
  (error: unknown) => error instanceof ClientRequestError
    && error.code === 'forbidden'
    && error.status === 403
    && error.message === 'permission_denied',
);

globalThis.fetch = (async () => new Response(
  JSON.stringify({ code: 429, msg: 'busy' }),
  { status: 429, headers: { 'content-type': 'application/json' } },
)) as typeof fetch;
await assert.rejects(
  clientApiFetch('/api/busy'),
  (error: unknown) => error instanceof ClientRequestError && error.code === 'rate_limited',
);

globalThis.fetch = (async () => new Response(
  JSON.stringify({ error: 'file_not_ready' }),
  { headers: { 'content-type': 'application/json' } },
)) as typeof fetch;
await assert.rejects(
  clientApiDownloadBlob('/api/file'),
  (error: unknown) => error instanceof ClientRequestError && error.code === 'download_error',
);

globalThis.fetch = (async () => new Response(
  new Uint8Array([1, 2, 3]),
  { headers: { 'content-type': 'application/octet-stream' } },
)) as typeof fetch;
assert.equal((await clientApiDownloadBlob('/api/file')).size, 3);

const imagePreview = fs.readFileSync(
  new URL('../src/components/image-preview.tsx', import.meta.url),
  'utf8',
);
assert.match(imagePreview, /clientApiDownloadBlob\(url/);
assert.doesNotMatch(imagePreview, /await fetch\(url\)/);
const filmPanel = fs.readFileSync(
  new URL('../src/components/film-creation-panel.tsx', import.meta.url),
  'utf8',
);
assert.match(filmPanel, /clientApiRequest\('\/api\/upload\/material'/);
assert.doesNotMatch(filmPanel, /await fetch\(/);

console.log('stoneai-request-v1 contract passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
