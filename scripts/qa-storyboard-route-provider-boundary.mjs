#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const routePath = 'src/app/api/storyboard/submit/route.ts';
const executorPath = 'src/lib/storyboard-submit-executor.ts';
const servicePath = 'src/lib/storyboard-media-clients.ts';
const route = fs.readFileSync(path.join(root, routePath), 'utf8');
const executor = fs.readFileSync(path.join(root, executorPath), 'utf8');
const service = fs.readFileSync(path.join(root, servicePath), 'utf8');

const failures = [];
for (const pattern of [/coze-coding-dev-sdk/, /VideoEditClient/, /S3Storage/]) {
  if (pattern.test(route)) {
    failures.push(`${routePath} must not contain ${pattern}`);
  }
}

for (const required of [
  'storyboardVideoEditor',
  'storyboardSpeechSynthesizer',
  'getStoryboardStorageClient',
]) {
  if (!executor.includes(required)) {
    failures.push(`${executorPath} does not use ${required}`);
  }
  if (!service.includes(required)) {
    failures.push(`${servicePath} does not export ${required}`);
  }
}

if (!route.includes('executeStoryboardTask')) {
  failures.push(`${routePath} should delegate execution to executeStoryboardTask`);
}

if (!service.includes('coze-coding-dev-sdk')) {
  failures.push(`${servicePath} should own the provider SDK import boundary`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  routePath,
  executorPath,
  servicePath,
  assertion: 'storyboard submit route delegates execution and provider SDK clients stay behind service boundaries',
}, null, 2));
