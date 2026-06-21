import fs from 'node:fs';
import path from 'node:path';

const routePath = path.join(process.cwd(), 'src/app/api/video/submit/route.ts');
const text = fs.readFileSync(routePath, 'utf8');

const forbidden = [
  { pattern: /MINIMAX_API_KEY/, label: 'Minimax environment fallback' },
  { pattern: /generateMiniMaxVideo|waitForMiniMaxVideo/, label: 'Minimax video client fallback' },
  { pattern: /COZE_WORKLOAD_IDENTITY_API_KEY|COZE_API_KEY|COZE_INTEGRATION_BASE_URL|COZE_API_BASE_URL/, label: 'Coze video credentials in submit route' },
  { pattern: /contents\/generations\/tasks/, label: 'Coze video generation task endpoint' },
  { pattern: /cozeChat/, label: 'Coze chat auto-postprocess dependency' },
  { pattern: /coze-coding-dev-sdk|HeaderUtils|VideoEditClient|TTSClient/, label: 'Coze SDK direct route import' },
  { pattern: /usedProvider/, label: 'mutable provider fallback state' },
  { pattern: /degraded:\s*usedProvider/, label: 'provider fallback degradation metadata' },
  { pattern: /doubao-seedance-1-5-pro-251215/, label: 'hard-coded Coze video model' },
];

const failures = forbidden
  .filter(({ pattern }) => pattern.test(text))
  .map(({ label }) => label);

const required = [
  { pattern: /runBYOKVideoSubmit/, label: 'BYOK video submit provider service' },
  { pattern: /provider:\s*'byok'/, label: 'task result provider marked byok' },
  { pattern: /degraded:\s*false/, label: 'no provider fallback degradation' },
  { pattern: /已关闭 Minimax\/Coze fallback/, label: 'missing BYOK guard message' },
];

for (const item of required) {
  if (!item.pattern.test(text)) {
    failures.push(`missing ${item.label}`);
  }
}

const result = {
  ok: failures.length === 0,
  checkedFile: path.relative(process.cwd(), routePath).replaceAll(path.sep, '/'),
  failures,
};

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
  process.exit(1);
}
