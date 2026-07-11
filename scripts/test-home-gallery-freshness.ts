import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  homeGalleryPreviewSizes,
  mediaFreshnessBonus,
  selectHomeGalleryPreviewWidth,
} from '../src/lib/home-gallery-media';

assert.equal(selectHomeGalleryPreviewWidth('col-span-2 row-span-2'), 640);
assert.equal(selectHomeGalleryPreviewWidth('row-span-2'), 256);
assert.match(homeGalleryPreviewSizes('col-span-2 row-span-2'), /100vw/);
assert.match(homeGalleryPreviewSizes('row-span-2'), /50vw/);

const now = Date.parse('2026-07-11T00:00:00Z');
assert.equal(
  mediaFreshnessBonus('/opt/huiying/current/public/generated/new-shot.mp4', '2026-07-10T00:00:00Z', now),
  500,
  'new generated assets must outrank fixed showcase names',
);
assert.equal(
  mediaFreshnessBonus('/opt/huiying/current/public/generated/old-shot.mp4', '2025-01-01T00:00:00Z', now),
  0,
  'old generated assets should not receive a freshness boost',
);
assert.equal(
  mediaFreshnessBonus('/opt/huiying/current/public/home/fixed-hero.png', '2026-07-11T00:00:00Z', now),
  0,
  'release extraction timestamps must not make fixed home art look newly generated',
);

const homeSectionSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/home/dreambox-home-section.tsx'),
  'utf8',
);
const mediaRouteSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/assets/media-library/route.ts'),
  'utf8',
);

assert.match(homeSectionSource, /srcSet=\{galleryPreviewSrcSet\(item\.src\)\}/);
assert.match(homeSectionSource, /sizes=\{homeGalleryPreviewSizes\(item\.span\)\}/);
assert.match(homeSectionSource, /selectHomeGalleryPreviewWidth\(item\.span\)/);
assert.match(mediaRouteSource, /score \+= mediaFreshnessBonus\(/);

console.log('home gallery responsive freshness contract passed');
