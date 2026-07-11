import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { POST as logoutPost } from '../src/app/api/account/logout/route';

const fixtureToken = 'local_contract_token';
const originalFetch = globalThis.fetch;
const originalBase = process.env.ACCOUNT_CENTER_API_BASE;

async function main() {
  const spec = JSON.parse(await readFile(path.join(process.cwd(), 'contracts/cross-app-auth-v1.json'), 'utf8'));
  assert.equal(spec.version, 'stoneai-auth-v1');
  assert.deepEqual(spec.products.huiying.sessionTransport, ['httpOnlyCookie', 'bearer']);
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['test:cross-app-auth-contract'], 'tsx scripts/test-cross-app-auth-contract.ts');
  const workflow = await readFile(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /pnpm run test:cross-app-auth-contract/);
  assert.match(workflow, /pnpm run test:member-subject-library/);
  assert.match(workflow, /pnpm run test:member-final-video-store/);

  process.env.ACCOUNT_CENTER_API_BASE = 'https://account.invalid';
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ status: 'ok' });
  };

  try {
    const missing = await logoutPost(new NextRequest('http://localhost/huiying/api/account/logout', { method: 'POST' }));
    assert.equal(missing.status, 401, 'missing cookie/bearer must fail closed');
    assert.equal(calls.length, 0);

    const cookieResponse = await logoutPost(new NextRequest('https://airai.world/huiying/api/account/logout', {
      method: 'POST',
      headers: {
        cookie: `huiying_account_token=${fixtureToken}`,
        'x-tenant-id': 'tenant-spoofed',
        'x-member-id': 'member-spoofed',
      },
    }));
    assert.equal(cookieResponse.status, 200);
    assert.match(cookieResponse.headers.get('set-cookie') || '', /Max-Age=0/i);
    assert.match(cookieResponse.headers.get('set-cookie') || '', /HttpOnly/i);
    assert.equal(calls[0].url, 'https://account.invalid/v1/auth/logout');
    assert.equal(new Headers(calls[0].init?.headers).get('authorization'), `Bearer ${fixtureToken}`);
    assert.equal(new Headers(calls[0].init?.headers).get('x-tenant-id'), null);
    assert.equal(new Headers(calls[0].init?.headers).get('x-member-id'), null);

    calls.length = 0;
    const bearerResponse = await logoutPost(new NextRequest('https://airai.world/huiying/api/account/logout', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${fixtureToken}`,
        cookie: 'huiying_account_token=ignored_cookie_token',
      },
    }));
    assert.equal(bearerResponse.status, 200);
    assert.equal(new Headers(calls[0].init?.headers).get('authorization'), `Bearer ${fixtureToken}`);

    globalThis.fetch = async () => Response.json({ error: 'account_unavailable' }, { status: 503 });
    const unavailable = await logoutPost(new NextRequest('https://airai.world/huiying/api/account/logout', {
      method: 'POST',
      headers: { cookie: `huiying_account_token=${fixtureToken}` },
    }));
    assert.equal(unavailable.status, 502);
    assert.equal(unavailable.headers.get('set-cookie'), null, 'failed revocation must not claim local logout');

    const accountButton = await readFile(path.join(process.cwd(), 'src/components/home/account-status-button.tsx'), 'utf8');
    assert.match(accountButton, /setLogoutError\('暂时无法安全退出，请检查网络后重试。'\)/);
    assert.doesNotMatch(accountButton, /catch \{[\s\S]{0,160}clearStoredAccountTokens\(\)/);

    console.log('Huiying cross-app auth contract passed');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.ACCOUNT_CENTER_API_BASE;
    else process.env.ACCOUNT_CENTER_API_BASE = originalBase;
  }
}

void main();
