import {
  buildBYOKVideoSubmitParams,
  clampVideoSubmitDuration,
} from '../src/lib/video-submit-provider';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(clampVideoSubmitDuration(3) === 5, 'duration should clamp up to 5');
assert(clampVideoSubmitDuration(9) === 9, 'duration should keep valid value');
assert(clampVideoSubmitDuration(30) === 10, 'duration should clamp down to 10');
assert(clampVideoSubmitDuration('bad') === 5, 'invalid duration should default to 5');

const withExplicitFirstFrame = buildBYOKVideoSubmitParams({
  prompt: '  A clear trailer shot.  ',
  videoModel: 'doubao-seedance-1-5-pro-251215',
  duration: 60,
  firstFrameUrl: 'https://example.com/first.png',
  inputLastFrameUrl: 'https://example.com/last.png',
  materials: ['https://example.com/material.png'],
  characterRefUrls: [
    'https://example.com/ref1.png',
    'https://example.com/ref2.png',
    'https://example.com/ref3.png',
    'https://example.com/ref4.png',
  ],
});

assert(withExplicitFirstFrame.prompt === 'A clear trailer shot.', 'prompt should be trimmed');
assert(withExplicitFirstFrame.model === 'doubao-seedance-1-5-pro-251215', 'video model mismatch');
assert(withExplicitFirstFrame.duration === 10, 'duration should be provider-safe');
assert(withExplicitFirstFrame.ratio === '16:9', 'ratio should default to 16:9');
assert(withExplicitFirstFrame.firstFrameImage === 'https://example.com/first.png', 'explicit first frame should win');
assert(withExplicitFirstFrame.lastFrameImage === 'https://example.com/last.png', 'last frame should be preserved');
assert(withExplicitFirstFrame.referenceImages?.length === 3, 'reference images should be capped to 3');

const withMaterialFallback = buildBYOKVideoSubmitParams({
  prompt: 'Fallback first frame',
  duration: 6,
  ratio: '9:16',
  materials: ['https://example.com/material-first.png'],
});

assert(withMaterialFallback.firstFrameImage === 'https://example.com/material-first.png', 'material should become first frame fallback');
assert(withMaterialFallback.ratio === '9:16', 'explicit ratio should be preserved');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'duration-clamp',
    'prompt-trim',
    'first-frame-priority',
    'last-frame-preserved',
    'reference-images-capped',
    'material-first-frame-fallback',
  ],
}, null, 2));
