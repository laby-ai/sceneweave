import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const originalFetch = globalThis.fetch;
const originalPublicBase = process.env.HUIYING_PUBLIC_ASSET_BASE_URL;
const originalProjectBase = process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;
const storageEnvNames = [
  'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
  'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
  'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
  'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
] as const;
const originalStorageEnv = Object.fromEntries(storageEnvNames.map(name => [name, process.env[name]]));

async function main() {
  for (const name of storageEnvNames) delete process.env[name];
  process.env.HUIYING_PUBLIC_ASSET_BASE_URL = 'https://example.invalid';
  delete process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;

  const sampleVideoPath = path.resolve('public/home/huiying-ark-test-clip.mp4');
  const sampleVideo = await fs.readFile(sampleVideoPath);
  let fetchCalls = 0;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => {
    fetchCalls += 1;
    if (fetchCalls <= 2) {
      throw new TypeError('transient provider video download failure');
    }
    return new Response(sampleVideo, {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    });
  };

  const { extractLastFrameForHandoff } = await import('../src/lib/video-frame-extraction');
  const result = await extractLastFrameForHandoff('https://provider.invalid/generated-video.mp4');

  assert.equal(result.ok, true, 'local ffmpeg extraction should produce a handoff URL when public base is ready');
  assert(result.lastFrameUrl, 'handoff URL missing');
  const lastFrameUrl = result.lastFrameUrl;
  assert(lastFrameUrl.startsWith('https://example.invalid/generated/frames/last-frame-'), 'handoff URL should use public asset base');
  assert.equal(result.source, 'public-frame-handoff', 'public fallback should be recorded as upload source');
  assert.equal(result.diagnostics.downloaded, true, 'diagnostics should record video download');
  assert(fetchCalls >= 3, 'provider video download should retry transient failures before giving up');
  assert(result.diagnostics.downloadBytes > 1024, 'diagnostics should record downloaded bytes');
  assert.equal(result.diagnostics.extracted, true, 'diagnostics should record frame extraction');
  assert(result.diagnostics.extractedBytes > 512, 'diagnostics should record extracted frame bytes');
  assert.equal(result.diagnostics.uploaded, true, 'diagnostics should record frame upload/copy');
  assert.equal(result.diagnostics.publicFrameHandoffReady, true, 'diagnostics should record public handoff readiness');
  assert.equal(result.diagnostics.objectStorageReady, false, 'diagnostics should not pretend object storage is configured');

  const fileName = new URL(lastFrameUrl).pathname.split('/').pop();
  assert(fileName, 'generated frame file name missing');
  const generatedPath = path.resolve('public/generated/frames', fileName);
  const stat = await fs.stat(generatedPath);
  assert(stat.size === result.diagnostics.extractedBytes, 'public frame artifact should match extracted byte count');
  await fs.rm(generatedPath, { force: true });

  delete process.env.HUIYING_PUBLIC_ASSET_BASE_URL;
  const base64Result = await extractLastFrameForHandoff('https://provider.invalid/generated-video.mp4');
  assert.equal(base64Result.ok, true, 'base64 fallback should produce a handoff value without storage/public URL');
  assert(base64Result.lastFrameUrl?.startsWith('data:image/jpeg;base64,'), 'base64 fallback should produce a data URL');
  assert.equal(base64Result.source, 'base64-data-url', 'base64 fallback source should be recorded');
  assert.equal(base64Result.diagnostics.uploaded, true, 'base64 fallback should count as a transferable upload channel');
  assert.equal(base64Result.diagnostics.base64FrameHandoffReady, true, 'diagnostics should record base64 handoff readiness');

  console.log(JSON.stringify({
    ok: true,
    usedRealKey: false,
    incurredCost: false,
    sourceVideo: sampleVideoPath,
    checks: [
      'provider-video-download-is-observable',
      'provider-video-download-retries-transient-failures',
      'ffmpeg-last-frame-extraction-is-observable',
      'public-https-frame-handoff-url-is-produced',
      'base64-frame-handoff-url-is-produced-without-public-storage',
      'object-storage-not-falsely-reported-ready',
    ],
    diagnostics: {
      downloaded: result.diagnostics.downloaded,
      downloadBytes: result.diagnostics.downloadBytes,
      extracted: result.diagnostics.extracted,
      extractedBytes: result.diagnostics.extractedBytes,
      uploaded: result.diagnostics.uploaded,
      uploadSource: result.diagnostics.uploadSource,
      publicFrameHandoffReady: result.diagnostics.publicFrameHandoffReady,
      objectStorageReady: result.diagnostics.objectStorageReady,
    },
  }, null, 2));
}

main()
  .finally(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    if (originalPublicBase === undefined) delete process.env.HUIYING_PUBLIC_ASSET_BASE_URL;
    else process.env.HUIYING_PUBLIC_ASSET_BASE_URL = originalPublicBase;
    if (originalProjectBase === undefined) delete process.env.HUIYING_PROJECT_DOMAIN_DEFAULT;
    else process.env.HUIYING_PROJECT_DOMAIN_DEFAULT = originalProjectBase;
    for (const name of storageEnvNames) {
      const original = originalStorageEnv[name];
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
