#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { getTrailerScriptPreset } from './trailer-script-presets.mjs';

const root = process.cwd();
const outDir = path.join(root, 'artifacts/60s-golden-case');
const outFile = path.join(outDir, 'current.json');

const sourceFiles = {
  trailerPreset: 'scripts/trailer-script-presets.mjs',
  trailerBeatSheet: 'src/lib/trailer-beat-sheet.ts',
  assemblyPlan: 'src/lib/production-assembly-plan.ts',
  storyGate: 'scripts/qa-story-aware-video-gate.mjs',
  semanticReview: 'scripts/qa-60s-semantic-review.mjs',
  semanticLabels: 'artifacts/60s-semantic-review/huiying-case-videotape-60s-labels.json',
  vimaxStoryboard: 'references/ViMax/agents/storyboard_artist.py',
  vimaxScriptPlanner: 'references/ViMax/agents/script_planner.py',
  arcReelStoryboardSequence: 'references/_git-clones/ArcReel/lib/storyboard_sequence.py',
};

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

function pass(name, weight, ok, detail = {}) {
  return { name, weight, pass: Boolean(ok), ...detail };
}

function hasAll(text, patterns) {
  return patterns.every(pattern => pattern.test(text));
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function countBeatsMatching(beats, patterns) {
  return beats.filter(beat => hasAny(beat, patterns)).length;
}

function allBeatsContain(beats, labels) {
  return beats.every(beat => labels.every(label => beat.includes(label)));
}

function extractChineseLabelValue(beat, label) {
  const labels = [
    '段落职能',
    '本段唯一信息',
    '独有动作',
    '画面证据',
    '威胁对象',
    '危险源',
    '操作结果',
    '下一段钩子',
  ];
  const escaped = labels.map(item => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = beat.match(new RegExp(`${label}：([\\s\\S]*?)(?=；(?:${escaped})：|。(?:${escaped})：|$)`));
  return match ? match[1].replace(/[。；\s]+$/g, '').trim() : '';
}

function uniqueLabelCount(beats, label) {
  return new Set(beats.map(beat => extractChineseLabelValue(beat, label)).filter(Boolean)).size;
}

function meaningfulTokens(text) {
  const stripped = text
    .replace(/(段落职能|本段唯一信息|独有动作|画面证据|威胁对象|危险源|操作结果|下一段钩子)：/g, '')
    .replace(/[0-9]+-[0-9]+s/g, '')
    .replace(/[，。；：、“”‘’（）()《》\s]/g, '');
  const tokens = [];
  for (let index = 0; index < stripped.length - 1; index += 1) {
    tokens.push(stripped.slice(index, index + 2));
  }
  return new Set(tokens);
}

function jaccardSimilarity(a, b) {
  const left = meaningfulTokens(a);
  const right = meaningfulTokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function maxAdjacentSimilarity(beats) {
  let max = 0;
  for (let index = 1; index < beats.length; index += 1) {
    max = Math.max(max, jaccardSimilarity(beats[index - 1], beats[index]));
  }
  return Number(max.toFixed(3));
}

function extractLabelsSummary(labelText) {
  if (!labelText.trim()) {
    return {
      labelsPresent: false,
      storyReadableWithoutText: null,
      failedCriticalStoryChecks: [],
    };
  }
  try {
    const labels = JSON.parse(labelText);
    const overall = labels.overall || {};
    const failedCriticalStoryChecks = [
      ['goal-readable-without-text', overall.goalReadableWithoutText],
      ['conflict-readable-without-text', overall.conflictReadableWithoutText],
      ['turning-point-readable-without-text', overall.turningPointReadableWithoutText],
      ['ending-hook-readable-without-text', overall.endingHookReadableWithoutText],
    ]
      .filter(([, ok]) => ok === false)
      .map(([name]) => name);
    return {
      labelsPresent: true,
      storyReadableWithoutText: failedCriticalStoryChecks.length === 0
        && overall.goalReadableWithoutText === true
        && overall.conflictReadableWithoutText === true
        && overall.turningPointReadableWithoutText === true
        && overall.endingHookReadableWithoutText === true,
      failedCriticalStoryChecks,
    };
  } catch {
    return {
      labelsPresent: true,
      storyReadableWithoutText: null,
      failedCriticalStoryChecks: ['labels-json-parse-failed'],
    };
  }
}

const preset = getTrailerScriptPreset('last-train', 60);
const trailerPresetText = read(sourceFiles.trailerPreset);
const trailerBeatSheetText = read(sourceFiles.trailerBeatSheet);
const assemblyPlanText = read(sourceFiles.assemblyPlan);
const storyGateText = read(sourceFiles.storyGate);
const semanticReviewText = read(sourceFiles.semanticReview);
const semanticLabelText = read(sourceFiles.semanticLabels);
const vimaxStoryboardText = read(sourceFiles.vimaxStoryboard);
const vimaxScriptPlannerText = read(sourceFiles.vimaxScriptPlanner);
const arcReelStoryboardText = read(sourceFiles.arcReelStoryboardSequence);
const labelsSummary = extractLabelsSummary(semanticLabelText);

const beatText = preset.beats.join('\n');
const visualAnchorText = preset.visualAnchors.join('、');
const forbiddenAbstract = /宇宙胶片|抽象流光|纯氛围|无意义素材|借用IP|二创|知名角色/i;
const adjacentBeatSimilarity = maxAdjacentSimilarity(preset.beats);

const checks = [
  pass(
    'golden-case-last-train-60s-locked',
    10,
    preset.id === 'last-train'
      && preset.duration === 60
      && preset.title === '最后一班列车'
      && preset.beats.length === 7,
    {
      presetId: preset.id,
      duration: preset.duration,
      beatCount: preset.beats.length,
    },
  ),
  pass(
    'golden-case-has-visible-anchors',
    10,
    ['暴雨车站', '年轻急救员', '红色书包', '旧桥警报屏', '最后一班列车']
      .every(anchor => visualAnchorText.includes(anchor)),
    { visualAnchors: preset.visualAnchors },
  ),
  pass(
    '60s-beats-cover-trailer-arc',
    15,
    hasAll(beatText, [
      /冷开场|暴雨车站/,
      /主角|目标|急救员/,
      /障碍|控制台故障|警报/,
      /行动推进|手电|信号旗/,
      /反转|孩子.*列车/,
      /最强.*moment|维护车|钢索断裂/,
      /悬念|对讲机再次响起/,
    ]),
  ),
  pass(
    '60s-beats-show-threat-target-danger-result-hook',
    15,
    countBeatsMatching(preset.beats, [/孩子|列车|旧桥|车厢/]) >= 4
      && countBeatsMatching(preset.beats, [/警报|断电|故障|坍塌|钢索断裂|危险|桥/]) >= 4
      && countBeatsMatching(preset.beats, [/按下|试图|跳上|追赶|冲到|发现|拉开|驾驶|急停|捡起|回头/]) >= 4
      && /我不在这辆车上|孩子的影子|警报屏突然熄灭|桥上警示灯全部熄灭/.test(beatText),
    {
      threatTargetBeatCount: countBeatsMatching(preset.beats, [/孩子|列车|旧桥|车厢/]),
      dangerBeatCount: countBeatsMatching(preset.beats, [/警报|断电|故障|坍塌|钢索断裂|危险|桥/]),
      operationBeatCount: countBeatsMatching(preset.beats, [/按下|试图|跳上|追赶|冲到|发现|拉开|驾驶|急停|捡起|回头/]),
    },
  ),
  pass(
    '60s-each-beat-has-visible-causality-handoff',
    15,
    allBeatsContain(preset.beats, ['段落职能：', '本段唯一信息：', '独有动作：', '画面证据：', '威胁对象：', '危险源：', '操作结果：', '下一段钩子：'])
      && hasAll(beatText, [
        /孩子的第一声求救/,
        /站长室控制台还亮着/,
        /倒计时牌开始倒数/,
        /第三节车厢/,
        /维护车钥匙/,
        /红色书包.*滑落/,
        /我不在这辆车上/,
      ]),
    {
      requiredLabels: ['段落职能：', '本段唯一信息：', '独有动作：', '画面证据：', '威胁对象：', '危险源：', '操作结果：', '下一段钩子：'],
      beatCount: preset.beats.length,
    },
  ),
  pass(
    '60s-beats-are-not-repetitive-ledger',
    20,
    uniqueLabelCount(preset.beats, '段落职能') === preset.beats.length
      && uniqueLabelCount(preset.beats, '本段唯一信息') === preset.beats.length
      && uniqueLabelCount(preset.beats, '独有动作') === preset.beats.length
      && hasAll(beatText, [
        /异常入场/,
        /人物接棒/,
        /第一次失败/,
        /身体冒险/,
        /线索改向/,
        /高风险追赶/,
        /二次反转钩子/,
      ])
      && adjacentBeatSimilarity < 0.45,
    {
      uniqueNarrativeFunctionCount: uniqueLabelCount(preset.beats, '段落职能'),
      uniqueInformationDeltaCount: uniqueLabelCount(preset.beats, '本段唯一信息'),
      uniqueActionCount: uniqueLabelCount(preset.beats, '独有动作'),
      maxAdjacentSimilarity: adjacentBeatSimilarity,
      threshold: 0.45,
    },
  ),
  pass(
    '60s-prompt-blocks-abstract-placeholder-video',
    5,
    /不要生成抽象空镜、纯氛围蒙太奇或无关宇宙胶片/.test(preset.prompt)
      && !forbiddenAbstract.test(beatText),
  ),
  pass(
    'vimax-demo-behavior-storyboard-readable-shots',
    10,
    hasAll(vimaxStoryboardText, [
      /clear narrative purpose/i,
      /Narrative Continuity/i,
      /position of the element within the frame/i,
      /first frame/i,
      /last frame/i,
      /Motion Description/i,
    ]),
  ),
  pass(
    'vimax-demo-behavior-emotional-arc-is-visual',
    10,
    hasAll(vimaxScriptPlannerText, [
      /emotional arc/i,
      /explicit changes in emotional state/i,
      /Visual Clarity Over Action/i,
      /No metaphors allowed/i,
    ]),
  ),
  pass(
    'arcreel-demo-behavior-previous-storyboard-dependency',
    10,
    hasAll(arcReelStoryboardText, [
      /StoryboardTaskPlan/,
      /dependency_resource_id/,
      /PREVIOUS_STORYBOARD_REFERENCE_LABEL/,
      /previous_resource_id/,
      /dependency_index/,
    ]),
  ),
  pass(
    'huiying-beat-sheet-enforces-viewer-readable-events',
    15,
    hasAll(trailerBeatSheetText, [
      /requiredVisual/,
      /viewerCheckpoint/,
      /被威胁对象/,
      /危险源/,
      /操作结果/,
      /新的未解问题/,
      /imageHandoff/,
    ]),
  ),
  pass(
    'huiying-segment-prompts-enforce-bridge-and-result',
    15,
    hasAll(assemblyPlanText, [
      /【威胁对象】/,
      /【危险源】/,
      /【操作结果】/,
      /【结尾新问题】/,
      /【入点状态】/,
      /【出点状态】/,
      /【桥接动作】/,
      /【剪辑衔接】/,
    ]),
  ),
  pass(
    'real-story-gate-demands-60s-visible-causality',
    10,
    hasAll(storyGateText, [
      /被威胁对象是谁或什么/,
      /危险源是什么/,
      /主角操作后的结果是什么/,
      /结尾新问题是什么/,
      /跨段衔接硬要求/,
    ]),
  ),
  pass(
    'semantic-review-keeps-current-60s-quality-gap-visible',
    10,
    hasAll(semanticReviewText, [
      /semantic-label-story-readability/,
      /storyReadableWithoutText/,
    ])
      && labelsSummary.labelsPresent
      && labelsSummary.storyReadableWithoutText === false
      && labelsSummary.failedCriticalStoryChecks.includes('conflict-readable-without-text')
      && labelsSummary.failedCriticalStoryChecks.includes('ending-hook-readable-without-text'),
    labelsSummary,
  ),
];

const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
const passedScore = checks
  .filter(check => check.pass)
  .reduce((sum, check) => sum + check.weight, 0);
const score = Math.round((passedScore / maxScore) * 100);
const failed = checks.filter(check => !check.pass).map(check => check.name);

const result = {
  ok: failed.length === 0,
  score,
  threshold: 90,
  usedRealKey: false,
  incurredCost: false,
  goldenCase: {
    id: preset.id,
    title: preset.title,
    duration: preset.duration,
    style: preset.style,
    beatCount: preset.beats.length,
    visualAnchors: preset.visualAnchors,
  },
  source: sourceFiles,
  conclusion: failed.length === 0
    ? '60s golden case structure is ready for low-cost or real generation: it forces readable threat target, danger source, operation result, ending hook, and segment handoff before spending video quota.'
    : '60s golden case structure is incomplete; do not spend real 60s video quota until failed checks are fixed.',
  checks,
  failed,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

if (!result.ok || result.score < result.threshold) {
  process.exit(1);
}
