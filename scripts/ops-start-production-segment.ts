import fs from 'node:fs';
import path from 'node:path';

import type { BYOKConnection } from '../src/lib/byok-provider';
import { startProductionAssemblySegment } from '../src/lib/production-segment-start';
import { getTaskFresh } from '../src/lib/task-manager';

function loadDotEnvLocal() {
  const envFile = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) return;
  const text = fs.readFileSync(envFile, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function booleanFlag(name: string, envName: string) {
  const rawArg = argValue(name);
  const rawValue = rawArg ?? process.env[envName];
  return String(rawValue || '').toLowerCase() === 'true';
}

function redactUrl(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('data:')) return 'data-url';
  try {
    const url = new URL(value);
    url.search = url.search ? '?redacted=1' : '';
    return url.toString();
  } catch {
    return value.slice(0, 120);
  }
}

function getConnection(): BYOKConnection {
  loadDotEnvLocal();
  const apiKey = process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY;
  const apiBase = process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3';
  const videoModel = process.env.HUIYING_REAL_ARK_VIDEO_MODEL || process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215';

  if (!apiKey) {
    throw new Error('Missing HUIYING_REAL_ARK_API_KEY or ARK_API_KEY in local environment.');
  }

  return {
    provider: 'ark-plan',
    apiBase,
    apiKey,
    videoModel,
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const childTaskId = argValue('childTaskId') || process.env.HUIYING_START_CHILD_TASK_ID;
const timeoutMs = Number(argValue('timeoutMs') || process.env.HUIYING_START_SEGMENT_TIMEOUT_MS || 15 * 60 * 1000);
const generateAudio = booleanFlag('generateAudio', 'HUIYING_REAL_VIDEO_GENERATE_AUDIO');

async function main() {
  if (!childTaskId) {
    throw new Error('Usage: pnpm run ops:start-production-segment -- --childTaskId=<task-id>');
  }

  const started = startProductionAssemblySegment({
    childTaskId,
    dryRun: false,
    allowRealCost: true,
    generateAudio,
  }, getConnection());

  console.log(JSON.stringify({
    ok: true,
    started: true,
    usedRealKey: true,
    incurredCost: true,
    parentTaskId: started.parentTaskId,
    childTaskId: started.childTaskId,
    segmentIndex: started.segmentIndex,
    duration: started.duration,
    generateAudio,
    usesShotFrameContract: started.startPayload.usesShotFrameContract,
    firstFrameImage: redactUrl(started.startPayload.firstFrameImage),
    message: started.message,
  }, null, 2));

  const deadline = Date.now() + timeoutMs;
  let lastStatus = '';

  while (Date.now() < deadline) {
    const task = getTaskFresh(childTaskId);
    const status = task?.status || 'missing';
    const stage = task?.stage || '';
    const result = task?.result || {};
    const providerTaskId = typeof result.providerTaskId === 'string'
      ? result.providerTaskId
      : Array.isArray(result.segments) && typeof result.segments[0]?.providerTaskId === 'string'
        ? result.segments[0].providerTaskId
        : undefined;
    const statusLine = `${status}|${stage}|${providerTaskId || ''}`;
    if (statusLine !== lastStatus) {
      console.log(JSON.stringify({
        ok: true,
        poll: true,
        childTaskId,
        status,
        stage,
        providerTaskIdPresent: Boolean(providerTaskId),
        videoUrl: redactUrl(result.videoUrl || result.segments?.[0]?.videoUrl),
        lastFrameUrl: redactUrl(result.lastFrameUrl || result.segments?.[0]?.lastFrameUrl),
        error: task?.error || result.error || null,
      }, null, 2));
      lastStatus = statusLine;
    }

    if (status === 'completed' || status === 'failed') {
      process.exit(status === 'completed' ? 0 : 1);
    }
    await sleep(5000);
  }

  console.log(JSON.stringify({
    ok: false,
    childTaskId,
    error: 'Timed out waiting for production segment task.',
  }, null, 2));
  process.exit(1);
}

main().catch(error => {
  console.log(JSON.stringify({
    ok: false,
    usedRealKey: false,
    incurredCost: false,
    childTaskId,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
