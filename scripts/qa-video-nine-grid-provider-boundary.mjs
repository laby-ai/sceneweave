#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const routePath = 'src/app/api/video/nine-grid/route.ts';
const servicePath = 'src/lib/nine-grid-provider-headers.ts';
const route = fs.readFileSync(path.join(root, routePath), 'utf8');
const service = fs.readFileSync(path.join(root, servicePath), 'utf8');

const failures = [];
for (const pattern of [/coze-coding-dev-sdk/, /HeaderUtils/]) {
  if (pattern.test(route)) {
    failures.push(`${routePath} must not contain ${pattern}`);
  }
}

for (const required of ['extractNineGridForwardHeaders']) {
  if (!route.includes(required)) {
    failures.push(`${routePath} does not use ${required}`);
  }
  if (!service.includes(required)) {
    failures.push(`${servicePath} does not export ${required}`);
  }
}

if (!service.includes('coze-coding-dev-sdk') || !service.includes('HeaderUtils')) {
  failures.push(`${servicePath} should own the nine-grid provider header boundary`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  routePath,
  servicePath,
  assertion: 'nine-grid route no longer imports provider SDK header helpers directly',
}, null, 2));
