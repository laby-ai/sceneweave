import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildPublicMediaCandidate } from '../src/lib/media-library-preview';

assert.deepEqual(
  buildPublicMediaCandidate(
    '/opt/huiying/releases/huiying-main-abc/public/home/hero image.png',
    '/opt/huiying/current/public',
    '/huiying',
  ),
  {
    filePath: path.join('/opt/huiying/current/public', 'home', 'hero image.png'),
    url: '/huiying/home/hero%20image.png',
  },
  'release-specific public assets should resolve through the current public tree',
);

assert.equal(
  buildPublicMediaCandidate('/opt/huiying/shared/private/frame.png', '/opt/huiying/current/public', '/huiying'),
  undefined,
  'paths outside a public tree must not become public URLs',
);

const homeSource = fs.readFileSync(path.join(process.cwd(), 'src/app/DreamboxHome.tsx'), 'utf8');
const assetsSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/assets/assets-library.tsx'),
  'utf8',
);
const libraryRouteSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/assets/media-library/route.ts'),
  'utf8',
);
const posterRouteSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/assets/video-poster/route.ts'),
  'utf8',
);
const homeSectionSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/home/dreambox-home-section.tsx'),
  'utf8',
);

assert.match(homeSource, /src: asset\.poster \|\| asset\.url/);
assert.match(assetsSource, /src=\{asset\.poster \|\| asset\.url\}/);
assert.match(assetsSource, /loading="lazy"\s+decoding="async"/);
assert.match(assetsSource, /poster=\{asset\.poster\}[\s\S]*?preload="none"/);
assert.match(libraryRouteSource, /buildPublicMediaCandidate/);
assert.match(libraryRouteSource, /await fs\.stat\(publicCandidate\.filePath\)/);
assert.match(posterRouteSource, /from 'ffmpeg-static'/);
assert.match(homeSectionSource, /poster=\{previewImage\(item\.src, 256\)\}/);
assert.match(homeSectionSource, /src=\{previewImage\(item\.src, 256\)\}/);
assert.doesNotMatch(
  posterRouteSource,
  /execFileAsync\(\s*'ffmpeg'/,
  'video posters must use the packaged ffmpeg binary instead of a missing host command',
);

console.log('media library preview fast path contract passed');
