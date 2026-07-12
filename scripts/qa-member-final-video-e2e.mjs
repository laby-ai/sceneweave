import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const root = await mkdtemp(path.join(os.tmpdir(), 'huiying-final-e2e-'));
const storeRoot = path.join(root, 'store');
const segmentPaths = [path.join(root, 'one.mp4'), path.join(root, 'two.mp4')];
const appPort = 5199;
const mediaPort = 5197;
const accountPort = 5198;

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${appPort}/huiying/api/health`);
      if (response.ok) return response.json();
    } catch {
      // Candidate is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('candidate_health_timeout');
}

const mediaServer = createServer(async (request, response) => {
  const index = request.url === '/two.mp4' ? 1 : request.url === '/one.mp4' ? 0 : -1;
  if (index < 0) {
    response.writeHead(404).end();
    return;
  }
  const bytes = await readFile(segmentPaths[index]);
  response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length });
  response.end(bytes);
});

const accountServer = createServer((request, response) => {
  const memberId = request.headers.authorization === 'Bearer token-b' ? 'member-b' : 'member-a';
  const payload = JSON.stringify({
    tenant_id: 'tenant-a',
    tenant_name: 'Tenant A',
    member: {
      id: memberId,
      display_name: memberId,
      email: `${memberId}@example.test`,
      role_key: 'member',
      status: 'active',
    },
  });
  response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  response.end(payload);
});

let app;
try {
  assert(ffmpegPath, 'ffmpeg-static unavailable');
  await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:d=0.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', segmentPaths[0]]);
  await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:d=0.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', segmentPaths[1]]);
  await Promise.all([listen(mediaServer, mediaPort), listen(accountServer, accountPort)]);

  app = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_ENV: 'production',
      PORT: String(appPort),
      HOSTNAME: '127.0.0.1',
      NEXT_PUBLIC_BASE_PATH: '/huiying',
      ACCOUNT_CENTER_API_BASE: `http://127.0.0.1:${accountPort}`,
      HUIYING_FINAL_VIDEO_STORE_PATH: storeRoot,
      HUIYING_OBJECT_STORAGE_ENDPOINT_URL: '',
      HUIYING_OBJECT_STORAGE_BUCKET_NAME: '',
      HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID: '',
      HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const health = await waitForHealth();
  assert.equal(health.runtimeReadiness.finalVideoStore.ready, true);
  assert.equal(health.runtimeReadiness.objectStorage.ready, false);

  const composeResponse = await fetch(`http://127.0.0.1:${appPort}/huiying/api/film/compose`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-a', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shots: [
        { id: 'one', videoUrl: `http://127.0.0.1:${mediaPort}/one.mp4`, duration: 1 },
        { id: 'two', videoUrl: `http://127.0.0.1:${mediaPort}/two.mp4`, duration: 1 },
      ],
      requireDurableOutput: true,
      enableVoice: false,
      bgmType: 'none',
    }),
  });
  assert.equal(composeResponse.status, 200);
  const events = (await composeResponse.text())
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => JSON.parse(line.slice(6)));
  const complete = events.find(event => event.stage === 'complete');
  assert.equal(complete.storage, 'shared-local');
  assert.match(complete.videoUrl, /^\/huiying\/api\/final-videos\/[0-9a-f-]{36}$/);

  const privateUrl = `http://127.0.0.1:${appPort}${complete.videoUrl}`;
  const ownerResponse = await fetch(privateUrl, {
    headers: { Authorization: 'Bearer token-a', Range: 'bytes=0-99' },
  });
  assert.equal(ownerResponse.status, 206);
  assert.equal(ownerResponse.headers.get('cache-control'), 'private, max-age=300');
  assert.match(ownerResponse.headers.get('content-range') || '', /^bytes 0-99\//);
  assert.equal((await ownerResponse.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(privateUrl, {
    headers: { Authorization: 'Bearer token-a', Range: 'bytes=999999-' },
  })).status, 416);

  assert.equal((await fetch(privateUrl, { headers: { Authorization: 'Bearer token-b' } })).status, 404);
  assert.equal((await fetch(privateUrl)).status, 401);

  const finalFile = await findFinalVideo(storeRoot);
  assert((await stat(finalFile)).size > 1024);

  console.log(JSON.stringify({
    ok: true,
    composeStatus: composeResponse.status,
    ownerRangeStatus: ownerResponse.status,
    crossMemberStatus: 404,
    unauthenticatedStatus: 401,
    usedRealKey: false,
    incurredCost: false,
    bytes: (await stat(finalFile)).size,
  }));
} finally {
  if (app && !app.killed) app.kill('SIGTERM');
  mediaServer.closeAllConnections();
  accountServer.closeAllConnections();
  await Promise.allSettled([
    new Promise(resolve => mediaServer.close(resolve)),
    new Promise(resolve => accountServer.close(resolve)),
  ]);
  await rm(root, { recursive: true, force: true });
}

async function findFinalVideo(directory) {
  const entries = await import('node:fs/promises').then(fs => fs.readdir(directory, { withFileTypes: true }));
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFinalVideo(candidate).catch(() => null);
      if (nested) return nested;
    } else if (entry.name.endsWith('.mp4')) {
      return candidate;
    }
  }
  throw new Error('final_video_file_missing');
}
