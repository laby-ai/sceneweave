#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const routePath = 'src/app/api/video/generate/route.ts';
const orchestratorPath = 'src/lib/video-generate-service.ts';
const servicePath = 'src/lib/video-generate-provider-clients.ts';
const route = fs.readFileSync(path.join(root, routePath), 'utf8');
const orchestrator = fs.readFileSync(path.join(root, orchestratorPath), 'utf8');
const service = fs.readFileSync(path.join(root, servicePath), 'utf8');

const failures = [];
for (const pattern of [
  /native-provider-sdk/,
  /VideoGenerationClient/,
  /VideoEditClient/,
  /TTSClient/,
  /HeaderUtils/,
  /APIError/,
]) {
  if (pattern.test(route)) {
    failures.push(`${routePath} must not contain ${pattern}`);
  }
}

if (!route.includes('createVideoGenerateStream')) {
  failures.push(`${routePath} should delegate to createVideoGenerateStream`);
}

for (const required of [
  'generateVideoWithProvider',
  'synthesizeVideoGenerateSpeech',
  'compileVideoGenerateAudio',
  'isVideoGenerateProviderError',
]) {
  if (!orchestrator.includes(required)) {
    failures.push(`${orchestratorPath} does not use ${required}`);
  }
  if (!service.includes(required)) {
    failures.push(`${servicePath} does not export ${required}`);
  }
}

if (!service.includes('native-provider-sdk') || !service.includes('VideoGenerationClient')) {
  failures.push(`${servicePath} should own the video generation provider boundary`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  routePath,
  servicePath,
  assertion: 'video generate route no longer imports provider SDK clients directly',
}, null, 2));
