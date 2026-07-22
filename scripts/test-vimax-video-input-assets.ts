import assert from 'node:assert/strict';

import { resolveVimaxVideoInputAssets } from '../src/lib/skills/vimax-short-drama/vimax-video-input-assets';

const assets = resolveVimaxVideoInputAssets({
  generatedImages: [
    { url: 'https://example.com/shot-1.png' },
    { url: 'https://example.com/shot-2.png' },
    { url: 'https://example.com/shot-3.png' },
    { url: 'https://example.com/shot-4.png' },
  ],
  assets: [
    { kind: 'shot', label: 'Clip 1', shotIndex: 1, url: 'https://example.com/shot-1.png' },
    { kind: 'shot', label: 'Clip 2', shotIndex: 2, url: 'https://example.com/shot-2.png' },
    { kind: 'shot', label: 'Clip 3', shotIndex: 3, url: 'https://example.com/shot-3.png' },
    { kind: 'shot', label: 'Clip 4', shotIndex: 4, url: 'https://example.com/shot-4.png' },
  ],
  shots: [1, 2, 3, 4].map(index => ({
    index,
    referenceUrl: `https://example.com/shot-${index}.png`,
  })),
});

assert.equal(assets.length, 4, 'recovered image URLs must not be duplicated');
assert.deepEqual(assets.map(asset => asset.kind), ['shot', 'shot', 'shot', 'shot']);
assert.deepEqual(assets.map(asset => asset.shotIndex), [1, 2, 3, 4]);
assert.deepEqual(assets.map(asset => asset.url), [1, 2, 3, 4].map(index => `https://example.com/shot-${index}.png`));

console.log('vimax video input assets: PASS');
