import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const maxComponentLines = 2500;
const maxRouteLines = 350;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(fullPath, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function matchesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

const files = walk(srcRoot);
const hardViolations = [];
const warnings = [];

const taskManagerPath = path.join(srcRoot, 'lib', 'task-manager.ts');
if (fs.existsSync(taskManagerPath)) {
  const taskManager = read(taskManagerPath);
  if (matchesAny(taskManager, [
    /from ['"].*production/i,
    /from ['"].*byok/i,
    /from ['"].*app\//i,
    /from ['"].*components/i,
    /coze-coding-dev-sdk/,
    /VideoEditClient/,
    /S3Storage/,
  ])) {
    hardViolations.push({
      file: rel(taskManagerPath),
      rule: 'task-manager-must-not-own-production-or-provider-rules',
      message: 'task-manager should remain task persistence/status only.',
    });
  }
}

for (const file of files) {
  const relative = rel(file);
  const text = read(file);
  const lines = lineCount(text);

  if (relative.startsWith('src/components/') && matchesAny(text, [
    /from ['"]@\/lib\/task-manager['"]/,
    /from ['"].*\/lib\/task-manager['"]/,
  ])) {
    hardViolations.push({
      file: relative,
      rule: 'components-must-not-import-server-task-manager',
      message: 'components should use client task context or API calls, not the server task-manager module.',
    });
  }

  if (relative.startsWith('src/lib/production-') && matchesAny(text, [
    /from ['"]@\/app\//,
    /from ['"].*\/app\//,
    /from ['"]@\/components\//,
    /from ['"].*\/components\//,
  ])) {
    hardViolations.push({
      file: relative,
      rule: 'production-services-must-not-import-ui-or-routes',
      message: 'production services should be reusable from routes, tasks and QA without UI coupling.',
    });
  }

  if (relative.startsWith('src/components/') && lines > maxComponentLines) {
    warnings.push({
      file: relative,
      rule: 'large-component',
      lines,
      recommendation: 'keep new work out of this file; extract focused panels/hooks before adding major behavior.',
    });
  }

  if (relative.startsWith('src/app/api/') && relative.endsWith('/route.ts') && lines > maxRouteLines) {
    warnings.push({
      file: relative,
      rule: 'large-api-route',
      lines,
      recommendation: 'move provider calls, parsing or production rules into lib services before extending this route.',
    });
  }

  if (relative.startsWith('src/app/api/') && matchesAny(text, [
    /VideoEditClient/,
    /S3Storage/,
    /coze-coding-dev-sdk/,
  ])) {
    warnings.push({
      file: relative,
      rule: 'route-direct-provider-sdk',
      lines,
      recommendation: 'prefer a narrow provider/storage service for new logic; keep the route as validation + orchestration.',
    });
  }
}

warnings.sort((a, b) => (b.lines || 0) - (a.lines || 0));

const result = {
  ok: hardViolations.length === 0,
  hardViolationCount: hardViolations.length,
  warningCount: warnings.length,
  hardViolations,
  topWarnings: warnings.slice(0, 20),
  thresholds: {
    maxComponentLines,
    maxRouteLines,
  },
};

console.log(JSON.stringify(result, null, 2));

if (hardViolations.length > 0) {
  process.exit(1);
}
