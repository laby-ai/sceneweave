import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowGrowth = process.env.HUIYING_ALLOW_SPAGHETTI_GROWTH === 'true';

const maxNewComponentLines = 2500;
const maxNewRouteLines = 350;

const frozenLineBaselines = {
  'src/components/film-creation-panel.tsx': 2493,
  'src/components/smart-assistant-panel.tsx': 2418,
  'src/components/video-generation-form.tsx': 2258,
  'src/components/subtitle-editor.tsx': 2432,
  'src/app/api/film/create-script/route.ts': 49,
  'src/app/api/storyboard/submit/route.ts': 132,
  'src/app/api/prompt/decompose/route.ts': 118,
  'src/app/api/prompt/auto-complete/route.ts': 105,
  'src/app/api/script/jimeng-convert/route.ts': 33,
  'src/app/api/video/generate/route.ts': 32,
  'src/app/api/video/merge/route.ts': 520,
  'src/app/api/video/nine-grid/route.ts': 460,
  'src/app/api/video/submit/route.ts': 440,
  'src/app/api/tasks/[taskId]/resume-segment/route.ts': 417,
  'src/app/api/video/generate-subtitle/route.ts': 390,
  'src/app/api/film/compose/route.ts': 387,
};

const legacyProviderReferenceBaseline = 324;
const legacyProviderScanTargets = [
  'src',
  'scripts',
  'package.json',
  'README.md',
  'docs',
];

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function walk(target, acc = []) {
  if (!exists(target)) return acc;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    acc.push(target);
    return acc;
  }

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'artifacts') continue;
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }
  return acc;
}

function sourceFiles() {
  return [
    ...walk(path.join(root, 'src')),
    ...walk(path.join(root, 'scripts')),
  ].filter(file => /\.(ts|tsx|js|mjs|cjs)$/.test(file));
}

function providerScanFiles() {
  return legacyProviderScanTargets.flatMap(target => walk(path.join(root, target))).filter(file => {
    const relative = rel(file);
    if (relative.includes('/node_modules/') || relative.includes('/.next/') || relative.includes('/artifacts/')) return false;
    return /\.(ts|tsx|js|mjs|cjs|json|md|sh)$/.test(file);
  });
}

const hardViolations = [];
const trackedFiles = [];
const files = sourceFiles();

for (const [relative, baselineLines] of Object.entries(frozenLineBaselines)) {
  const filePath = path.join(root, relative);
  if (!exists(filePath)) {
    trackedFiles.push({ file: relative, baselineLines, currentLines: 0, delta: -baselineLines, status: 'removed' });
    continue;
  }
  const currentLines = lineCount(read(filePath));
  const delta = currentLines - baselineLines;
  trackedFiles.push({ file: relative, baselineLines, currentLines, delta, status: delta > 0 ? 'grew' : 'ok' });
  if (delta > 0 && !allowGrowth) {
    hardViolations.push({
      file: relative,
      rule: 'frozen-spaghetti-file-grew',
      baselineLines,
      currentLines,
      delta,
      message: 'This known large file is frozen. Extract to a focused service/hook/component instead of adding lines here.',
    });
  }
}

for (const file of files) {
  const relative = rel(file);
  if (frozenLineBaselines[relative]) continue;
  const lines = lineCount(read(file));

  if (relative.startsWith('src/components/') && lines > maxNewComponentLines) {
    hardViolations.push({
      file: relative,
      rule: 'new-large-component',
      lines,
      message: `New or previously untracked component exceeds ${maxNewComponentLines} lines. Split before adding more behavior.`,
    });
  }

  if (relative.startsWith('src/app/api/') && relative.endsWith('/route.ts') && lines > maxNewRouteLines) {
    hardViolations.push({
      file: relative,
      rule: 'new-large-api-route',
      lines,
      message: `New or previously untracked API route exceeds ${maxNewRouteLines} lines. Move business/provider logic into lib services.`,
    });
  }
}

let legacyProviderReferenceCount = 0;
for (const file of providerScanFiles()) {
  const text = read(file);
  for (const line of text.split(/\r?\n/)) {
    if (/\b(coze|minimax)\b/i.test(line)) {
      legacyProviderReferenceCount += 1;
    }
  }
}

const legacyProviderReferenceDelta = legacyProviderReferenceCount - legacyProviderReferenceBaseline;
if (legacyProviderReferenceDelta > 0 && !allowGrowth) {
  hardViolations.push({
    file: 'src|scripts|package.json|README.md|docs',
    rule: 'legacy-provider-reference-count-grew',
    baseline: legacyProviderReferenceBaseline,
    current: legacyProviderReferenceCount,
    delta: legacyProviderReferenceDelta,
    message: 'Coze/Minimax references are frozen. Remove or isolate legacy paths instead of adding new references.',
  });
}

const result = {
  ok: hardViolations.length === 0,
  hardViolationCount: hardViolations.length,
  hardViolations,
  thresholds: {
    maxNewComponentLines,
    maxNewRouteLines,
    allowGrowth,
  },
  trackedFiles,
  legacyProviderReferences: {
    baseline: legacyProviderReferenceBaseline,
    current: legacyProviderReferenceCount,
    delta: legacyProviderReferenceDelta,
  },
};

console.log(JSON.stringify(result, null, 2));

if (hardViolations.length > 0) {
  process.exit(1);
}
