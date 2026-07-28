import fs from 'node:fs';
import path from 'node:path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/production-segment-start.ts'),
  'utf8'
);
const recoverableFailureBlock = source.slice(
  source.indexOf('if (providerTaskId || partialVideoUrl || partialLastFrameUrl)'),
  source.indexOf('export function startProductionAssemblySegment')
);

assert(recoverableFailureBlock.length > 0, 'recoverable provider failure block is missing');
assert(
  (recoverableFailureBlock.match(/storyStateCue:\s*segmentStoryStateCue\(segment\)/g) || []).length >= 3,
  'recoverable output must preserve storyStateCue in child, child segment, and parent writeback'
);
assert(
  recoverableFailureBlock.includes('partialVideoUrl') &&
    recoverableFailureBlock.includes('partialLastFrameUrl') &&
    recoverableFailureBlock.includes('providerTaskId'),
  'recoverable output must preserve provider video, tail frame, and task identity'
);

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'recoverable-child-story-state-preserved',
    'recoverable-child-segment-story-state-preserved',
    'recoverable-parent-story-state-preserved',
    'provider-video-tail-and-task-id-preserved',
  ],
}, null, 2));
