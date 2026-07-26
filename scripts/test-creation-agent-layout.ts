import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('src/components/creation-agent/vimax-creation-agent-shell.tsx', 'utf8');
const home = readFileSync('src/components/generate/vimax-project-home.tsx', 'utf8');
const workspace = readFileSync('src/components/generate/generate-workspace.tsx', 'utf8');
const imagePanel = readFileSync('src/components/image-creation-panel.tsx', 'utf8');
const account = readFileSync('src/components/home/account-status-button.tsx', 'utf8');
const nextConfig = readFileSync('next.config.ts', 'utf8');

assert.match(shell, /AccountStatusButton/);
assert.match(shell, /BailianConnectionControl/);
assert.match(shell, /\/brand\/huiying-logo-icon\.png/);
assert.match(shell, /showModelSettings=\{false\}/);
assert.match(shell, /data-testid="creation-agent-header-inner"/);
assert.match(shell, /max-w-\[1320px\]/);
assert.match(shell, /ImageCreationPanel/);
assert.match(shell, /availableModes=\{\['agent', 'image', 'video'\]\}/);
assert.match(shell, /data-testid="creation-agent-image-workspace"/);
assert.match(shell, /autoGenerate=\{false\}/);

assert.match(home, /data-testid="creation-agent-hero"/);
assert.match(home, /data-testid="creation-agent-page-background"/);
assert.match(home, /huiying-hero-cosmic-reel-v2\.png/);
assert.doesNotMatch(home, /huiying-hero-cinematic-flow\.png/);
assert.match(home, /backgroundPreview/);
assert.doesNotMatch(home, /heroPreview/);
assert.equal((home.match(/quality: width >= 1080 \? 68 : 58/g) || []).length, 1);
assert.match(home, /object-\[70%_center\]/);
assert.match(home, /sm:object-\[68%_center\]/);
assert.match(home, /\[mask-image:linear-gradient/);
assert.match(home, /data-testid="creation-agent-brand-mark"/);
assert.match(home, /data-testid="creation-agent-main-stage"/);
assert.doesNotMatch(home, /data-testid="creation-agent-hero-fade"/);
assert.match(home, /data-testid="vimax-project-empty-state"/);
assert.match(home, /min-h-\[112px\]/);

assert.match(workspace, /showModelSettings\?: boolean/);
assert.match(workspace, /showModelSettings = true/);
assert.match(workspace, /showModelSettings \? <BailianConnectionControl \/> : null/);
assert.match(workspace, /availableModes\?: CreationMode\[\]/);
assert.match(workspace, /visibleCreationModes/);
assert.match(workspace, /mode === 'agent' \|\| mode === 'video'/);
assert.match(workspace, /activateVideoCreationMode/);
assert.match(workspace, /saveVimaxSkillPreset\(localStorage, skillScope, 'short-drama'\)/);
assert.doesNotMatch(workspace, /\{ id: 'video',[^\n]+section: 'video'/);
assert.doesNotMatch(workspace, /\{ id: 'voice',[^\n]+配音生成/);
assert.doesNotMatch(workspace, /\{ id: 'avatar',[^\n]+数字人/);
assert.doesNotMatch(workspace, /当前可使用 Agent 模式、图片 \/ 视频 \/ 配音/);
assert.match(workspace, /imageRefs: selectedReferences\.map\(reference => reference\.imageUrl\)/);
assert.match(workspace, /if \(workspaceView !== 'project'\) return;/);
assert.match(workspace, /data-testid="creation-agent-composer"/);
assert.doesNotMatch(workspace, /aria-label="参考图用途"/);
assert.doesNotMatch(workspace, /title="添加主体"/);
assert.doesNotMatch(workspace, /@ 添加主体/);
assert.match(workspace, /placeholder="写下故事、粘贴剧本，或上传参考素材"/);
assert.match(workspace, /bottom-full left-0 z-20 mb-2 w-80 max-w-\[calc\(100vw-3rem\)\]/);
assert.match(home, /把故事讲给绘影/);
assert.match(home, /绘影会先和你确认，再开始制作/);
assert.match(imagePanel, /aria-label="返回创作智能体"/);
assert.match(imagePanel, /aria-label="图片创作工作区"/);
assert.match(imagePanel, /data-testid="image-settings-panel"/);
assert.match(imagePanel, /data-testid="image-results-panel"/);
assert.match(imagePanel, /data-testid="image-assistant-panel"/);
assert.match(imagePanel, /lg:w-\[280px\]/);
assert.match(imagePanel, /lg:w-\[320px\]/);

assert.match(account, /variant\?: 'rail' \| 'header'/);
assert.match(account, /variant = 'rail'/);
assert.match(account, /variant === 'header'/);

assert.match(nextConfig, /source: '\/'/);
assert.match(nextConfig, /destination: '\/embed\/creation-agent'/);
assert.match(nextConfig, /permanent: false/);

console.log('creation agent layout contract: ok');
