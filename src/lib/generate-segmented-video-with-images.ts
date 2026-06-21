/**
 * 简化版：带参考图片的分段视频生成工具
 * 实际使用现有的 generate-segmented-video 模块
 */

export interface SegmentTaskWithImage {
  index: number;
  startImageUrl: string;
  endImageUrl: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  retryCount?: number;
}

export interface SegmentedVideoWithImagesResult {
  success: boolean;
  videoUrl?: string;
  segments?: SegmentTaskWithImage[];
  segmentCount?: number;
  error?: string;
  isPartial?: boolean;
  failedSegments?: number[];
  successCount?: number;
  totalCount?: number;
}

/**
 * 使用参考图片生成分段视频（简化版 - 复用现有逻辑）
 * 实际上直接调用现有的 generate-segmented-video
 */
export async function generateSegmentedVideoWithImages(
  prompt: string,
  totalDuration: number,
  referenceImages: string[],
  params: any,
  onProgress?: (progress: number, stage: string) => void
): Promise<SegmentedVideoWithImagesResult> {
  try {
    onProgress?.(0, '准备生成视频...');
    console.log(`[NineGridVideo] 使用简化模式生成 ${totalDuration}秒视频`);
    
    // 动态导入现有的分段生成模块，避免循环依赖问题
    const { generateSegmentedVideo } = await import('./generate-segmented-video');
    
    // 将第一张参考图片作为素材传入
    const materials = referenceImages.length > 0 ? [referenceImages[0]] : [];
    
    // 调用现有的分段生成
    const result = await generateSegmentedVideo(
      prompt,
      totalDuration,
      {
        ...params,
        materials,
      },
      (progress, stage) => {
        onProgress?.(progress, stage || '处理中...');
      }
    );
    
    return {
      success: result.success,
      videoUrl: result.videoUrl,
      error: result.error,
      isPartial: result.isPartial,
      failedSegments: result.failedSegments,
      successCount: result.successCount,
      totalCount: result.totalCount,
      segmentCount: result.totalCount,
    };
    
  } catch (error: any) {
    console.error('[NineGridVideo] 视频生成失败:', error);
    return {
      success: false,
      error: error.message || '视频生成失败',
    };
  }
}
