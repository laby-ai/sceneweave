export interface SegmentFirstFrameInput {
  segmentIndex: number;
  totalSegments: number;
  previousLastFrameUrl?: string;
  materialFallbackUrl?: string;
  strictFrameHandoff: boolean;
}

export interface SegmentFirstFrameResult {
  firstFrameImage?: string;
  dependencySatisfied: boolean;
  reason?: string;
}

export function resolveSegmentFirstFrame(input: SegmentFirstFrameInput): SegmentFirstFrameResult {
  if (input.segmentIndex === 0) {
    return {
      firstFrameImage: input.materialFallbackUrl,
      dependencySatisfied: true,
    };
  }

  if (input.previousLastFrameUrl) {
    return {
      firstFrameImage: input.previousLastFrameUrl,
      dependencySatisfied: true,
    };
  }

  if (input.strictFrameHandoff) {
    return {
      dependencySatisfied: false,
      reason: `第 ${input.segmentIndex + 1}/${input.totalSegments} 段缺少上一段 lastFrameUrl，已按分段连续性门禁停止，避免生成互不相干的片段。`,
    };
  }

  return {
    dependencySatisfied: true,
  };
}
