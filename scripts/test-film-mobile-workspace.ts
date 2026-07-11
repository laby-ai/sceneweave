import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const panel = read('src/components/film-creation-panel.tsx');
const tabs = read('src/components/film/film-mobile-workspace-tabs.tsx');

const checks: Array<[string, boolean]> = [
  ['typed mobile views', tabs.includes("export type FilmMobileWorkspaceView = 'workflow' | 'workspace' | 'log'")],
  ['three explicit tabs', ['流程', '工作区', '日志'].every(label => tabs.includes(label))],
  ['accessible tablist', tabs.includes('role="tablist"') && tabs.includes('aria-selected') && tabs.includes('aria-controls')],
  ['keyboard activation and navigation', tabs.includes("event.key === 'Enter'") && tabs.includes("event.key === 'ArrowRight'") && tabs.includes('activateView')],
  ['mobile only navigation', tabs.includes('md:hidden')],
  ['panel preserves active view', panel.includes('mobileWorkspaceView') && panel.includes('setMobileWorkspaceView')],
  ['all panels remain mounted', panel.includes('data-mobile-panel="workflow"') && panel.includes('data-mobile-panel="workspace"') && panel.includes('data-mobile-panel="log"')],
  ['desktop layout remains three column', panel.includes('md:flex') && panel.includes('md:w-auto')],
  ['phase selection returns to workspace', panel.includes("setMobileWorkspaceView('workspace')")],
  ['mobile panels fill available width', panel.includes('[&>div]:w-full')],
  ['desktop side panels retain width', panel.includes('md:[&>div]:w-[320px]')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed: failed.map(([name]) => name) }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map(([name]) => name) }, null, 2));
