import { NextRequest } from 'next/server';
import {
  compileFilmComposeAudio,
  concatFilmComposeVideos,
  storeFilmComposeUrl,
  synthesizeFilmComposeVoice,
} from '@/lib/film-compose-provider-clients';

/**
 * 影视创作 - 合成Agent
 * 将已生成的分镜视频直接拼接合成为最终影片
 * 使用SSE流式返回进度，避免长时间合成导致超时
 */

// 唯一可用的TTS声音
const WORKING_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

interface ComposeShot {
  id: string;
  videoUrl: string;
  narration?: string;
  dialogue?: string;
  duration?: number;
  emotion?: string;
  shotType?: string;
  cameraMovement?: string;
}

interface ComposeRequestBody {
  shots: ComposeShot[];
  enableSubtitle?: boolean;
  enableVoice?: boolean;
  bgmType?: string;
  bgmVolume?: 'low' | 'medium' | 'high';
  sfxType?: string | null;
  sfxVolume?: 'low' | 'medium' | 'high';
  style?: string;
}

// BGM预设URL映射
const BGM_PRESET_URLS: Record<string, string[]> = {
  'relaxed': [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  ],
  'upbeat': [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  ],
  'romantic': [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  ],
  'epic': [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  ],
  'nature': [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  ],
  'cinematic': [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
  ],
};

// 特效音预设URL映射（使用SoundHelix不同曲目模拟不同特效音）
const SFX_PRESET_URLS: Record<string, string> = {
  'transition': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
  'impact': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
  'whoosh': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
  'ambient': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
};

// 音量映射
const VOLUME_MAP: Record<string, number> = {
  'low': 0.2,
  'medium': 0.5,
  'high': 0.8,
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body: ComposeRequestBody = await request.json();
    const { shots, enableSubtitle = true, enableVoice = true, bgmType, bgmVolume = 'medium', sfxType, sfxVolume = 'medium' } = body;

    // 收集所有已有视频的分镜
    const validShots = (shots || []).filter((s: ComposeShot) => s.videoUrl);

    if (validShots.length === 0) {
      return new Response(
        JSON.stringify({ error: '没有可合成的视频素材' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 如果只有一个视频，直接返回（无需拼接）
    if (validShots.length === 1) {
      const shot = validShots[0];
      let audioUrl: string | undefined;
      if (enableVoice && (shot.narration || shot.dialogue)) {
        try {
          const text = shot.narration || shot.dialogue || '';
          audioUrl = await generateVoice(text, shot.emotion);
        } catch (e) {
          console.warn('[Film Compose] 语音生成失败:', e);
        }
      }

      // 单视频添加BGM
      let finalVideoUrl = shot.videoUrl;
      if (bgmType && BGM_PRESET_URLS[bgmType]) {
        try {
          const bgmUrls = BGM_PRESET_URLS[bgmType];
          const bgmUrl = bgmUrls[Math.floor(Math.random() * bgmUrls.length)];
          // 如果有旁白音频，先合并旁白和BGM；否则直接合并视频和BGM
          if (audioUrl) {
            const narratedVideoUrl = await compileVideoWithAudio(shot.videoUrl, audioUrl, true);
            finalVideoUrl = await compileVideoWithAudio(narratedVideoUrl, bgmUrl, true);
          } else {
            finalVideoUrl = await compileVideoWithAudio(shot.videoUrl, bgmUrl, true);
          }
        } catch (e) {
          console.warn('[Film Compose] 单视频BGM合成失败:', e);
        }
      } else if (audioUrl) {
        try {
          finalVideoUrl = await compileVideoWithAudio(shot.videoUrl, audioUrl, true);
        } catch (e) {
          console.warn('[Film Compose] 单视频音频合成失败:', e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        videoUrl: finalVideoUrl,
        audioUrl,
        bgmAdded: !!bgmType,
        message: '单镜头视频已完成',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 多视频合成：使用SSE流式返回进度
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ stage: 'start', message: `开始合成 ${validShots.length} 个分镜视频` });

          // Step 1: 转存视频到对象存储
          sendEvent({ stage: 'transfer', progress: 10, message: '转存视频到对象存储...' });
          const ownVideoUrls: string[] = [];

          for (let i = 0; i < validShots.length; i++) {
            const shot = validShots[i];
            try {
              sendEvent({ stage: 'transfer', progress: 10 + (i / validShots.length) * 20, message: `转存视频 ${i + 1}/${validShots.length}...` });
              const ownUrl = await storeFilmComposeUrl(shot.videoUrl, { timeout: 120000 });
              ownVideoUrls.push(ownUrl || shot.videoUrl);
              console.log(`[Film Compose] 视频${i}转存${ownUrl ? '成功' : '跳过，使用原始URL'}`);
            } catch (transferErr) {
              console.warn(`[Film Compose] 视频${i}转存失败:`, transferErr);
              ownVideoUrls.push(shot.videoUrl);
            }
          }

          // Step 2: 拼接视频（添加转场效果提升连续性）
          sendEvent({ stage: 'concat', progress: 35, message: '拼接视频中（含转场效果），请耐心等待...' });
          console.log('[Film Compose] 开始拼接视频（含转场）...');

          let mergedVideoUrl: string;
          try {
            // 为相邻视频段添加 crossfade 转场，提升视觉连续性
            // transitions 数组长度 = videos.length - 1，每个元素对应相邻两段之间的转场
            const transitions = ownVideoUrls.length > 1
              ? Array(ownVideoUrls.length - 1).fill('crossfade')
              : undefined;

            console.log(`[Film Compose] 拼接 ${ownVideoUrls.length} 段视频，转场: ${transitions ? transitions.length + '个crossfade' : '无'}`);

            const concatResponse = await concatFilmComposeVideos(ownVideoUrls, transitions);
            mergedVideoUrl = concatResponse.url;
            console.log('[Film Compose] 视频拼接完成:', mergedVideoUrl.substring(0, 80));
          } catch (concatError) {
            console.error('[Film Compose] 拼接失败:', concatError);
            sendEvent({
              stage: 'complete',
              success: true,
              videoUrl: ownVideoUrls[0],
              message: '视频拼接服务暂不可用，已返回首个分镜视频',
              fallback: true,
            });
            controller.close();
            return;
          }

          sendEvent({ stage: 'concat', progress: 60, message: '视频拼接完成' });

          // Step 3: 生成旁白语音
          let audioUrl: string | undefined;
          if (enableVoice) {
            const narrationTexts = validShots
              .map((s: ComposeShot) => s.narration || s.dialogue || '')
              .filter(Boolean);

            if (narrationTexts.length > 0) {
              try {
                sendEvent({ stage: 'voice', progress: 70, message: '生成旁白语音...' });
                const fullNarration = narrationTexts.join('。');
                // 提取主要情感用于调整TTS语速和风格
                const dominantEmotion = validShots
                  .map((s: ComposeShot) => s.emotion || '')
                  .filter(Boolean)
                  .join(',');
                audioUrl = await generateVoice(fullNarration, dominantEmotion || undefined);
                console.log('[Film Compose] 旁白音频生成完成');
              } catch (e) {
                console.warn('[Film Compose] 旁白生成失败:', e);
              }
            }
          }

          // Step 4: 合成旁白音频到视频
          let videoWithNarration = mergedVideoUrl;
          if (audioUrl) {
            try {
              sendEvent({ stage: 'audio_merge', progress: 75, message: '合成旁白音频...' });
              videoWithNarration = await compileVideoWithAudio(mergedVideoUrl, audioUrl, true);
              console.log('[Film Compose] 旁白音频合成完成');
            } catch (e) {
              console.warn('[Film Compose] 旁白音频合成失败:', e);
            }
          }

          // Step 5: 添加BGM
          let videoWithBgm = videoWithNarration;
          if (bgmType && BGM_PRESET_URLS[bgmType]) {
            try {
              sendEvent({ stage: 'bgm', progress: 82, message: '添加背景音乐...' });
              const bgmUrls = BGM_PRESET_URLS[bgmType];
              const bgmUrl = bgmUrls[Math.floor(Math.random() * bgmUrls.length)];
              videoWithBgm = await compileVideoWithAudio(videoWithNarration, bgmUrl, true);
              console.log('[Film Compose] BGM添加完成');
            } catch (e) {
              console.warn('[Film Compose] BGM添加失败:', e);
            }
          }

          // Step 6: 添加特效音
          let videoWithSfx = videoWithBgm;
          if (sfxType && SFX_PRESET_URLS[sfxType]) {
            try {
              sendEvent({ stage: 'sfx', progress: 88, message: '添加特效音...' });
              const sfxUrl = SFX_PRESET_URLS[sfxType];
              videoWithSfx = await compileVideoWithAudio(videoWithBgm, sfxUrl, true);
              console.log('[Film Compose] 特效音添加完成');
            } catch (e) {
              console.warn('[Film Compose] 特效音添加失败:', e);
            }
          }

          // Step 7: 转存最终视频
          sendEvent({ stage: 'storage', progress: 92, message: '保存最终视频...' });
          let finalVideoUrl = videoWithSfx;
          try {
            const storedFinalVideoUrl = await storeFilmComposeUrl(videoWithSfx, { timeout: 120000 });
            if (storedFinalVideoUrl) {
              finalVideoUrl = storedFinalVideoUrl;
              console.log('[Film Compose] 最终视频已转存到对象存储');
            }
          } catch (storageError) {
            console.warn('[Film Compose] 转存失败，使用原始URL:', storageError);
          }

          const totalDuration = validShots.reduce((sum: number, s: ComposeShot) => sum + (s.duration || 5), 0);

          // 最终结果
          sendEvent({
            stage: 'complete',
            success: true,
            videoUrl: finalVideoUrl,
            audioUrl,
            bgmAdded: !!bgmType,
            sfxAdded: !!sfxType,
            totalShots: validShots.length,
            totalDuration,
            progress: 100,
            message: `影片合成完成，共${validShots.length}个分镜，总时长约${totalDuration}秒${bgmType ? '，已添加背景音乐' : ''}${sfxType ? '，已添加特效音' : ''}`,
          });
          controller.close();

        } catch (error) {
          console.error('[Film Compose Agent] Error:', error);
          const message = error instanceof Error ? error.message : '未知错误';
          sendEvent({
            stage: 'error',
            success: false,
            error: `视频合成失败: ${message}`,
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Film Compose Agent] Error:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return new Response(
      JSON.stringify({ success: false, error: `视频合成失败: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 生成语音旁白
async function generateVoice(text: string, emotion?: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';

  console.log(`[Film Compose] 生成旁白语音，文本长度: ${text.length}，情感: ${emotion || '默认'}`);

  // 根据情感调整语速和风格提示
  const emotionPrefixMap: Record<string, string> = {
    '紧张': '【语气紧张、急促】', '焦急': '【语气焦急】', '激烈': '【语气激烈】', '愤怒': '【语气愤怒、有力】',
    '悲伤': '【语气悲伤、低沉】', '忧郁': '【语气忧郁、低缓】', '沉思': '【语气沉思、缓慢】', '安静': '【语气安静、轻柔】',
    '欢快': '【语气欢快、明亮】', '兴奋': '【语气兴奋、高昂】', '激动': '【语气激动】',
    '温柔': '【语气温柔、柔和】', '浪漫': '【语气浪漫、柔美】', '舒缓': '【语气舒缓、慢节奏】',
    '恐惧': '【语气恐惧、颤抖】', '惊悚': '【语气惊悚、低沉】',
    '严肃': '【语气严肃、庄重】', '庄重': '【语气庄重】',
    '轻松': '【语气轻松、自然】', '幽默': '【语气幽默、俏皮】',
  };
  let emotionPrefix = '';
  if (emotion) {
    for (const [key, prefix] of Object.entries(emotionPrefixMap)) {
      if (emotion.includes(key)) { emotionPrefix = prefix; break; }
    }
  }
  const textWithEmotion = emotionPrefix ? `${emotionPrefix}${text}` : text;

  try {
    const ttsResponse = await synthesizeFilmComposeVoice({
      uid: `film_compose_${Date.now()}`,
      text: textWithEmotion.substring(0, 2000), // TTS限制
      speaker: WORKING_SPEAKER,
      audioFormat: 'mp3',
    });

    if (!ttsResponse.audioUri) {
      throw new Error('TTS未返回音频');
    }

    try {
      const storedAudioUrl = await storeFilmComposeUrl(ttsResponse.audioUri, { timeout: 60000 });
      return storedAudioUrl || ttsResponse.audioUri;
    } catch (uploadErr) {
      console.warn('[Film Compose] 音频转存失败，使用原始URL:', uploadErr);
      return ttsResponse.audioUri;
    }
  } catch (error) {
    console.error('[Film Compose] TTS生成失败:', error);
    throw error;
  }
}

// 合成视频和音频（保留原视频音轨）
async function compileVideoWithAudio(videoUrl: string, audioUrl: string, reserveAudio: boolean): Promise<string> {
  console.log(`[Film Compose] 合成视频+音频, reserveAudio=${reserveAudio}`);
  const response = await compileFilmComposeAudio(videoUrl, audioUrl, reserveAudio);
  return response.url;
}
