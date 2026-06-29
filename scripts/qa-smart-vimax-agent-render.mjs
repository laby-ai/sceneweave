import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
}

const panel = read('src/components/smart-assistant-panel.tsx');
const workspace = read('src/components/smart/smart-assistant-chat-workspace.tsx');
const generateWorkspace = read('src/components/generate/generate-workspace.tsx');
const model = read('src/lib/smart-assistant-panel-model.ts');
const route = read('src/app/api/smart/vimax-agent-step/route.ts');
// ViMAX 已抽成 Agent 驱动的 skill；编排逻辑应在 skill 内，面板只负责唤起。
const skill = read('src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill.ts');
const panelAndSkill = panel + skill;

check('chat-message-has-vimax-agent-contract', /vimaxAgent\?:/.test(model));
check('vimax-skill-is-extracted-from-panel', /useVimaxShortDramaSkill/.test(panel) && /useVimaxShortDramaSkill/.test(skill));
check('vimax-uses-real-vimax-agent-route', /\/api\/smart\/vimax-agent-step/.test(skill));
check('vimax-does-not-use-old-director-chain', !/fetch\('\/api\/smart\/director-chain'/.test(panelAndSkill));
check('vimax-has-seedream-confirm-step', /确认分镜，生成参考图/.test(panelAndSkill));
check('vimax-generate-page-uses-user-duration', /parseVimaxDurationSpec/.test(generateWorkspace) && /segmentDuration: durationSpec\.segmentDuration/.test(generateWorkspace) && /segmentCount: durationSpec\.segmentCount/.test(generateWorkspace) && !/handlePlanStep\(\{\s*prompt:\s*text,\s*duration:\s*60/.test(generateWorkspace));
check('workspace-renders-stage-card', /msg\.vimaxAgent/.test(workspace) && /真实 AgentPlan/.test(workspace) && /Seedream 参考素材/.test(workspace));
check('route-calls-real-ark-text-model', /chat\/completions/.test(route) && /ARK_API_KEY/.test(route) && /usedRealKey:\s*true/.test(route));
check('route-calls-real-seedream-image-model', /images\/generations/.test(route) && /doubao-seedream-5\.0-lite/.test(route));
check('route-does-not-return-free-fake-result', !/usedRealKey:\s*false|incurredCost:\s*false|dry-run|不产生费用/.test(route));
check('route-fails-explicitly-before-video-cost', /视频生成阶段需要用户在界面显式确认费用/.test(route));
check(
  'route-uses-embedded-vimax-production-pipeline',
  /buildProductionProject/.test(route)
    && /buildProductionAssemblyPlan/.test(route)
    && /generateShotsFromUserPrompt/.test(route)
    && /buildProductionBackedVimaxPlan/.test(route)
    && /ViMAX ShotFrameContract/.test(route)
    && /ViMAX Variation/.test(route),
  'short-drama skill must not bypass the embedded ViMAX-style production artifacts',
);
check('route-honors-requested-vimax-segment-count', /segmentCount\?: number/.test(route) && /targetSegmentCount/.test(route) && /Array\.from\(\{ length: targetSegmentCount \}/.test(route));
check(
  'route-uses-sequential-last-frame-handoff',
  /previousLastFrameUrl/.test(route)
    && /ensureSeedanceLastFrame/.test(route)
    && /extractLastFrameForHandoff/.test(route)
    && !/Promise\.all\(submitted\.map\(task => pollSeedanceShotTask/.test(route),
  'video stage must not submit all shots before previous tail frames exist',
);

const failed = checks.filter(item => !item.pass);
const result = {
  ok: failed.length === 0,
  script: 'qa-smart-vimax-agent-render',
  checks,
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
