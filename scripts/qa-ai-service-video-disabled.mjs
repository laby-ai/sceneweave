import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adapterPath = path.join(root, 'src/lib/ai-service-adapter.ts');
const text = fs.readFileSync(adapterPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const generateVideoMatch = text.match(/async generateVideo\([^)]*\)[\s\S]*?\n  },\n\n  \/\*\*/);
assert(generateVideoMatch, 'generateVideo method not found');

const generateVideoBody = generateVideoMatch[0];
assert(/legacy provider path is disabled/.test(generateVideoBody), 'generateVideo should fail closed with a clear disabled message');
assert(!/generateMiniMaxVideo|CozeAPI\.generateVideo/.test(generateVideoBody), 'generateVideo must not call legacy video providers');
assert(!/provider:\s*['"]minimax['"]|provider:\s*['"]coze['"]/.test(generateVideoBody), 'generateVideo must not return legacy provider ids');
assert(!/generateMiniMaxVideo/.test(text), 'adapter must not import or reference generateMiniMaxVideo');
assert(!/from ['"].*minimax-client|from ['"].*coze-api/.test(text), 'adapter must not import legacy provider clients');
assert(!/provider:\s*['"]minimax['"]|provider:\s*['"]coze['"]/.test(text), 'adapter must not return legacy provider ids anywhere');

console.log(JSON.stringify({
  ok: true,
  checks: [
    'generateVideo-fail-closed',
    'no-legacy-video-provider-call',
    'no-legacy-video-provider-result',
    'no-generateMiniMaxVideo-import',
    'no-legacy-provider-client-import',
    'no-legacy-provider-result-anywhere',
  ],
}, null, 2));
