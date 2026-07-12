import { NextRequest, NextResponse } from 'next/server';
import { createTask, startTask, updateTaskProgress, completeTask, failTask } from '@/lib/task-manager';
import {
  extractBYOKConnection,
  type BYOKConnection,
} from '@/lib/byok-provider';
import { buildBYOKConfigErrorPayload, isBYOKConfigError } from '@/lib/byok-response';
import { runBYOKVideoSubmit } from '@/lib/video-submit-provider';
import { resolveTaskOwnerFromRequest } from '@/lib/task-access';
// 导入视频后处理工具
import {
  processBackgroundMusic,
  processVoiceNarration,
  processVideoText,
  processSubtitles,
  BGM_MAP,
  type SubtitleParams,
  type BgmResult,
} from '@/lib/video-post-processing';

const FORWARD_HEADER_KEYS = [
  'x-yh-provider',
  'x-yh-api-base',
  'x-yh-api-key',
  'x-yh-model',
  'x-yh-image-model',
  'x-yh-video-model',
  'x-yh-audio-model',
] as const;

function extractForwardHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of FORWARD_HEADER_KEYS) {
    const value = headers.get(key);
    if (value) result[key] = value;
  }
  return result;
}

// 根据关键词猜测背景音乐类型（自动后期本地规则）
function guessBgmType(text: string): string {
  const lower = text.toLowerCase();
  if (/浪漫|爱情|温馨|甜蜜|温暖|温柔|恋爱/.test(lower)) return 'romantic';
  if (/激烈|战斗|史诗|震撼|壮观|冒险|冲击/.test(lower)) return 'epic';
  if (/快乐|欢快|活力|运动|跳舞|派对|节奏/.test(lower)) return 'upbeat';
  if (/自然|山水|森林|海洋|鸟鸣|溪流|户外|花园|草地|田野|春|夏|秋|冬|花|雨|雪/.test(lower)) return 'nature';
  if (/电影|故事|叙事|悬疑|剧情|戏剧/.test(lower)) return 'cinematic';
  if (/放松|宁静|安静|冥想|睡眠|舒适|悠闲/.test(lower)) return 'relaxed';
  return 'cinematic';
}

export async function POST(request: NextRequest) {
  const owner = await resolveTaskOwnerFromRequest(request);
  if (!owner) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    const body = await request.json();
    const customHeaders = extractForwardHeaders(request.headers);
    let byokConnection: BYOKConnection | undefined;
    try {
      byokConnection = extractBYOKConnection(request.headers);
    } catch (error) {
      if (isBYOKConfigError(error)) {
        return NextResponse.json(buildBYOKConfigErrorPayload(error), { status: 400 });
      }
      throw error;
    }

    // 统一使用后台生成模式（支持音频和字幕后处理）
    // 注意：同步模式已废弃，所有请求都通过后台任务处理以支持完整的后处理流程
    const {
      prompt,
      duration = 5,
      materials = [],
      firstFrameUrl, // 前镜头尾帧URL，作为首帧参考图确保视觉连贯
      backgroundBgm,
      customAudio,
      // 自动后期处理开关
      autoPostProcess = false,
      // 字幕和视频文字参数
      enableSubtitle,
      subtitleText,
      subtitlePosition,
      subtitleFontSize,
      subtitleColor,
      subtitleVoiceType,
      subtitleSpeechSpeed,
      generateVoice,
      // 字幕样式扩展
      subtitleFontWeight,
      subtitleBackgroundColor,
      subtitleBackgroundOpacity,
      subtitleBorderColor,
      subtitleBorderWidth,
      subtitleShadowColor,
      subtitleShadowEnabled,
      subtitleAlignment,
      subtitleCustomPositionY,
      subtitleFontType,
      // 视频文字相关
      enableVideoText,
      videoText,
      videoTextPosition,
      videoTextStartTime,
      videoTextEndTime,
      useMultiSegmentVideoText,
      videoTextSegments,
      // 语音旁白时是否显示字幕
      showSubtitleWithVoice = true, // 默认显示字幕
      // 角色参考图URLs，用于视频生成时确保角色视觉一致性
      characterRefUrls = [] as string[],
      // 全局视觉风格（如'电影感'、'卡通'），用于prompt风格锁定
      filmVisualStyle,
      // 尾帧参考图URL（前端传入的结束帧参考）
      inputLastFrameUrl,
      videoModel,
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
      return NextResponse.json(
        { error: '请提供至少2个字符的描述' },
        { status: 400 }
      );
    }

    // ===== 风格锁定：注入全局视觉风格到视频提示词 =====
    let styleLockedPrompt = prompt;
    if (filmVisualStyle) {
      try {
        const { VISUAL_STYLE_MAP } = await import('@/lib/visual-style-map');
        const vsEntry = VISUAL_STYLE_MAP[filmVisualStyle as keyof typeof VISUAL_STYLE_MAP];
        if (vsEntry) {
          const lockPhrase = vsEntry.lockPhrase || '';
          const prefix = vsEntry.prefix || '';
          if (lockPhrase) {
            styleLockedPrompt = `${lockPhrase}, ${prompt}`;
          }
          if (prefix && !prompt.includes(prefix)) {
            styleLockedPrompt = `${styleLockedPrompt}, ${prefix}`;
          }
        }
      } catch {
        // Keep the original prompt when the optional style map cannot load.
      }
    }

    // ===== 自动后期处理：本地生成字幕旁白+推荐背景音乐 =====
    let finalEnableSubtitle = enableSubtitle;
    let finalGenerateVoice = generateVoice;
    let finalSubtitleText = subtitleText;
    let finalBackgroundBgm = backgroundBgm;
    let autoPostResult: { subtitleText?: string; bgmType?: string } | null = null;

    if (autoPostProcess) {
      autoPostResult = {
        subtitleText: prompt.trim(),
        bgmType: guessBgmType(prompt.trim()),
      };

      // 应用自动后期结果
      if (autoPostResult) {
        if (!finalSubtitleText && autoPostResult.subtitleText) {
          finalSubtitleText = autoPostResult.subtitleText;
        }
        if (!finalBackgroundBgm && autoPostResult.bgmType) {
          finalBackgroundBgm = autoPostResult.bgmType;
        }
        finalEnableSubtitle = true;
        finalGenerateVoice = true;
      }
    }

    if (!byokConnection) {
      return NextResponse.json(
        {
          error: '视频生成主链路已关闭 legacy provider fallback。请在设置页配置 Ark Plan BYOK API Base、API Key 和视频模型后再生成。',
          provider: 'byok',
          usedRealKey: false,
          incurredCost: false,
        },
        { status: 400 }
      );
    }

    // 创建任务
    const taskId = createTask({
      type: 'video',
      owner,
      params: {
        prompt: styleLockedPrompt.trim(),
        duration: duration,
        materials: materials,
        backgroundBgm: finalBackgroundBgm,
        customAudio: customAudio,
        // 字幕参数
        enableSubtitle: finalEnableSubtitle,
        subtitleText: finalSubtitleText,
        enableVideoText,
        videoText,
        videoTextSegments,
      }
    });

    startTask(taskId);

    // 异步执行（BYOK-only，不回退到服务端默认模型）
    (async () => {
      try {
        // === 视频生成：始终使用异步模式，提供实时进度 ===
        let videoUrl: string | null = null;
        let providerLastFrameUrl: string | null = null;

        updateTaskProgress(taskId, 10, '正在提交视频生成任务（Ark BYOK）...');
        const byokResult = await runBYOKVideoSubmit({
          connection: byokConnection,
          observation: { owner, taskId },
          prompt: styleLockedPrompt.trim(),
          videoModel,
          duration,
          ratio: '16:9',
          firstFrameUrl,
          inputLastFrameUrl,
          materials,
          characterRefUrls,
          onSubmitted: () => {
            updateTaskProgress(taskId, 15, '视频任务已提交到 Ark，排队中...');
          },
          onProgress: (status, attempt) => {
            const ep = status.status === 'running'
              ? Math.min(80, 20 + Math.floor(attempt * 1.2))
              : Math.min(35, 15 + attempt);
            updateTaskProgress(taskId, ep, `Ark 视频生成中... ${status.rawStatus || status.status}`);
          },
        });
        videoUrl = byokResult.videoUrl;
        providerLastFrameUrl = byokResult.lastFrameUrl || null;
        updateTaskProgress(taskId, 85, '视频生成完成，后处理中...');

        if (!videoUrl) {
          throw new Error('视频生成失败：未获取到视频URL');
        }

        // 处理背景音乐（允许失败后继续保留原视频）
        let bgmResult: BgmResult = { videoUrl, source: 'none' };
        if (finalBackgroundBgm && finalBackgroundBgm !== 'none') {
          if (finalBackgroundBgm === 'custom' && customAudio) {
            updateTaskProgress(taskId, 60, '正在添加自定义音频...');
            
            try {
              bgmResult = await processBackgroundMusic(videoUrl, finalBackgroundBgm, customHeaders, undefined, customAudio);
              videoUrl = bgmResult.videoUrl;
            } catch {
              // Preserve the generated video when optional audio processing fails.
            }
          } else if (BGM_MAP[finalBackgroundBgm]) {
            updateTaskProgress(taskId, 60, '正在添加背景音乐...');
            
            try {
              bgmResult = await processBackgroundMusic(videoUrl, finalBackgroundBgm, customHeaders);
              videoUrl = bgmResult.videoUrl;
            } catch {
              // Preserve the generated video when optional music processing fails.
            }
          }
        }

        // 处理语音旁白（在BGM之后、视频文字之前 - 音频处理优先）
        if (finalGenerateVoice && finalSubtitleText) {
          updateTaskProgress(taskId, 65, '正在生成语音旁白...');
          
          try {
            videoUrl = await processVoiceNarration(
              videoUrl,
              finalSubtitleText,
              subtitleVoiceType || 'female_tianmei',
              subtitleSpeechSpeed || 1.0,
              customHeaders
            );
          } catch {
            // Voiceover is optional; retain the source video on failure.
          }
        }

        // 处理视频文字（视觉层）
        if (enableVideoText) {
          const videoTextParams: SubtitleParams = {
            enableSubtitle: false,
            enableVideoText,
            videoText,
            videoTextPosition,
            videoTextStartTime,
            videoTextEndTime,
            useMultiSegmentVideoText,
            videoTextSegments,
          };
          
          updateTaskProgress(taskId, 65, '正在添加视频文字...');
          
          try {
            videoUrl = await processVideoText(videoUrl, videoTextParams, customHeaders);
          } catch {
            // Text overlay is optional; retain the source video on failure.
          }
        }

        // 处理字幕（根据showSubtitleWithVoice决定是否显示）
        const shouldShowSubtitlesBg = finalEnableSubtitle && !(finalGenerateVoice && showSubtitleWithVoice === false);
        if (shouldShowSubtitlesBg) {
          const subtitleParams: SubtitleParams = {
            enableSubtitle: finalEnableSubtitle,
            subtitleText: finalSubtitleText,
            subtitlePosition,
            subtitleFontSize,
            subtitleColor,
            subtitleVoiceType,
            subtitleSpeechSpeed,
            generateVoice: finalGenerateVoice,
            // 字幕样式扩展
            subtitleFontWeight,
            subtitleBackgroundColor,
            subtitleBackgroundOpacity,
            subtitleBorderColor,
            subtitleBorderWidth,
            subtitleShadowColor,
            subtitleShadowEnabled,
            subtitleAlignment,
            subtitleCustomPositionY,
            subtitleFontType: subtitleFontType || 'noto',
            // 视频文字相关（字幕处理不需要）
            enableVideoText: false,
          };
          
          updateTaskProgress(taskId, 75, '正在添加字幕...');
          
          try {
            const subResult = await processSubtitles(videoUrl, subtitleParams, customHeaders);
            videoUrl = subResult.videoUrl;  // 提取videoUrl
          } catch {
            // Subtitle rendering is optional; retain the source video on failure.
          }
        }

        updateTaskProgress(taskId, 90, '视频生成完成...');

        // 提取最后一帧（优先使用视频供应商返回的 lastFrameUrl，否则调用帧提取 API）
        let lastFrameUrl: string | undefined = providerLastFrameUrl || undefined;
        if (!lastFrameUrl) {
          try {
            const frameResponse = await fetch('http://localhost:5000/api/video/extract-last-frame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl }),
            });
            
            if (frameResponse.ok) {
              const frameData = await frameResponse.json();
              if (frameData.success && frameData.frameUrl) {
                lastFrameUrl = frameData.frameUrl;
              }
            }
          } catch {
            // A provider tail frame is optional for a completed single video.
          }
        }

        // 完成任务
        completeTask(taskId, {
          videoUrl,
          lastFrameUrl,
          backgroundBgm: finalBackgroundBgm,
          enableSubtitle: finalEnableSubtitle,
          generateVoice: finalGenerateVoice,
          subtitleText: finalSubtitleText,
          enableVideoText: enableVideoText,
          provider: 'byok',
          degraded: false,
          autoPostProcess,
        });

      } catch (error) {
        const msg = error instanceof Error ? error.message : '生成失败';
        failTask(taskId, msg);
      }
    })();

    return NextResponse.json({
      taskId,
      message: '视频生成任务已创建'
    });

  } catch {
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
