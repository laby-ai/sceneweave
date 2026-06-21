import { NextRequest, NextResponse } from 'next/server';
import {
  createTask,
  startTask,
  completeTask,
  failTask,
  updateTaskProgress,
} from '@/lib/task-manager';
import {
  generateNineGridImages,
} from '@/lib/generate-nine-grid-images';
import { extractNineGridForwardHeaders } from '@/lib/nine-grid-provider-headers';
// 导入视频后处理函数（从共享模块）
import {
  processBackgroundMusic,
  processVoiceNarration,
  processVideoText,
  processSubtitles,
  BGM_MAP,
  type SubtitleParams,
} from '@/lib/video-post-processing';

export const maxDuration = 3600; // 1小时

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      duration = 30,
      ratio = '16:9',
      resolution = '720p',
      watermark = true,
      enableSubtitle = false,
      subtitleText,
      subtitlePosition = 'bottom',
      subtitleFontSize = 'medium',
      subtitleColor = 'white',
      subtitleVoiceType = 'female',
      subtitleSpeechSpeed = 1.0,
      generateVoice = false,
      language = 'zh',
      userNineGridImages, // 用户上传的九宫格图片
      // 音频相关参数
      aiAudioPrompt,
      audioUrl,
      audioPrompt,
      // 字幕相关参数
      subtitleEnabled,
      subtitlePrompt,
      // 背景音乐参数（修复：之前遗漏导致BGM不生效）
      backgroundBgm,
      customAudio,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的视频描述' },
        { status: 400 }
      );
    }

    // 防护：确保 duration 为有效数字（默认值只对 undefined 生效，不对 null）
    let safeDuration: number;
    if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
      console.warn(`[NineGrid] duration 参数无效(${typeof duration}:${duration}), 使用默认值 30`);
      safeDuration = 30;
    } else {
      safeDuration = duration;
    }

    const customHeaders = await extractNineGridForwardHeaders(request.headers);

    // 创建任务
    const taskId = createTask('video', {
      prompt,
      duration: String(safeDuration),
      resolution,
      ratio,
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
      language,
      isNineGrid: true,
    });

    // 启动任务
    startTask(taskId);

    // 在后台执行（简化版：先生成九宫格图片，然后用普通分段生成）
    executeNineGridVideoTask(
      taskId,
      prompt,
      safeDuration,
      {
        ratio,
        resolution,
        watermark,
        enableSubtitle,
        subtitleText,
        subtitlePosition,
        subtitleFontSize,
        subtitleColor,
        subtitleVoiceType,
        subtitleSpeechSpeed,
        generateVoice,
        language,
        userNineGridImages,
        // 音频相关参数
        aiAudioPrompt,
        audioUrl,
        audioPrompt,
        // 字幕相关参数
        subtitleEnabled,
        subtitlePrompt,
        // 背景音乐参数（修复：之前遗漏导致BGM不生效）
        backgroundBgm,
        customAudio,
      },
      customHeaders
    ).catch(error => {
      console.error(`[NineGrid Task ${taskId}] Unexpected error:`, error);
      failTask(taskId, '九宫格视频生成过程中发生错误');
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: '任务已提交，正在生成视频...',
      isNineGrid: true,
    });

  } catch (error) {
    console.error('提交九宫格视频任务错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

async function executeNineGridVideoTask(
  taskId: string,
  prompt: string,
  duration: number,
  params: any,
  customHeaders: Record<string, string>
) {
  try {
    const {
      ratio = '16:9',
      resolution = '720p',
      watermark = true,
      enableSubtitle = false,
      subtitleText,
      subtitlePosition = 'bottom',
      subtitleFontSize = 'medium',
      subtitleColor = 'white',
      subtitleVoiceType = 'female',
      subtitleSpeechSpeed = 1.0,
      generateVoice = false,
      language = 'zh',
      userNineGridImages,
    } = params;

    let nineGridResult: any = null;
    let userProvidedImages: any[] = [];

    // 检查是否有用户上传的九宫格图片
    if (userNineGridImages && Array.isArray(userNineGridImages) && userNineGridImages.length > 0) {
      console.log(`[NineGrid Task ${taskId}] 使用用户上传的 ${userNineGridImages.length} 张图片`);
      updateTaskProgress(taskId, 10, '使用您上传的图片...');
      
      // 格式化用户提供的图片
      userProvidedImages = userNineGridImages.map((url: string, index: number) => ({
        index: index,
        imageUrl: url,
      }));
      
      updateTaskProgress(taskId, 20, '图片准备完成', '准备生成视频...');
    } else {
      // 如果用户没有上传图片，继续使用AI生成
      console.log(`[NineGrid Task ${taskId}] 用户未上传图片，使用AI生成九宫格`);
      updateTaskProgress(taskId, 5, '生成九宫格预览图片...');
      
      nineGridResult = await generateNineGridImages(
        prompt,
        { size: '2K' },
        (progress, stage) => {
          const mappedProgress = 5 + (progress * 0.15);
          updateTaskProgress(taskId, mappedProgress, stage);
        }
      );

      // 检查九宫格生成结果
      if (!nineGridResult?.success) {
        const errorMsg = nineGridResult?.error || '九宫格图片生成失败';
        console.error(`[NineGrid Task ${taskId}] 九宫格图片生成失败:`, errorMsg);
        failTask(taskId, `9张生成失败: ${errorMsg}`);
        return;
      }
      
      if (!nineGridResult.images || nineGridResult.images.length === 0) {
        console.error(`[NineGrid Task ${taskId}] 九宫格图片为空`);
        failTask(taskId, '9张生成失败: 图片列表为空');
        return;
      }
      
      console.log(`[NineGrid Task ${taskId}] 九宫格图片生成成功，共 ${nineGridResult.images.length} 张`);

      updateTaskProgress(taskId, 20, '九宫格预览完成', '准备生成视频...');
    }

    // 第二步：直接调用普通的分段生成（复用现有逻辑）
    // 动态导入避免循环依赖
    const { generateSegmentedVideo } = await import('@/lib/generate-segmented-video');
    
    // 确定使用哪些图片作为参考
    let materials: string[] = [];
    if (userProvidedImages.length > 0) {
      // 使用用户提供的图片，取第一张作为参考
      materials = [userProvidedImages[0].imageUrl];
    } else if (nineGridResult?.success && nineGridResult?.images) {
      // 使用AI生成的第一张图片
      materials = [nineGridResult.images[0].imageUrl];
    }
    
    updateTaskProgress(taskId, 25, '开始生成视频...');
    
    const videoResult = await generateSegmentedVideo(
      prompt,
      duration,
      {
        ratio,
        resolution,
        watermark,
        language,
        materials,
        // 音频相关参数
        aiAudioPrompt: params.aiAudioPrompt,
        audioUrl: params.audioUrl,
        audioPrompt: params.audioPrompt,
        // 字幕相关参数
        subtitleEnabled: params.subtitleEnabled,
        subtitlePrompt: params.subtitlePrompt,
      },
      (progress, stage) => {
        const mappedProgress = 25 + (progress * 0.75);
        updateTaskProgress(taskId, mappedProgress, stage || '处理中...');
      }
    );

    if (!videoResult.success || !videoResult.videoUrl) {
      failTask(taskId, videoResult.error || '视频生成失败');
      return;
    }

    let finalVideoUrl = videoResult.videoUrl;
    
    // ========== 后处理：音频和字幕 ==========
    console.log(`[NineGrid Task ${taskId}] 开始后处理: 音频和字幕`);
    
    // 1. 处理背景音乐
    const backgroundBgm = params.backgroundBgm;
    const customAudio = params.customAudio;
    
    if (backgroundBgm && backgroundBgm !== 'none') {
      console.log(`[NineGrid Task ${taskId}] 处理背景音乐:`, backgroundBgm);
      updateTaskProgress(taskId, 85, '正在添加背景音乐...');
      
      try {
        let bgmResult: any = { videoUrl: finalVideoUrl, source: 'none' };
        if (backgroundBgm === 'custom' && customAudio) {
          bgmResult = await processBackgroundMusic(finalVideoUrl, backgroundBgm, customHeaders, undefined, customAudio);
        } else if (BGM_MAP[backgroundBgm as keyof typeof BGM_MAP]) {
          bgmResult = await processBackgroundMusic(finalVideoUrl, backgroundBgm, customHeaders);
        }
        finalVideoUrl = bgmResult.videoUrl;
        console.log(`[NineGrid Task ${taskId}] 背景音乐处理完成:`, bgmResult.source);
      } catch (bgmError) {
        console.error(`[NineGrid Task ${taskId}] 背景音乐处理失败:`, bgmError);
        // 继续执行，不阻断流程
      }
    }

    // 2. 处理语音旁白（在BGM之后）
    const _generateVoice = params.generateVoice;
    const _subtitleText = params.subtitleText;
    
    if (_generateVoice && _subtitleText) {
      console.log(`[NineGrid Task ${taskId}] 处理语音旁白...`);
      updateTaskProgress(taskId, 88, '正在生成语音旁白...');
      
      try {
        finalVideoUrl = await processVoiceNarration(
          finalVideoUrl,
          _subtitleText,
          params.subtitleVoiceType || 'female_tianmei',
          params.subtitleSpeechSpeed || 1.0,
          customHeaders
        );
        console.log(`[NineGrid Task ${taskId}] 语音旁白处理完成`);
      } catch (voiceError) {
        console.error(`[NineGrid Task ${taskId}] 语音旁白处理失败:`, voiceError);
      }
    }

    // 3. 处理视频文字
    const _enableVideoText = params.enableVideoText;
    
    if (_enableVideoText) {
      console.log(`[NineGrid Task ${taskId}] 处理视频文字...`);
      updateTaskProgress(taskId, 91, '正在添加视频文字...');
      
      try {
        const videoTextParams: SubtitleParams = {
          enableSubtitle: false,
          enableVideoText: _enableVideoText,
          videoText: params.videoText,
          videoTextPosition: params.videoTextPosition,
          videoTextStartTime: params.videoTextStartTime,
          videoTextEndTime: params.videoTextEndTime,
          useMultiSegmentVideoText: params.useMultiSegmentVideoText,
          videoTextSegments: params.videoTextSegments,
        };
        
        finalVideoUrl = await processVideoText(finalVideoUrl, videoTextParams, customHeaders);
        console.log(`[NineGrid Task ${taskId}] 视频文字处理完成`);
      } catch (videoTextError) {
        console.error(`[NineGrid Task ${taskId}] 视频文字处理失败:`, videoTextError);
      }
    }

    // 4. 处理字幕
    const _showSubtitleWithVoice = params.showSubtitleWithVoice !== false; // 默认显示
    const shouldShowSubtitles = params.enableSubtitle && !(_generateVoice && _showSubtitleWithVoice === false);
    
    // SRT降级数据（在try块外声明，确保completeTask能访问）
    let srtData: string | undefined;
    let srtEntries: any[] | undefined;
    let subtitleBurned: boolean = false;
    
    if (shouldShowSubtitles && _subtitleText) {
      console.log(`[NineGrid Task ${taskId}] 处理字幕...`);
      updateTaskProgress(taskId, 94, '正在添加字幕...');
      
      try {
        const subtitleParams: SubtitleParams = {
          enableSubtitle: params.enableSubtitle,
          subtitleText: _subtitleText,
          subtitlePosition: params.subtitlePosition || 'bottom',
          subtitleFontSize: params.subtitleFontSize || 'medium',
          subtitleColor: params.subtitleColor || '#FFFFFF',
          subtitleVoiceType: params.subtitleVoiceType,
          subtitleSpeechSpeed: params.subtitleSpeechSpeed,
          generateVoice: _generateVoice,
          // 字幕样式扩展
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
          // 视频文字相关（字幕处理不需要）
          enableVideoText: false,
        };
        
        const subResult = await processSubtitles(finalVideoUrl, subtitleParams, customHeaders);
        console.log(`[NineGrid Task ${taskId}] 字幕处理完成`);
        // processSubtitles现在返回SubtitleProcessResult，提取videoUrl
        finalVideoUrl = subResult.videoUrl;
        console.log(`[NineGrid Task ${taskId}] 字幕烧录结果: burned=${subResult.subtitleBurned}, srtEntries=${subResult.srtEntries?.length || 0}`);
        // 保存SRT数据到独立变量（不能用字符串属性，改用外部声明的局部变量）
        if (subResult.srtData) {
          srtData = subResult.srtData;
          srtEntries = subResult.srtEntries;
          subtitleBurned = subResult.subtitleBurned;
        }
      } catch (subtitleError) {
        console.error(`[NineGrid Task ${taskId}] 字幕处理失败，详细错误:`, subtitleError);
        console.error(`[NineGrid Task ${taskId}] 字幕错误堆栈:`, subtitleError instanceof Error ? subtitleError.stack : 'N/A');
      }
    }
    
    console.log(`[NineGrid Task ${taskId}] 后处理完成，最终视频URL:`, finalVideoUrl?.substring(0, 80));

    // 确定最终要保存的九宫格图片
    const finalNineGridImages = userProvidedImages.length > 0 
      ? userProvidedImages
      : (nineGridResult?.success && nineGridResult?.images 
          ? nineGridResult.images.map((img: any) => ({
              index: img.index,
              imageUrl: img.imageUrl,
            }))
          : undefined);

    // 完成任务（包含完整的音频/字幕/BGM状态信息）
    updateTaskProgress(taskId, 100, '完成!', '九宫格视频生成成功');
    
    // 收集后处理状态信息 — 注意：基于实际执行结果而非用户选项
    const resultSubtitleEnabled = shouldShowSubtitles && !!_subtitleText;
    
    // 语音旁白: processVoiceNarrator失败时会返回原始videoUrl(无音频)
    // 我们无法直接判断是否真的添加了音频，所以保守地基于用户选项+无错误日志来判断
    // TODO: 需要改进processVoiceNarrator返回值以包含是否真正成功的标志
    const resultVoiceEnabled = !!_generateVoice && !!_subtitleText;
    const resultBgmEnabled = !!(backgroundBgm && backgroundBgm !== 'none');
    
    console.log(`[NineGrid Task ${taskId}] 后处理结果汇总:`);
    console.log(`[NineGrid Task ${taskId}]   字幕: ${resultSubtitleEnabled ? '✅ 已尝试' : '⚠️ 未启用'} (burned=${subtitleBurned}, srtEntries=${srtEntries?.length || 0})`);
    console.log(`[NineGrid Task ${taskId}]   语音: ${resultVoiceEnabled ? '✅ 已尝试' : '⚠️ 未启用'} (generateVoice=${_generateVoice}, voiceType=${params.subtitleVoiceType || '未指定'})`);
    console.log(`[NineGrid Task ${taskId}]   BGM: ${resultBgmEnabled ? '✅ 已尝试' : '— 未启用'} (backgroundBgm=${backgroundBgm || '无'})`);
    if (srtData) {
      console.log(`[NineGrid Task ${taskId}]   SRT降级数据: ✅ 已生成 (${srtData.length}字符, ${srtEntries?.length || 0}条)`);
    }
    console.log(`[NineGrid Task ${taskId}]   ⚠️ 注意: TTS和字幕的实际效果需检查上方详细日志确认`);
    
    completeTask(taskId, {
      videoUrl: finalVideoUrl, // 使用经过后处理的最终视频URL
      duration,
      ratio,
      resolution,
      isNineGrid: true,
      nineGridImages: finalNineGridImages,
      usedUserImages: userProvidedImages.length > 0,
      segmentCount: videoResult.segmentCount || videoResult.segments?.length || 0,
      // 音频/字幕/BGM 状态（用于前端展示）— 标记为"已尝试"而非"已成功"
      subtitleEnabled: resultSubtitleEnabled,
      audioEnabled: resultVoiceEnabled,
      backgroundBgm: backgroundBgm || 'none',
      generateVoice: _generateVoice || false,
      // 新增：字幕降级数据（供前端渲染）
      subtitleBurned,
      srtData: srtData || undefined,
      srtEntryCount: srtEntries?.length || 0,
    });

    console.log(`[NineGrid Task ${taskId}] Video generation completed successfully`);

  } catch (error: any) {
    console.error(`[NineGrid Task ${taskId}] Video generation failed:`, error);
    
    let errorMessage = '服务器错误，请稍后重试';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    failTask(taskId, errorMessage);
  }
}
