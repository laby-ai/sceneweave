import assert from 'node:assert/strict';

import type { ProductionSegmentPlan } from '../src/lib/production-assembly-plan';
import { resolveFirstFrameInput } from '../src/lib/production-segment-start-payload';

function segment(expectedInputs: Record<string, unknown>, index = 1) {
  return { index, expectedInputs } as unknown as ProductionSegmentPlan;
}

function main() {
  // 真实生产数据复现：boundary 桥接未生成 -> direct-tail-frame-fallback，
  // 本段挂着独立参考图 firstFrameUrl，但上一段尾帧 previousLastFrameUrl 也在。
  // 修复前落到 segment-first-frame 用独立参考图 -> 场景跳变；修复后必须用尾帧。
  const tailFrame = 'data:image/jpeg;base64,/9j//4AAQ';
  const independentRef = 'https://dashscope.oss/clip-2-reference.png';

  const fallback = resolveFirstFrameInput(segment({
    firstFrameUrl: independentRef,
    previousLastFrameUrl: tailFrame,
    bridgeStrategy: 'direct-tail-frame-fallback',
    bridgeFirstFrameUrl: null,
  }));
  assert.equal(fallback.firstFrameImage, tailFrame, '回退场景首帧必须是上一段尾帧');
  assert.equal(fallback.firstFrameSource, 'direct-previous-tail', '回退场景首帧来源必须是 direct-previous-tail');

  // firstFrameUrl 与尾帧一致时，原先就正确，不应被回退改变语义。
  const aligned = resolveFirstFrameInput(segment({
    firstFrameUrl: tailFrame,
    previousLastFrameUrl: tailFrame,
    bridgeStrategy: 'direct-tail-frame-fallback',
  }));
  assert.equal(aligned.firstFrameImage, tailFrame);
  assert.equal(aligned.firstFrameSource, 'direct-previous-tail');

  // transition-bridge 完整时仍用边界新相机首帧，不受回退分支影响。
  const bridge = resolveFirstFrameInput(segment({
    firstFrameUrl: 'https://bridge/new-camera.png',
    previousLastFrameUrl: tailFrame,
    bridgeFirstFrameUrl: 'https://bridge/new-camera.png',
    bridgeStrategy: 'transition-bridge',
  }));
  assert.equal(bridge.firstFrameSource, 'boundary-new-camera');

  // 回退但无尾帧时，退回 segment-first-frame，不凭空造帧。
  const noTail = resolveFirstFrameInput(segment({
    firstFrameUrl: independentRef,
    previousLastFrameUrl: null,
    bridgeStrategy: 'direct-tail-frame-fallback',
  }));
  assert.equal(noTail.firstFrameImage, independentRef);
  assert.equal(noTail.firstFrameSource, 'segment-first-frame');

  console.log('PASS segment-first-frame-fallback');
}

main();
