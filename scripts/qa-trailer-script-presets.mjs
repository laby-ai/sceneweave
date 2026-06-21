#!/usr/bin/env node

import { getTrailerScriptPreset, listTrailerScriptPresets } from './trailer-script-presets.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const presets = listTrailerScriptPresets();
assert(presets.length >= 3, 'expected at least three trailer presets');

const checks = [];
function countUniqueLabelValues(beats, label) {
  const values = beats.map(beat => {
    const match = beat.match(new RegExp(`${label}：([\\s\\S]*?)(?=；|。|$)`));
    return match ? match[1].trim() : '';
  }).filter(Boolean);
  return new Set(values).size;
}

for (const preset of presets) {
  for (const requestedSeconds of [30, 60, 90]) {
    const item = getTrailerScriptPreset(preset.id, requestedSeconds);
    assert(item.id === preset.id, `preset id mismatch: ${preset.id}`);
    assert([30, 60, 90].includes(item.duration), `invalid duration bucket: ${item.duration}`);
    assert(item.prompt.includes('原创预告片'), `${preset.id}/${requestedSeconds} prompt missing original trailer marker`);
    assert(item.prompt.includes('冷开场'), `${preset.id}/${requestedSeconds} prompt missing cold open`);
    assert(item.prompt.includes('钩子') || item.prompt.includes('悬念'), `${preset.id}/${requestedSeconds} prompt missing hook`);
    assert(item.prompt.includes('主角') || item.prompt.includes('急救员') || item.prompt.includes('审计师'), `${preset.id}/${requestedSeconds} prompt missing protagonist`);
    assert(item.visualAnchors.length >= 4, `${preset.id}/${requestedSeconds} visual anchors incomplete`);
    assert(item.beats.length >= 5, `${preset.id}/${requestedSeconds} beats incomplete`);
    assert(!/鸣潮|哈利波特|漫威|迪士尼|奥斯卡获奖台词|复制/.test(item.prompt), `${preset.id}/${requestedSeconds} prompt contains disallowed borrowed-IP marker`);
    if (preset.id === 'last-train' && item.duration === 60) {
      const causalityLabels = ['段落职能：', '本段唯一信息：', '独有动作：', '画面证据：', '威胁对象：', '危险源：', '操作结果：', '下一段钩子：'];
      assert(
        item.beats.every(beat => causalityLabels.every(label => beat.includes(label))),
        'last-train/60 prompt must keep per-beat narrative function, unique information, action, evidence, threat, danger, result and handoff hook labels',
      );
      assert(
        countUniqueLabelValues(item.beats, '段落职能') === item.beats.length
          && countUniqueLabelValues(item.beats, '本段唯一信息') === item.beats.length
          && countUniqueLabelValues(item.beats, '独有动作') === item.beats.length,
        'last-train/60 beats must not repeat the same narrative function, information delta, or action',
      );
      assert(
        /我不在这辆车上/.test(item.prompt),
        'last-train/60 ending hook must be visually and narratively explicit',
      );
    }
    if (preset.id === 'five-dynasties-river' && item.duration === 60) {
      const historicalLabels = ['段落职能：', '本段唯一信息：', '独有动作：', '画面证据：', '威胁对象：', '危险源：', '操作结果：', '声音提示：', '下一段钩子：'];
      assert(
        item.beats.every(beat => historicalLabels.every(label => beat.includes(label))),
        'five-dynasties-river/60 must keep story, visual, audio and handoff labels for every beat',
      );
      assert(
        /残唐|后梁|后唐|后晋|后汉|后周|南唐|燕云|陈桥/.test(item.prompt),
        'five-dynasties-river/60 must cover core Five Dynasties and Ten Kingdoms historical anchors',
      );
      assert(
        /山河图/.test(item.prompt) && /黄袍/.test(item.prompt) && /黄河/.test(item.prompt),
        'five-dynasties-river/60 must preserve visual anchors across segments',
      );
      assert(
        countUniqueLabelValues(item.beats, '段落职能') === item.beats.length
          && countUniqueLabelValues(item.beats, '本段唯一信息') === item.beats.length
          && countUniqueLabelValues(item.beats, '声音提示') === item.beats.length,
        'five-dynasties-river/60 beats must not repeat function, information delta, or audio cue',
      );
    }
    checks.push({
      preset: preset.id,
      requestedSeconds,
      bucket: item.duration,
      beatCount: item.beats.length,
      visualAnchorCount: item.visualAnchors.length,
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  presetCount: presets.length,
  checks,
}, null, 2));
