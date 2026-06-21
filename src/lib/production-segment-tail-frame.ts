export type SegmentTailFrameSource = 'provider' | 'extracted' | null;

export interface SegmentTailFrameEvaluationInput {
  segmentIndex: number;
  segmentCount: number;
  providerLastFrameUrl?: string | null;
  extractedLastFrameUrl?: string | null;
}

export interface SegmentTailFrameEvaluation {
  ok: boolean;
  requiresTailFrame: boolean;
  lastFrameUrl: string | null;
  source: SegmentTailFrameSource;
  reason?: string;
  nextAction?: string;
}

function cleanUrl(value?: string | null) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : null;
}

export function evaluateSegmentTailFrameForHandoff(
  input: SegmentTailFrameEvaluationInput
): SegmentTailFrameEvaluation {
  const providerLastFrameUrl = cleanUrl(input.providerLastFrameUrl);
  if (providerLastFrameUrl) {
    return {
      ok: true,
      requiresTailFrame: input.segmentIndex < input.segmentCount - 1,
      lastFrameUrl: providerLastFrameUrl,
      source: 'provider',
    };
  }

  const extractedLastFrameUrl = cleanUrl(input.extractedLastFrameUrl);
  if (extractedLastFrameUrl) {
    return {
      ok: true,
      requiresTailFrame: input.segmentIndex < input.segmentCount - 1,
      lastFrameUrl: extractedLastFrameUrl,
      source: 'extracted',
    };
  }

  const requiresTailFrame = input.segmentIndex < input.segmentCount - 1;
  if (!requiresTailFrame) {
    return {
      ok: true,
      requiresTailFrame,
      lastFrameUrl: null,
      source: null,
    };
  }

  return {
    ok: false,
    requiresTailFrame,
    lastFrameUrl: null,
    source: null,
    reason: `第 ${input.segmentIndex + 1}/${input.segmentCount} 段已经生成视频，但没有可传递给下一段的 lastFrameUrl。`,
    nextAction: '必须先取得供应商 last_frame_url，或通过 HUIYING_OBJECT_STORAGE_* / HUIYING_PUBLIC_ASSET_BASE_URL 上传本地尾帧，再允许下一段真实生成。',
  };
}
