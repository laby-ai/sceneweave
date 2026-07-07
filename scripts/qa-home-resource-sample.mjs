import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const defaultUrl = process.env.HUIYING_RESOURCE_SAMPLE_URL || 'https://airai.world/huiying';
const sampleMs = Number(process.env.HUIYING_RESOURCE_SAMPLE_MS || 5000);

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function findChrome() {
  for (const candidate of chromeCandidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForProcessExit(child, timeoutMs = 3000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    sleep(timeoutMs),
  ]);
}

async function removeDirBestEffort(dir) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`warn: failed to remove temp dir ${dir}: ${error.message}`);
        return;
      }
      await sleep(250);
    }
  }
}

async function waitForDevtoolsPort(userDataDir, timeoutMs = 10000) {
  const portPath = path.join(userDataDir, 'DevToolsActivePort');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(portPath)) {
      const [port, browserPath] = fs.readFileSync(portPath, 'utf8').trim().split(/\r?\n/);
      if (port && browserPath) return { port, browserPath };
    }
    await sleep(100);
  }
  throw new Error('Timed out waiting for Chrome DevToolsActivePort');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.waiters = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      this.events.push(message);
      for (const waiter of [...this.waiters]) {
        if (waiter.predicate(message)) {
          this.waiters = this.waiters.filter(item => item !== waiter);
          waiter.resolve(message);
        }
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitForEvent(method, sessionId, timeoutMs = 15000) {
    const predicate = message => message.method === method && (!sessionId || message.sessionId === sessionId);
    const existing = this.events.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(item => item.resolve !== resolve);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.waiters.push({
        predicate,
        resolve: message => {
          clearTimeout(timer);
          resolve(message);
        },
      });
    });
  }

  close() {
    this.ws.close();
  }
}

function summarizeRequests(requests) {
  const countsByType = {};
  const mediaRequests = [];
  const imageRequests = [];
  const scriptRequests = [];

  for (const request of requests) {
    countsByType[request.type] = (countsByType[request.type] || 0) + 1;
    if (request.type === 'Media' || /\.(mp4|webm|mov)(\?|#|$)/i.test(request.url)) mediaRequests.push(request);
    if (request.type === 'Image') imageRequests.push(request);
    if (request.type === 'Script') scriptRequests.push(request);
  }

  return {
    totalRequests: requests.length,
    countsByType,
    mediaRequestCount: mediaRequests.length,
    imageRequestCount: imageRequests.length,
    scriptRequestCount: scriptRequests.length,
    mediaRequests: mediaRequests.slice(0, 20),
  };
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome or Edge executable not found. Set CHROME_PATH to enable resource sampling.');
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-cdp-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let client;
  try {
    const { port, browserPath } = await waitForDevtoolsPort(userDataDir);
    client = new CdpClient(`ws://127.0.0.1:${port}${browserPath}`);
    await client.open();

    const target = await client.send('Target.createTarget', { url: 'about:blank' });
    const attached = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;

    const requests = [];
    const responses = new Map();
    client.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.sessionId === sessionId && message.method === 'Network.requestWillBeSent') {
        const params = message.params;
        requests.push({
          requestId: params.requestId,
          type: params.type,
          url: params.request.url,
        });
      }
      if (message.sessionId === sessionId && message.method === 'Network.responseReceived') {
        responses.set(message.params.requestId, {
          status: message.params.response.status,
          mimeType: message.params.response.mimeType,
        });
      }
    });

    await client.send('Network.enable', {}, sessionId);
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);

    const startedAt = Date.now();
    await client.send('Page.navigate', { url: defaultUrl }, sessionId);
    await client.waitForEvent('Page.loadEventFired', sessionId, 45000);
    await sleep(sampleMs);

    const domResult = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `JSON.stringify({
        title: document.title,
        url: location.href,
        imgs: document.querySelectorAll('img').length,
        lazyImgs: document.querySelectorAll('img[loading="lazy"]').length,
        eagerImgs: document.querySelectorAll('img[loading="eager"]').length,
        asyncDecodedImgs: document.querySelectorAll('img[decoding="async"]').length,
        videos: document.querySelectorAll('video').length,
        autoplayVideos: document.querySelectorAll('video[autoplay]').length,
        preloadAutoVideos: document.querySelectorAll('video[preload="auto"]').length,
        preloadNoneVideos: document.querySelectorAll('video[preload="none"]').length,
        videoAttrs: Array.from(document.querySelectorAll('video')).slice(0, 20).map(video => ({
          src: video.currentSrc || video.src,
          poster: video.poster,
          preload: video.getAttribute('preload'),
          autoplay: video.autoplay,
          paused: video.paused
        }))
      })`,
    }, sessionId);

    const dom = JSON.parse(domResult.result.value);
    const requestSummary = summarizeRequests(requests.map(request => ({
      ...request,
      response: responses.get(request.requestId) || null,
    })));

    console.log(JSON.stringify({
      ok: true,
      url: defaultUrl,
      elapsedMs: Date.now() - startedAt,
      chromePath,
      sampleMs,
      dom,
      requests: requestSummary,
    }, null, 2));
  } finally {
    if (client) client.close();
    chrome.kill();
    await waitForProcessExit(chrome);
    await removeDirBestEffort(userDataDir);
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    url: defaultUrl,
  }, null, 2));
  process.exit(1);
});
