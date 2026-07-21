import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('src/components/creation-agent/vimax-creation-agent-shell.tsx', 'utf8');
const home = readFileSync('src/components/generate/vimax-project-home.tsx', 'utf8');
const workspace = readFileSync('src/components/generate/generate-workspace.tsx', 'utf8');
const account = readFileSync('src/components/home/account-status-button.tsx', 'utf8');
const nextConfig = readFileSync('next.config.ts', 'utf8');
const storyReel = readFileSync('public/home/huiying-creation-agent-story-reel.png');

assert.match(shell, /AccountStatusButton/);
assert.match(shell, /BailianConnectionControl/);
assert.match(shell, /\/brand\/huiying-logo-icon\.png/);
assert.match(shell, /showModelSettings=\{false\}/);
assert.match(shell, /data-testid="creation-agent-header-inner"/);
assert.match(shell, /max-w-\[1320px\]/);

assert.match(home, /data-testid="creation-agent-hero"/);
assert.match(home, /data-testid="creation-agent-page-background"/);
assert.match(home, /huiying-creation-agent-story-reel\.png/);
assert.doesNotMatch(home, /huiying-hero-cosmic-reel-v2\.png/);
assert.doesNotMatch(home, /huiying-hero-cinematic-flow\.png/);
assert.match(home, /backgroundPreview/);
assert.doesNotMatch(home, /heroPreview/);
assert.equal((home.match(/quality: width >= 1080 \? 68 : 58/g) || []).length, 1);
assert.match(home, /object-\[52%_center\]/);
assert.match(home, /sm:object-center/);
assert.match(home, /\[mask-image:linear-gradient/);
assert.match(home, /data-testid="creation-agent-brand-mark"/);
assert.match(home, /data-testid="creation-agent-main-stage"/);
assert.doesNotMatch(home, /data-testid="creation-agent-hero-fade"/);
assert.match(home, /data-testid="vimax-project-empty-state"/);
assert.match(home, /min-h-\[112px\]/);

assert.match(workspace, /showModelSettings\?: boolean/);
assert.match(workspace, /showModelSettings = true/);
assert.match(workspace, /showModelSettings \? <BailianConnectionControl \/> : null/);
assert.match(workspace, /if \(workspaceView !== 'project'\) return;/);
assert.match(workspace, /data-testid="creation-agent-composer"/);

assert.match(account, /variant\?: 'rail' \| 'header'/);
assert.match(account, /variant = 'rail'/);
assert.match(account, /variant === 'header'/);

assert.match(nextConfig, /source: '\/'/);
assert.match(nextConfig, /destination: '\/embed\/creation-agent'/);
assert.match(nextConfig, /permanent: false/);

assert.equal(storyReel.subarray(1, 4).toString('ascii'), 'PNG');
assert.ok(storyReel.length > 1_500_000, 'story reel must remain a full-resolution source asset');

console.log('creation agent layout contract: ok');
