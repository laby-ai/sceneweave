import assert from 'node:assert/strict';

import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';
import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import {
  buildVimaxContinuityContract,
  buildVimaxContinuityPrompt,
  resolveVimaxProviderHandoffMode,
} from '../src/lib/skills/vimax-short-drama/vimax-continuity-contract';

const basePlan: VimaxAgentPlan = {
  title: '雨夜录音笔',
  summary: '同一位穿蓝色风衣的女记者在雨夜车站追查红色录音笔。',
  assets: [
    { kind: 'character', label: '女记者', prompt: '短发，蓝色风衣，始终手持红色录音笔' },
    { kind: 'scene', label: '雨夜车站', prompt: '冷蓝顶灯，湿地反光，站台由左向右延伸' },
    { kind: 'prop', label: '红色录音笔', prompt: '红色金属录音笔，指示灯常亮' },
  ],
  shots: [
    { index: 1, title: '发现', duration: 5, camera: '中景向右跟拍', prompt: '女记者从画面左侧走向右侧长椅，发现红色录音笔。' },
    { index: 2, title: '拾取', duration: 5, camera: '近景保持轴线', prompt: '承接上一镜终态，女记者右手拾起红色录音笔，身体仍朝画面右侧。' },
    { index: 3, title: '追踪', duration: 5, camera: '全景向右跟拍', prompt: '承接拾取动作，女记者握住录音笔向站台右侧追去。' },
  ],
  nextAction: '确认连续性后生成。',
};

const built = buildProductionBackedVimaxPlan(basePlan.summary, basePlan, {
  phase: 'plan',
  duration: 15,
  segmentDuration: 5,
  segmentCount: 3,
  ratio: '16:9',
  resolution: '720p',
  sceneType: 'drama',
  style: '冷蓝雨夜电影感',
  skillId: 'short-drama',
}, 'continuity-fixture-task');

const textMode = resolveVimaxProviderHandoffMode({
  provider: 'happyhorse-dashscope',
  model: 'happyhorse-1.1-t2v',
});
assert.equal(textMode.mode, 'text-anchors');
assert.equal(textMode.supportsFirstFrame, false);

const textContract = buildVimaxContinuityContract({
  productionProject: built.productionProject,
  assemblyPlan: built.assemblyPlan,
  providerHandoff: textMode,
});
assert.equal(textContract.version, 'sceneweave-continuity-contract-v1');
assert.equal(textContract.providerHandoff.mode, 'text-anchors');
assert.equal(textContract.shots.length, 3);
assert.equal(textContract.shots[0]?.previousShotId, null);
assert.equal(textContract.shots[1]?.previousShotId, textContract.shots[0]?.shotId);
assert.ok(textContract.subjectBible.length > 0);
assert.ok(textContract.scene.length > 0);
assert.ok(textContract.props.length > 0);
assert.ok(textContract.shots.every(shot => shot.actionStart && shot.actionEnd));
assert.ok(textContract.shots.every(shot => shot.framing && shot.lightingPalette && shot.audioCue));

const secondTextPrompt = buildVimaxContinuityPrompt(textContract, 1);
assert.match(secondTextPrompt, /【供应商交接】仅文本锚点/);
assert.match(secondTextPrompt, /【动作衔接】/);
assert.match(secondTextPrompt, /【空间与构图】/);
assert.match(secondTextPrompt, /【叙事因果】/);
assert.doesNotMatch(secondTextPrompt, /已绑定上一段尾帧/);

const frameMode = resolveVimaxProviderHandoffMode({
  provider: 'ark-video-v3',
  model: 'doubao-seedance-1-5-pro-251215',
});
assert.equal(frameMode.mode, 'frame-handoff');
assert.equal(frameMode.supportsFirstFrame, true);
const frameContract = buildVimaxContinuityContract({
  productionProject: built.productionProject,
  assemblyPlan: built.assemblyPlan,
  providerHandoff: frameMode,
});
const secondFramePrompt = buildVimaxContinuityPrompt(frameContract, 1);
assert.match(secondFramePrompt, /【供应商交接】首帧交接/);
assert.match(secondFramePrompt, /上一镜尾帧/);

console.log(JSON.stringify({
  ok: true,
  path: 'productionProject -> assemblyPlan -> provider handoff -> continuity prompt',
  textMode: textContract.providerHandoff.mode,
  frameMode: frameContract.providerHandoff.mode,
  shots: textContract.shots.length,
}));
