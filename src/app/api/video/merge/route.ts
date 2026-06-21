import { NextRequest, NextResponse } from 'next/server';
import { generateSegmentedVideo } from '@/lib/generate-segmented-video';
import { buildPartialSegmentResult, type SegmentSnapshot } from '@/lib/segmented-video-task-result';
import { extractBYOKConnection, type BYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';
import { archiveCompletedVideoTaskById } from '@/lib/production-video-task-archive-service';
import {
  createTask,
  startTask,
  completeTask,
  failTask,
  updateTask,
  updateTaskProgress,
} from '@/lib/task-manager';
import { 
  getCurrentStrategy, 
  DEFAULT_STRATEGY_MODE
} from '@/lib/video-segment-strategy';
import {
  processBackgroundMusic,
  processVoiceNarration,
  processVideoText,
  processSubtitles,
  type SubtitleParams,
  type BgmResult,
} from '@/lib/video-post-processing';

function redactArchiveError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

// 获取当前策略
const currentStrategy = getCurrentStrategy(DEFAULT_STRATEGY_MODE);

// 使用策略系统计算分段
const calculateSegments = (totalDuration: number) => {
  const safeDuration =
    typeof totalDuration === 'number' && Number.isFinite(totalDuration) && totalDuration > 0
      ? Math.min(Math.max(totalDuration, 5), 3600)
      : 20;
  const candidateDurations = [6, 10];
  let segmentDuration = currentStrategy.getSegmentDuration(safeDuration);
  let numSegments = Math.max(1, Math.ceil(safeDuration / segmentDuration));
  let bestDiff = Math.abs(numSegments * segmentDuration - safeDuration);

  for (const candidate of candidateDurations) {
    const candidateSegments = Math.max(1, Math.ceil(safeDuration / candidate));
    const candidateDiff = Math.abs(candidateSegments * candidate - safeDuration);
    if (candidateDiff < bestDiff) {
      segmentDuration = candidate;
      numSegments = candidateSegments;
      bestDiff = candidateDiff;
    }
  }
  
  console.log('[Merge API] 智能分段策略:', { 
    totalDuration, 
    segmentDuration, 
    numSegments 
  });
  
  return {
    segmentDuration,
    numSegments
  };
};

/**
 * POST /api/video/merge
 * 分段视频生成并合并
 * 
 * 请求体：
 * {
 *   prompt: string,
 *   duration: number,  // 总时长（秒）
 *   ratio?: string,
 *   resolution?: string,
 *   watermark?: boolean,
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let byokConnection: BYOKConnection | undefined;
    try {
      byokConnection = extractBYOKConnection(request.headers);
    } catch (error) {
      if (isBYOKConfigError(error)) {
        return NextResponse.json(buildBYOKConfigErrorPayload(error), { status: 400 });
      }
      throw error;
    }

    const {
      prompt,
      duration = 10,
      ratio = '16:9',
      resolution = '720p',
      watermark = true,
      language = 'zh',
      materials = [],
      enableSubtitle = false,
      subtitleText,
      subtitlePosition = 'bottom',
      subtitleFontSize = 'medium',
      subtitleColor = 'white',
      subtitleVoiceType = 'female',
      subtitleSpeechSpeed = 1.0,
      generateVoice = false,
      subtitleFontWeight,
      subtitleBackgroundColor,
      subtitleBackgroundOpacity,
      subtitleBorderColor,
      subtitleBorderWidth,
      subtitleShadowColor,
      subtitleShadowEnabled,
      subtitleAlignment,
      subtitleCustomPositionY,
      enableVideoText,
      videoText,
      videoTextPosition,
      videoTextStartTime,
      videoTextEndTime,
      useMultiSegmentVideoText,
      videoTextSegments,
      showSubtitleWithVoice = true,
      backgroundBgm,
      customAudio,
      libraryTrack,
      generateAudio = false,
      sceneType = 'portrait',
      productDisplayModes,
      videoModel,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的视频描述' },
        { status: 400 }
      );
    }

    const { segmentDuration, numSegments } = calculateSegments(duration);
    
    if (numSegments > 10) {
      return NextResponse.json(
        { error: '视频时长过长，建议拆分成多个视频生成' },
        { status: 400 }
      );
    }

    const taskId = createTask('video', {
      prompt,
      duration: duration.toString(),
      resolution,
      ratio,
      materials,
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
      language,
      isSegmented: true,
      segmentCount: numSegments,
      segmentDuration: segmentDuration,
    });

    startTask(taskId);

    executeSegmentedGeneration(taskId, prompt, duration, {
      ratio,
      resolution,
      watermark,
      language,
      materials,
      sceneType,
      productDisplayModes,
      generateAudio,
      byokConnection,
      videoModel,
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
      subtitleFontWeight,
      subtitleBackgroundColor,
      subtitleBackgroundOpacity,
      subtitleBorderColor,
      subtitleBorderWidth,
      subtitleShadowColor,
      subtitleShadowEnabled,
      subtitleAlignment,
      subtitleCustomPositionY,
      enableVideoText,
      videoText,
      videoTextPosition,
      videoTextStartTime,
      videoTextEndTime,
      useMultiSegmentVideoText,
      videoTextSegments,
      showSubtitleWithVoice,
      backgroundBgm,
      customAudio,
      libraryTrack,
      onSegmentUpdate: ({ segments }: { segments: SegmentSnapshot[] }) => {
        updateTask(taskId, {
          result: buildPartialSegmentResult(segments),
        });
      },
    }).catch(error => {
      console.error(`[Segmented Task ${taskId}] Unexpected error:`, error);
      failTask(taskId, '分段视频生成过程中发生错误');
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: `分段视频生成任务已提交，将生成${numSegments}个${segmentDuration}秒片段并自动合并`,
      segmentCount: numSegments,
      segmentDuration: segmentDuration,
    });

  } catch (error) {
    console.error('提交分段视频任务错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 分段生成后处理参数（从请求体透传）
interface SegmentedGenerationParams {
  ratio?: string;
  resolution?: string;
  watermark?: boolean;
  language?: string;
  materials?: string[];
  sceneType?: string;
  productDisplayModes?: string[];
  byokConnection?: BYOKConnection;
  videoModel?: string;
  generateAudio?: boolean;
  // 字幕
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: 'top' | 'middle' | 'bottom' | 'custom';
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  subtitleFontWeight?: string;
  subtitleBackgroundColor?: string;
  subtitleBackgroundOpacity?: number;
  subtitleBorderColor?: string;
  subtitleBorderWidth?: number;
  subtitleShadowColor?: string;
  subtitleShadowEnabled?: boolean;
  subtitleAlignment?: 'left' | 'center' | 'right';
  subtitleCustomPositionY?: number;
  subtitleFontType?: string;
  // 视频文字
  enableVideoText?: boolean;
  videoText?: string;
  videoTextPosition?: string;
  videoTextStartTime?: number;
  videoTextEndTime?: number;
  useMultiSegmentVideoText?: boolean;
  videoTextSegments?: Array<{
    text: string;
    position?: string;
    fontSize?: string;
    color?: string;
    startTime?: number;
    endTime?: number;
    customPositionX?: number;
    customPositionY?: number;
    alignment?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    backgroundOpacity?: number;
    borderColor?: string;
    borderWidth?: number;
    shadowColor?: string;
    shadowEnabled?: boolean;
    animation?: string;
    fontWeight?: 'normal' | 'bold';
  }>;
  showSubtitleWithVoice?: boolean;
  // BGM
  backgroundBgm?: string;
  customAudio?: { url: string; name: string };
  libraryTrack?: { url: string; title?: string };
  onSegmentComplete?: (snapshot: {
    segmentIndex: number;
    videoUrl: string;
    lastFrameUrl?: string;
    segments: SegmentSnapshot[];
  }) => void;
  onSegmentUpdate?: (snapshot: {
    segmentIndex: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    prompt: string;
    duration: number;
    ratio?: string;
    videoModel?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    error?: string;
    segments: SegmentSnapshot[];
  }) => void;
}

/**
 * 执行分段视频生成（含字幕/BGM/视频文字后处理）
 */
async function executeSegmentedGeneration(
  taskId: string,
  prompt: string,
  duration: number,
  params: SegmentedGenerationParams
) {
  try {
    // ========== 阶段1: 分段视频生成与合并 ==========
    const result = await generateSegmentedVideo(
      prompt,
      duration,
      params,
      (progress, stage) => {
        updateTaskProgress(taskId, progress, stage || '处理中...');
      }
    );

    if (!result.success || !result.videoUrl) {
      failTask(taskId, result.error || '分段视频生成失败');
      return;
    }

    let videoUrl = result.videoUrl;
    console.log(`[Segmented Task ${taskId}] 视频片段合并完成，开始后处理...`);

    // ========== 阶段2: 背景音乐处理 ==========
    const backgroundBgm = params.backgroundBgm;
    const customAudio = params.customAudio;
    const libraryTrack = params.libraryTrack;

    let effectiveBgm = backgroundBgm;
    let effectiveCustomAudio = customAudio;

    // 音乐库模式：使用选中曲目的URL作为自定义音频
    if (backgroundBgm === 'library' && libraryTrack?.url) {
      effectiveCustomAudio = {
        url: libraryTrack.url,
        name: libraryTrack.title || '音乐库曲目',
      };
      effectiveBgm = 'custom';
    }

    let bgmResult: BgmResult = { videoUrl, source: 'none' };
    if (effectiveBgm && effectiveBgm !== 'none') {
      if (effectiveBgm === 'custom' && effectiveCustomAudio?.url) {
        console.log(`[Segmented Task ${taskId}] 开始处理自定义音频...`);
        updateTaskProgress(taskId, 80, '正在添加自定义音频...');
        try {
          bgmResult = await processBackgroundMusic(videoUrl, effectiveBgm, undefined, undefined, effectiveCustomAudio);
          videoUrl = bgmResult.videoUrl;
        } catch (bgmError) {
          console.error(`[Segmented Task ${taskId}] 自定义音频处理失败:`, bgmError);
        }
      } else {
        console.log(`[Segmented Task ${taskId}] 开始处理背景音乐: ${effectiveBgm}`);
        updateTaskProgress(taskId, 80, '正在添加背景音乐...');
        try {
          bgmResult = await processBackgroundMusic(videoUrl, effectiveBgm);
          videoUrl = bgmResult.videoUrl;
        } catch (bgmError) {
          console.error(`[Segmented Task ${taskId}] 背景音乐处理失败:`, bgmError);
        }
      }
    }

    // ========== 阶段3: 语音旁白（TTS） ==========
    if (params.generateVoice && params.subtitleText) {
      console.log(`[Segmented Task ${taskId}] 开始处理语音旁白...`);
      updateTaskProgress(taskId, 82, '正在生成语音旁白...');
      try {
        videoUrl = await processVoiceNarration(
          videoUrl,
          params.subtitleText,
          params.subtitleVoiceType || 'female_tianmei',
          params.subtitleSpeechSpeed || 1.0
        );
      } catch (voiceError) {
        console.error(`[Segmented Task ${taskId}] 语音旁白处理失败:`, voiceError);
      }
    }

    // ========== 阶段4: 视频文字 ==========
    if (params.enableVideoText) {
      const videoTextParams: SubtitleParams = {
        enableSubtitle: false,
        enableVideoText: params.enableVideoText,
        videoText: params.videoText,
        videoTextPosition: params.videoTextPosition,
        videoTextStartTime: params.videoTextStartTime,
        videoTextEndTime: params.videoTextEndTime,
        useMultiSegmentVideoText: params.useMultiSegmentVideoText,
        videoTextSegments: params.videoTextSegments,
      };
      console.log(`[Segmented Task ${taskId}] 开始处理视频文字...`);
      updateTaskProgress(taskId, 85, '正在添加视频文字...');
      try {
        videoUrl = await processVideoText(videoUrl, videoTextParams);
      } catch (vtError) {
        console.error(`[Segmented Task ${taskId}] 视频文字处理失败:`, vtError);
      }
    }

    // ========== 阶段5: 字幕 ==========
    const shouldShowSubtitles = params.enableSubtitle && !(params.generateVoice && params.showSubtitleWithVoice === false);
    if (shouldShowSubtitles) {
      const subtitleParams: SubtitleParams = {
        enableSubtitle: params.enableSubtitle,
        subtitleText: params.subtitleText,
        subtitlePosition: params.subtitlePosition,
        subtitleFontSize: params.subtitleFontSize,
        subtitleColor: params.subtitleColor,
        subtitleVoiceType: params.subtitleVoiceType,
        subtitleSpeechSpeed: params.subtitleSpeechSpeed,
        generateVoice: params.generateVoice,
        subtitleFontWeight: params.subtitleFontWeight,
        subtitleBackgroundColor: params.subtitleBackgroundColor,
        subtitleBackgroundOpacity: params.subtitleBackgroundOpacity,
        subtitleBorderColor: params.subtitleBorderColor,
        subtitleBorderWidth: params.subtitleBorderWidth,
        subtitleShadowColor: params.subtitleShadowColor,
        subtitleShadowEnabled: params.subtitleShadowEnabled,
        subtitleAlignment: params.subtitleAlignment,
        subtitleCustomPositionY: params.subtitleCustomPositionY,
        subtitleFontType: params.subtitleFontType || 'noto',
        enableVideoText: false,
      };
      console.log(`[Segmented Task ${taskId}] 开始处理字幕...`);
      updateTaskProgress(taskId, 88, '正在添加字幕...');
      try {
        const subResult = await processSubtitles(videoUrl, subtitleParams);
        videoUrl = subResult.videoUrl;
      } catch (subError) {
        console.error(`[Segmented Task ${taskId}] 字幕处理失败:`, subError);
      }
    }

    // ========== 完成 ==========
    updateTaskProgress(taskId, 95, '视频生成完成...');

    completeTask(taskId, {
      videoUrl,
      duration,
      ratio: params.ratio,
      resolution: params.resolution,
      provider: 'byok',
      isSegmented: true,
      segmentCount: result.segments?.length,
      segments: result.segments,
      backgroundBgm: params.backgroundBgm,
      enableSubtitle: params.enableSubtitle,
      enableVideoText: params.enableVideoText,
    });

    try {
      const archived = archiveCompletedVideoTaskById(taskId);
      updateTask(taskId, {
        message: `视频生成完成，并已自动归档为制作项目：${archived.segmentAssetCount} 个 videoSegment 和 ${archived.finalVideoAssetCount} 个 finalVideo 可在任务中心、画布和素材链路复用。`,
      });
      console.log(`[Segmented Task ${taskId}] Archived production assets: ${archived.segmentAssetCount} videoSegment, ${archived.finalVideoAssetCount} finalVideo`);
    } catch (archiveError) {
      const safeArchiveError = redactArchiveError(archiveError);
      updateTask(taskId, {
        message: `视频生成完成，但制作项目归档失败：${safeArchiveError}。成片和片段已保留，可稍后在任务中心重试归档。`,
      });
      console.warn(`[Segmented Task ${taskId}] Production archive failed:`, safeArchiveError);
    }
    console.log(`[Segmented Task ${taskId}] Completed successfully`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`[Segmented Task ${taskId}] Failed:`, errorMessage);
    failTask(
      taskId,
      /API|Key|BYOK|供应商|配置|model|模型/i.test(errorMessage)
        ? `供应商配置或调用失败：${errorMessage}`
        : errorMessage
    );
  }
}
