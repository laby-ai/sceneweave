#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const routePath = 'src/app/api/film/compose/route.ts';
const servicePath = 'src/lib/film-compose-provider-clients.ts';
const storagePath = 'src/lib/huiying-object-storage.ts';
const route = fs.readFileSync(path.join(root, routePath), 'utf8');
const service = fs.readFileSync(path.join(root, servicePath), 'utf8');
const storage = fs.readFileSync(path.join(root, storagePath), 'utf8');

const failures = [];
for (const pattern of [
  /coze-coding-dev-sdk/,
  /VideoEditClient/,
  /TTSClient/,
  /S3Storage/,
  /new Config\(/,
  /uploadFromUrl/,
  /generatePresignedUrl/,
  /concatVideos/,
  /compileVideoAudio/,
]) {
  if (pattern.test(route)) {
    failures.push(`${routePath} must not contain ${pattern}`);
  }
}

for (const required of [
  'storeFilmComposeUrl',
  'concatFilmComposeVideos',
  'synthesizeFilmComposeVoice',
  'compileFilmComposeAudio',
]) {
  if (!route.includes(required)) {
    failures.push(`${routePath} does not use ${required}`);
  }
  if (!service.includes(required)) {
    failures.push(`${servicePath} does not export ${required}`);
  }
}

if (!service.includes('coze-coding-dev-sdk') || !service.includes('VideoEditClient') || !service.includes('TTSClient')) {
  failures.push(`${servicePath} should own the film compose video and speech provider SDK boundary`);
}

if (!service.includes('createHuiyingObjectStorage')) {
  failures.push(`${servicePath} should use the shared Huiying object storage boundary`);
}

if (!storage.includes('S3Storage') || !storage.includes('createHuiyingObjectStorage')) {
  failures.push(`${storagePath} should own the Huiying object storage SDK boundary`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  routePath,
  servicePath,
  storagePath,
  assertion: 'film compose route delegates video, speech, and shared object storage provider clients',
}, null, 2));
