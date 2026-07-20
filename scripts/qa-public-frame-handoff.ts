import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  getPublicFrameHandoffReadiness,
  savePublicFrameForHandoff,
} from '../src/lib/public-frame-handoff';

const originalPublicBase = process.env.HUIYING_PUBLIC_ASSET_BASE_URL;
const originalProjectBase = process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;
const originalPublicStore = process.env.HUIYING_PUBLIC_ASSET_STORE_PATH;

async function main() {
  process.env.HUIYING_PUBLIC_ASSET_BASE_URL = 'http://localhost:5000';
  delete process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;
  const local = getPublicFrameHandoffReadiness();
  assert.equal(local.ready, false, 'localhost must not be accepted as provider-readable frame handoff base');

  process.env.HUIYING_PUBLIC_ASSET_BASE_URL = 'https://example.invalid';
  const publicReady = getPublicFrameHandoffReadiness();
  assert.equal(publicReady.ready, true, 'https public base should be accepted');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'huiying-public-frame-'));
  const publicStore = path.join(tempDir, 'durable-public-assets');
  process.env.HUIYING_PUBLIC_ASSET_STORE_PATH = publicStore;
  const framePath = path.join(tempDir, 'last-frame.jpg');
  await fs.writeFile(framePath, Buffer.alloc(1024, 7));
  const url = await savePublicFrameForHandoff(framePath);
  assert(url?.startsWith('https://example.invalid/generated/frames/last-frame-'), 'public frame URL mismatch');

  assert(url, 'public frame URL missing');
  const fileName = new URL(url).pathname.split('/').pop();
  assert(fileName, 'public frame file name missing');
  const generatedPath = path.join(publicStore, 'generated', 'frames', fileName);
  const stat = await fs.stat(generatedPath);
  assert(stat.size === 1024, 'saved public frame size mismatch');

  await fs.rm(generatedPath, { force: true });
  await fs.rm(tempDir, { recursive: true, force: true });

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    checks: [
      'localhost is rejected for provider-readable handoff',
      'https public asset base is accepted',
      'frame is copied to the configured durable public store and returns stable URL',
    ],
  }, null, 2));
}

main()
  .finally(() => {
    if (originalPublicBase === undefined) delete process.env.HUIYING_PUBLIC_ASSET_BASE_URL;
    else process.env.HUIYING_PUBLIC_ASSET_BASE_URL = originalPublicBase;
    if (originalProjectBase === undefined) delete process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;
    else process.env.HUIYING_PROJECT_DOMAIN_DEFAULT = originalProjectBase;
    if (originalPublicStore === undefined) delete process.env.HUIYING_PUBLIC_ASSET_STORE_PATH;
    else process.env.HUIYING_PUBLIC_ASSET_STORE_PATH = originalPublicStore;
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
