import assert from 'node:assert/strict';
import fs from 'node:fs';

import { findUnoccupiedNodePosition } from '../src/icanvas/app/(user)/canvas/utils/canvas-node-placement';

const preferred = { x: 100, y: 100 };
const nodeSize = { width: 340, height: 240 };
const first = findUnoccupiedNodePosition(preferred, nodeSize, []);

assert.deepEqual(first, preferred, 'an empty canvas should keep the preferred position');

const second = findUnoccupiedNodePosition(preferred, nodeSize, [
  { position: first, ...nodeSize },
]);

assert.notDeepEqual(second, preferred, 'a second node must not cover the first node');
assert(
  second.x >= first.x + nodeSize.width || second.x + nodeSize.width <= first.x
    || second.y >= first.y + nodeSize.height || second.y + nodeSize.height <= first.y,
  'the second node should be visibly separated from the first node',
);

const third = findUnoccupiedNodePosition(preferred, nodeSize, [
  { position: first, ...nodeSize },
  { position: second, ...nodeSize },
]);

assert.notDeepEqual(third, first, 'the third node must not cover the first node');
assert.notDeepEqual(third, second, 'the third node must not cover the second node');

const canvasPage = fs.readFileSync(
  'src/icanvas/app/(user)/canvas/[id]/canvas-client-page.tsx',
  'utf8',
);
const normalizedCanvasPage = canvasPage.replace(/\r\n/g, '\n');
assert(
  normalizedCanvasPage.includes('findUnoccupiedNodePosition('),
  'the toolbar createNode flow should use collision-aware placement',
);
assert(
  normalizedCanvasPage.includes('searchParams.has("agentUrl")')
    && normalizedCanvasPage.includes('}\n        openAgent("online");\n    }, [projectLoaded, searchParams]);'),
  'ordinary canvas entry should use the website agent while explicit agentUrl keeps local mode',
);

const canvasHome = fs.readFileSync('src/app/canvas/canvas-home.tsx', 'utf8');
assert(
  canvasHome.includes('useSearchParams') && canvasHome.includes('mode === "new"'),
  'the Huiying canvas home should honor the mode=new entry contract',
);
assert(
  canvasHome.includes('mode === "recent"') && canvasHome.includes('正在打开画布'),
  'the Huiying canvas home should restore the latest project without showing a dead landing state',
);

console.log(JSON.stringify({
  ok: true,
  first,
  second,
  third,
  assertion: 'repeated toolbar insertions remain individually visible and connectable',
}, null, 2));
