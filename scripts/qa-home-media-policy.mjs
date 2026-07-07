import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homeSectionPath = path.join(root, 'src', 'components', 'home', 'dreambox-home-section.tsx');
const mainContentPath = path.join(root, 'src', 'components', 'home', 'dreambox-main-content.tsx');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

const homeSection = read(homeSectionPath);
const mainContent = read(mainContentPath);

const forbiddenHomeMediaPatterns = [
  { name: 'home-gallery-video-autoplay', pattern: /\bautoPlay\b/ },
  { name: 'home-gallery-video-preload-auto', pattern: /preload=["']auto["']/ },
];

const hardViolations = [];
for (const rule of forbiddenHomeMediaPatterns) {
  if (rule.pattern.test(homeSection)) {
    hardViolations.push({
      file: 'src/components/home/dreambox-home-section.tsx',
      rule: rule.name,
      message: 'Home gallery media must not eagerly start video network/decode work.',
    });
  }
}

const videoTagCount = countMatches(homeSection, /<video\b/g);
const preloadNoneCount = countMatches(homeSection, /preload=["']none["']/g);
const lazyImageCount = countMatches(homeSection, /loading=["']lazy["']/g);
const eagerImageCount = countMatches(homeSection, /loading=["']eager["']/g);
const asyncDecodeCount = countMatches(homeSection, /decoding=["']async["']/g);

assert(videoTagCount >= 1, 'home gallery should still render video cards');
assert(preloadNoneCount >= videoTagCount, 'every home gallery video must use preload="none"');
assert(homeSection.includes('onMouseEnter={(event) =>'), 'home gallery video preview should start on hover');
assert(homeSection.includes('onMouseLeave={(event) =>'), 'home gallery video preview should stop on hover leave');
assert(lazyImageCount >= 1, 'non-hero home gallery images must use loading="lazy"');
assert(eagerImageCount >= 1, 'hero image should stay eager for first viewport rendering');
assert(asyncDecodeCount >= 2, 'hero and gallery images should use async decoding');

const dynamicWorkspaceLoaders = [
  'loadAIVideoCreationPanel',
  'loadFilmCreationPanel',
  'loadImageCreationPanel',
  'loadGenerateWorkspace',
  'loadAssetsLibrary',
  'loadAvatarGenerator',
  'loadVoiceGenerator',
];

for (const loader of dynamicWorkspaceLoaders) {
  assert(mainContent.includes(`const ${loader} = () => import(`), `missing dynamic workspace loader: ${loader}`);
  assert(mainContent.includes(`dynamic(${loader}`), `workspace loader is not wired to next/dynamic: ${loader}`);
}

for (const staticImport of [
  "import AIVideoCreationPanel from '@/components/ai-video-creation-panel'",
  "import { FilmCreationPanel } from '@/components/film-creation-panel'",
  "import { ImageCreationPanel } from '@/components/image-creation-panel'",
  "import { GenerateWorkspace } from '@/components/generate/generate-workspace'",
  "import { AssetsLibrary } from '@/components/assets/assets-library'",
  "import { AvatarGenerator } from '@/components/avatar/AvatarGenerator'",
  "import { VoiceGenerator } from '@/components/voice/voice-generator'",
]) {
  if (mainContent.includes(staticImport)) {
    hardViolations.push({
      file: 'src/components/home/dreambox-main-content.tsx',
      rule: 'home-workspace-static-import',
      message: `Heavy workspace should remain dynamically loaded: ${staticImport}`,
    });
  }
}

if (hardViolations.length > 0) {
  console.log(JSON.stringify({ ok: false, hardViolations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedFiles: [
    'src/components/home/dreambox-home-section.tsx',
    'src/components/home/dreambox-main-content.tsx',
  ],
  videoTagCount,
  preloadNoneCount,
  lazyImageCount,
  eagerImageCount,
  asyncDecodeCount,
  dynamicWorkspaceLoaderCount: dynamicWorkspaceLoaders.length,
}, null, 2));
