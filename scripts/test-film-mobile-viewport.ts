import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/film/film-main-stage-workspace.tsx'), 'utf8');

const checks: Array<[string, boolean]> = [
  ['compact mobile header', source.includes('flex flex-col gap-2 px-3 pt-3 pb-2') && source.includes('md:flex-row') && source.includes('md:px-6 md:pt-5 md:pb-3')],
  ['responsive status grid', source.includes('grid grid-cols-2 md:flex') && source.includes('min-w-0 items-center gap-1.5 px-3 py-2') && source.includes('md:px-4 md:py-2.5')],
  ['mobile log button removed from stats', source.includes('hidden md:flex items-center justify-center')],
  ['compact mobile stage padding', source.includes('px-3 pb-3 md:px-6 md:pb-4')],
  ['dynamic keyboard-safe chat height', source.includes('max-h-[45dvh]') && source.includes('md:max-h-[40vh]')],
  ['bounded mobile messages', source.includes('max-h-[20dvh]') && source.includes('md:max-h-[22vh]')],
  ['single-row mobile quick actions', source.includes('flex-nowrap items-center') && source.includes('overflow-x-auto') && source.includes('md:flex-wrap')],
  ['input can shrink without clipping', source.includes('min-w-0 flex-1 bg-transparent')],
  ['desktop spacing retained', source.includes('md:gap-2.5') && source.includes('md:mx-6 md:mb-4')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map(([name]) => name) }, null, 2));
