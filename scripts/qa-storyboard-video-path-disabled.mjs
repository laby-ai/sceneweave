#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const checkedFiles = [
  'src/app/api/storyboard/submit/route.ts',
  'src/app/api/storyboard/regenerate-shot/route.ts',
];
const executorPath = 'src/lib/storyboard-submit-executor.ts';

const forbidden = [
  /aiService\.generateVideo/,
  /MiniMax-Hailuo-02/,
  /waitForMiniMaxVideo/,
  /视频生成已降级/,
];

const failures = [];

for (const file of checkedFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      failures.push(`${file} still contains ${pattern}`);
    }
  }
  if (file.endsWith('submit/route.ts')) {
    if (!text.includes('executeStoryboardTask')) {
      failures.push(`${file} should delegate storyboard execution to executeStoryboardTask`);
    }
    continue;
  }
  if (!text.includes('throwStoryboardVideoPathDisabled')) {
    failures.push(`${file} does not use throwStoryboardVideoPathDisabled`);
  }
}

const executor = fs.readFileSync(path.join(root, executorPath), 'utf8');
if (!executor.includes('throwStoryboardVideoPathDisabled')) {
  failures.push(`${executorPath} does not use throwStoryboardVideoPathDisabled`);
}

const helper = fs.readFileSync(path.join(root, 'src/lib/video-generation-path-guidance.ts'), 'utf8');
if (!helper.includes('BYOK') || !helper.includes('production assembly segment start')) {
  failures.push('video-generation-path-guidance.ts must point users to BYOK and assembly segment start');
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedFiles,
  executorPath,
  assertion: 'storyboard video callers fail closed and point users to the recoverable BYOK/assembly path',
}, null, 2));
