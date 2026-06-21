import assert from 'node:assert/strict';
import { resolveSegmentFirstFrame } from '../src/lib/segmented-video-dependency-gate';

const opening = resolveSegmentFirstFrame({
  segmentIndex: 0,
  totalSegments: 2,
  materialFallbackUrl: 'https://example.invalid/material.jpg',
  strictFrameHandoff: true,
});
assert.equal(opening.dependencySatisfied, true);
assert.equal(opening.firstFrameImage, 'https://example.invalid/material.jpg');

const readyNext = resolveSegmentFirstFrame({
  segmentIndex: 1,
  totalSegments: 2,
  previousLastFrameUrl: 'https://example.invalid/last-frame.jpg',
  strictFrameHandoff: true,
});
assert.equal(readyNext.dependencySatisfied, true);
assert.equal(readyNext.firstFrameImage, 'https://example.invalid/last-frame.jpg');

const blockedNext = resolveSegmentFirstFrame({
  segmentIndex: 1,
  totalSegments: 2,
  strictFrameHandoff: true,
});
assert.equal(blockedNext.dependencySatisfied, false);
assert.match(blockedNext.reason || '', /lastFrameUrl/);

const permissiveNext = resolveSegmentFirstFrame({
  segmentIndex: 1,
  totalSegments: 2,
  strictFrameHandoff: false,
});
assert.equal(permissiveNext.dependencySatisfied, true);
assert.equal(permissiveNext.firstFrameImage, undefined);

console.log(JSON.stringify({
  ok: true,
  checks: [
    'first segment may use material fallback',
    'next segment uses previous lastFrameUrl',
    'strict handoff blocks missing lastFrameUrl',
    'non-strict compatibility path remains available',
  ],
}, null, 2));
