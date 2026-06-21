import assert from 'node:assert/strict';
import { buildSegmentContinuityMemoryBlock } from '../src/lib/segment-continuity-memory';

const opening = buildSegmentContinuityMemoryBlock({
  segmentIndex: 0,
  totalSegments: 3,
  currentPrompt: '急救员在暴雨车站发现红色书包和旧桥警报。',
  nextPrompt: '她冲进站长室按下制动按钮但失败。',
  visualAnchors: ['急救员', '红色书包', '暴雨车站', '旧桥警报'],
});
assert(opening.includes('【上一段画面记忆】开场段'), 'opening should establish scene memory');
assert(opening.includes('【本段唯一信息增量】'), 'opening should include unique information delta');
assert(opening.includes('【下一段触发点】她冲进站长室'), 'opening should name next trigger');

const middle = buildSegmentContinuityMemoryBlock({
  segmentIndex: 1,
  totalSegments: 3,
  previousPrompt: '急救员跪在站台边打开红色书包，对讲机亮起。',
  currentPrompt: '她冲进站长室连续按下制动按钮，屏幕弹出失败提示。',
  nextPrompt: '轨道倒计时牌开始归零，她拿起红旗冲向轨道边。',
  previousLastFrameAvailable: true,
  visualAnchors: ['急救员', '站长室', '制动按钮', '失败提示'],
});
assert(middle.includes('【上一段画面记忆】急救员跪在站台边打开红色书包'), 'middle should carry previous segment memory');
assert(middle.includes('已提供上一段 lastFrame/firstFrame 参考'), 'middle should acknowledge frame reference');
assert(middle.includes('【出点状态】结尾必须冻结一个下一段能接住的状态'), 'middle should force an output state');
assert(middle.includes('不要把本段拍成重复氛围空镜'), 'middle should forbid ledger-like atmosphere shots');

const last = buildSegmentContinuityMemoryBlock({
  segmentIndex: 2,
  totalSegments: 3,
  previousPrompt: '急救员拿着红旗冲向轨道边，列车灯逼近。',
  currentPrompt: '她发现第三节车厢里还有孩子，对讲机传来新的求救。',
  previousLastFrameAvailable: false,
});
assert(last.includes('未提供真实尾帧时，仍必须在文字上复现上一段最后'), 'last should preserve continuity without a frame');
assert(last.includes('不再开启新动作'), 'last should not open a new action chain');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  checks: [
    'opening establishes visual anchors and next trigger',
    'middle segment carries previous frame memory and output state',
    'last segment avoids opening an unrelated new action',
  ],
}, null, 2));
