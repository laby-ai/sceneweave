import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildMediaPreviewImageUrl } from '../src/lib/media-preview';

const optimized = buildMediaPreviewImageUrl(
  'https://media.example.com/generated/frame.png?token=opaque',
  { width: 640, quality: 58, basePath: '/huiying' },
);

assert.equal(
  optimized,
  '/huiying/_next/image?url=https%3A%2F%2Fmedia.example.com%2Fgenerated%2Fframe.png%3Ftoken%3Dopaque&w=640&q=58',
  'remote previews should use the base-path-aware Next image optimizer',
);
assert.equal(
  buildMediaPreviewImageUrl('blob:http://localhost/frame', { width: 256 }),
  'blob:http://localhost/frame',
  'browser-local previews must bypass the server optimizer',
);
assert.equal(
  buildMediaPreviewImageUrl('data:image/png;base64,abc', { width: 256 }),
  'data:image/png;base64,abc',
  'inline previews must bypass the server optimizer',
);
assert.equal(
  buildMediaPreviewImageUrl('/huiying/api/assets/video-poster?path=opaque', { width: 640, basePath: '/huiying' }),
  '/huiying/api/assets/video-poster?path=opaque',
  'runtime media routes already provide preview bytes and must bypass recursive optimization',
);

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/film/film-main-stage-workspace.tsx'),
  'utf8',
);
const homeSource = fs.readFileSync(path.join(process.cwd(), 'src/app/DreamboxHome.tsx'), 'utf8');
const homeSectionSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/home/dreambox-home-section.tsx'),
  'utf8',
);
const nextConfigSource = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');

assert.match(workspaceSource, /poster=\{previewImage\(card\.startFrameUrl \|\| card\.imageUrl/);
assert.match(workspaceSource, /controls\s+preload="metadata"\s+playsInline/);
assert.match(workspaceSource, /card\.type === 'shot' && card\.videoUrl/);
assert.doesNotMatch(
  workspaceSource,
  /<video src=\{card\.videoUrl\}[^>]*preload="none"/,
  'completed shot previews must not suppress all video metadata',
);

assert.match(homeSource, /videoSrc: '\/home\/huiying-ark-test-clip-preview\.mp4'/);
assert.match(homeSectionSource, /src=\{previewImage\(item\.src/);
assert.match(homeSectionSource, /poster=\{previewImage\(item\.src/);
assert.match(homeSectionSource, /autoPlay=\{item\.source === 'static'\}/);
assert.match(nextConfigSource, /qualities:\s*\[54, 58, 68\]/);

const previewVideoPath = path.join(process.cwd(), 'public/home/huiying-ark-test-clip-preview.mp4');
const previewVideoSize = fs.statSync(previewVideoPath).size;
assert.ok(previewVideoSize > 50_000, 'preview video must contain real media bytes');
assert.ok(previewVideoSize < 1_500_000, 'preview video should stay lightweight');

console.log('film media preview contract passed');
