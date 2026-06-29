import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readIfExists = file => {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
};
const checks = [];

function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
}

const routePath = 'src/app/api/node-editor/production-canvas/route.ts';
const pagePath = 'src/app/node-editor/page.tsx';
const shellPath = 'src/components/node-editor/node-editor-shell.tsx';
const route = readIfExists(routePath);
const page = readIfExists(pagePath);
const shell = readIfExists(shellPath);
const builder = readIfExists('src/lib/production-canvas.ts');

check('production-canvas-route-exists', route.length > 0, routePath);
check('node-editor-page-exists', page.length > 0, pagePath);
check('node-editor-shell-exists', shell.length > 0, shellPath);
check('canvas-route-is-task-backed', /taskId/.test(route) && /production-canvas/.test(route));
check('canvas-builder-references-toonflow-mechanism', /Toonflow-app|Toonflow/.test(builder + route + shell));
check('canvas-builder-emits-nodes-and-edges', /nodes:\s*CanvasNode\[\]|const nodes: CanvasNode\[\]/.test(builder) && /edges:\s*CanvasEdge\[\]|const edges: CanvasEdge\[\]/.test(builder));
check('canvas-shell-renders-pan-zoom-workspace', /transform|scale|translate|onWheel|wheel|pan|zoom/i.test(shell + page));

const failed = checks.filter(item => !item.pass);
const result = {
  ok: failed.length === 0,
  script: 'qa-canvas-open-source-alignment',
  checks,
  note: 'This is a static gate only; it does not claim LibTV/Jimeng full canvas parity.',
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
