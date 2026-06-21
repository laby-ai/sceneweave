import {
  evaluateAssemblyShotFrameReadiness,
  type ShotFrameContract,
} from '../src/lib/production-shot-frame-contract';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validContract(index: number): ShotFrameContract {
  return {
    version: 'yh-shot-frame-contract-v1',
    reference: {
      primary: 'ViMAX',
      sourceMechanism: 'ShotDescription.ff_desc.lf_desc.visible_char_idxs.variation_type',
    },
    shotId: `shot-${index + 1}`,
    shotIndex: index,
    variationType: index === 0 ? 'large' : 'medium',
    variationReason: 'QA validates executable first/last frame contract.',
    firstFrame: {
      description: '首帧看见主角、场景和关键道具。',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-1', 'prop-1'],
      continuityAnchors: ['主角', '场景', '道具'],
    },
    lastFrame: {
      description: '尾帧保留关键道具状态，给下一段接续。',
      visibleCharacterIds: ['character-1'],
      requiredAssetIds: ['character-1', 'scene-1', 'prop-1'],
      continuityAnchors: ['主角', '场景', '道具'],
    },
    motionDescription: '主角拿起道具并改变屏幕状态。',
    audioDescription: '环境低频声持续。',
    visualStoryEvidence: {
      threatTarget: '被威胁对象在画面中可见。',
      conflictEvidence: '倒计时和失败提示必须同框出现。',
      operationResultEvidence: '主角操作后屏幕状态发生变化。',
      endingHookEvidence: '尾帧留下下一段能接住的新线索。',
      viewerReadabilityTest: '观众不看字幕也能说清谁受威胁、危险来自哪里、操作结果是什么。',
    },
    handoff: {
      requiresPreviousLastFrame: index > 0,
      previousShotId: index > 0 ? `shot-${index}` : null,
      nextShotId: `shot-${index + 2}`,
      entryContinuity: index > 0 ? '承接上一段尾帧。' : '建立人物场景道具关系。',
      exitContinuity: '保留下一段可接住的出点状态。',
    },
    readiness: {
      pass: true,
      blockers: [],
      warnings: [],
    },
  };
}

const missing = evaluateAssemblyShotFrameReadiness([
  { index: 0 },
  { index: 1, shotFrameContract: validContract(1) },
]);
assert(missing.pass === false, 'missing contract should block assembly readiness');
assert(missing.blockerCount === 1, 'missing contract blocker count mismatch');
assert(missing.issues[0]?.code === 'missing-shot-frame-contract', 'missing contract issue code mismatch');

const blocked = evaluateAssemblyShotFrameReadiness([
  {
    index: 0,
    shotFrameContract: {
      ...validContract(0),
      readiness: {
        pass: false,
        blockers: ['first-frame-missing-visible-character'],
        warnings: ['prompt-missing-威胁对象'],
      },
    },
  },
]);
assert(blocked.pass === false, 'contract blockers should block assembly readiness');
assert(blocked.blockerCount === 1, 'contract blocker count mismatch');
assert(blocked.warningCount === 1, 'contract warning count mismatch');

const passed = evaluateAssemblyShotFrameReadiness([
  { index: 0, shotFrameContract: validContract(0) },
  { index: 1, shotFrameContract: validContract(1) },
]);
assert(passed.pass === true, 'valid contracts should pass assembly readiness');
assert(passed.blockerCount === 0, 'valid contracts should have no blockers');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'missing shotFrameContract blocks readiness',
    'contract blockers propagate to assembly readiness',
    'valid shotFrameContracts pass readiness',
  ],
  missing,
  blocked,
  passed,
}, null, 2));
