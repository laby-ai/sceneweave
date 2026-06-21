#!/usr/bin/env node

import { evaluateStoryReadability } from './story-readability-score.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const goodProject = {
  storyBible: {
    premise: '暴雨夜，年轻急救员在车站发现红色书包，必须阻止最后一班列车驶向坍塌旧桥。',
    protagonist: '年轻急救员',
    desire: '年轻急救员想要救下车厢里的孩子',
    obstacle: '旧桥报警、列车失控、站台断电',
    conflict: '列车即将驶上坍塌旧桥，红色书包里的对讲机传来求救声',
    turningPoint: '年轻急救员按下紧急制动按钮并冲向轨道',
    endingHook: '列车灯光穿过雨幕，孩子的影子出现在车窗里',
  },
  storyboard: {
    shots: [
      { dramaticPurpose: '急救员捡起红色书包并听到求救声', prompt: '急救员捡起书包，查看对讲机' },
      { dramaticPurpose: '急救员按下紧急制动按钮阻止列车', prompt: '急救员冲向控制室，按下制动按钮' },
    ],
  },
  assets: [
    { kind: 'character', name: '年轻急救员', summary: '主角' },
    { kind: 'scene', name: '暴雨车站', summary: '危险发生地' },
    { kind: 'prop', name: '红色书包', summary: '孩子线索' },
  ],
};

const goodAssembly = {
  segments: [
    { prompt: '【入点状态】暴雨车站。【出点状态】急救员拿起书包。【桥接动作】捡起并打开对讲机。【剪辑衔接】下一段承接手部动作。' },
    { prompt: '【入点状态】承接上一段书包状态。【出点状态】按下制动按钮。【桥接动作】冲向控制室。【剪辑衔接】下一段承接列车危机。' },
  ],
};

const badProject = {
  storyBible: {
    premise: '一只红色书包在漂亮空间里出现。',
    protagonist: '红色书包',
    desire: '红色书包想要展示自己',
    obstacle: '氛围变化',
    conflict: '画面很神秘',
    turningPoint: '镜头变亮',
    endingHook: '留下感觉',
  },
  storyboard: {
    shots: [
      { dramaticPurpose: '展示氛围', prompt: '抽象空镜，漂亮光影' },
    ],
  },
  assets: [
    { kind: 'prop', name: '红色书包', summary: '物件' },
  ],
};

const badAssembly = {
  segments: [
    { prompt: '漂亮氛围镜头，没有动作。' },
  ],
};

const stylizedProject = {
  storyBible: {
    premise: '海蚀废墟里，年轻调律者发现失控共鸣装置会吞没避难所，必须带着漂泊旅人关闭核心。',
    protagonist: '年轻调律者',
    desire: '年轻调律者想要救下避难所里的孩子',
    obstacle: '共鸣装置失控、潮水倒灌、废墟通道封锁',
    conflict: '调律者必须在倒计时结束前关闭核心，但每次触碰都会让废墟坍塌',
    turningPoint: '调律者把共鸣钥匙交给漂泊旅人，自己冲向中控台按下手动制动',
    endingHook: '核心停下的一瞬间，远处海雾里出现新的信号',
  },
  storyboard: {
    shots: [
      { dramaticPurpose: '调律者查看共鸣装置并找到倒计时', prompt: '调律者触碰屏幕，查看倒计时警报' },
      { dramaticPurpose: '调律者冲向中控台关闭失控核心', prompt: '调律者拿起共鸣钥匙，冲向中控台按下制动' },
    ],
  },
  assets: [
    { kind: 'character', name: '年轻调律者', summary: '主角，负责关闭共鸣装置' },
    { kind: 'character', name: '漂泊旅人', summary: '协助者，承接关键道具' },
    { kind: 'scene', name: '海蚀废墟', summary: '潮水倒灌的危险场景' },
    { kind: 'prop', name: '共鸣钥匙', summary: '关闭装置的关键道具' },
  ],
};

const stylizedAssembly = {
  segments: [
    { prompt: '【入点状态】海蚀废墟潮水倒灌，调律者站在失控共鸣装置前。【出点状态】调律者拿起共鸣钥匙。【桥接动作】触碰屏幕后转身抓起钥匙。【剪辑衔接】下一段承接手部拿钥匙动作。' },
    { prompt: '【入点状态】承接上一段手部拿钥匙动作。【出点状态】中控台核心停下并出现新信号。【桥接动作】调律者冲向中控台按下制动。【剪辑衔接】以警报灯熄灭切到海雾信号。' },
  ],
};

const good = evaluateStoryReadability(goodProject, goodAssembly, 80);
const bad = evaluateStoryReadability(badProject, badAssembly, 80);
const stylized = evaluateStoryReadability(stylizedProject, stylizedAssembly, 80);

assert(good.pass, `good project should pass: ${JSON.stringify(good)}`);
assert(good.score >= 80, `good score too low: ${good.score}`);
assert(stylized.pass, `stylized project should pass: ${JSON.stringify(stylized)}`);
assert(stylized.checks.hasHumanProtagonist, `stylized protagonist should be recognized: ${JSON.stringify(stylized)}`);
assert(!bad.pass, 'bad project should fail');
assert(bad.issues.some(issue => issue.code === 'human-protagonist-missing'), 'bad project should catch object protagonist');
assert(bad.issues.some(issue => issue.code === 'segment-bridge-missing'), 'bad project should catch missing bridge markers');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  good: {
    score: good.score,
    pass: good.pass,
    issueCount: good.issues.length,
  },
  stylized: {
    score: stylized.score,
    pass: stylized.pass,
    hasHumanProtagonist: stylized.checks.hasHumanProtagonist,
  },
  bad: {
    score: bad.score,
    pass: bad.pass,
    issueCodes: bad.issues.map(issue => issue.code),
  },
}, null, 2));
