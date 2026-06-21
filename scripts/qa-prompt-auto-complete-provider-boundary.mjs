#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const routePath = 'src/app/api/prompt/auto-complete/route.ts';
const servicePath = 'src/lib/prompt-auto-complete-client.ts';
const route = fs.readFileSync(path.join(root, routePath), 'utf8');
const service = fs.readFileSync(path.join(root, servicePath), 'utf8');

const failures = [];
for (const pattern of [/coze-coding-dev-sdk/, /LLMClient/, /HeaderUtils/, /APIError/]) {
  if (pattern.test(route)) {
    failures.push(`${routePath} must not contain ${pattern}`);
  }
}

for (const required of [
  'invokePromptAutoComplete',
  'isPromptAutoCompleteProviderError',
]) {
  if (!route.includes(required)) {
    failures.push(`${routePath} does not use ${required}`);
  }
  if (!service.includes(required)) {
    failures.push(`${servicePath} does not export ${required}`);
  }
}

if (!service.includes('coze-coding-dev-sdk') || !service.includes('LLMClient')) {
  failures.push(`${servicePath} should own the prompt provider SDK boundary`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  routePath,
  servicePath,
  assertion: 'prompt auto-complete route no longer imports or dynamically imports provider SDK clients directly',
}, null, 2));
