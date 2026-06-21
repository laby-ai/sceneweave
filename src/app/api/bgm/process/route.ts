import { NextRequest, NextResponse } from 'next/server';
import { VideoEditClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { v4 as uuidv4 } from 'uuid';
import { TTSClient } from 'coze-coding-dev-sdk';
import { PRESET_BGM_MAP } from '@/lib/bgm-manager';

const videoEditConfig = new Config();
const ttsConfig = new Config();

// BGM类型→TTS描述映射（24种全覆盖）
const BGM_TTS_DESCRIPTIONS: Record<string, string> = {
  'relaxed': '轻柔舒缓的钢琴旋律，温暖治愈的氛围',
  'upbeat': '欢快节奏的流行音乐，鼓点清晰充满活力',
  'romantic': '温柔浪漫的小提琴旋律，甜蜜温馨的氛围',
  'epic': '宏大壮阔的交响乐，震撼人心的史诗级配乐',
  'nature': '鸟鸣啾啾，溪水潺潺，自然和谐的环境音',
  'cinematic': '电影级配乐，戏剧性的弦乐，紧张而富有张力',
  'electronic': '现代电子合成器音色，未来感和科技感强烈',
  'jazz': '优雅的爵士乐，萨克斯即兴演奏，温暖醇厚',
  'classical': '古典交响乐，庄重典雅，永恒经典',
  'rock': '电吉他和强劲鼓点，充满力量和反叛精神',
  'acoustic': '木吉他的民谣风格，质朴真诚，温暖怀旧',
  'ambient': '空灵的氛围音乐，大量混响和延音，深邃神秘',
  'suspense': '不协和音程和低频脉冲，营造不安和期待感',
  'comedy': '俏皮活泼的配乐，木管乐器和拨弦，轻松愉快',
  'corporate': '干净利落的商业配乐，传达信任和专业感',
  'lofi': '带颗粒感的低保真节拍，温暖怀旧，松弛舒适',
  'world': '各民族传统音乐元素，异域风情浓郁',
  'holiday': '喜庆热闹的节日音乐，欢乐祥和',
  'chinese': '古筝琵琶笛子等中国传统乐器，东方古韵',
  'trap': '重低音808鼓机和快速hi-hat，暗黑氛围说唱节拍',
  'rnb': '丝滑的R&B节奏，醇厚人声和电钢琴',
  'reggae': '轻松的雷鬼节拍，加勒比海岛风情',
  'motivational': '层层递进的钢琴和弦乐，从低沉到高昂的励志弧线',
  'retro': '80年代合成器波和复古迪斯科，霓虹复古美学',
};

// 获取预置音乐URL
function getPresetBgmUrl(type: string): string | null {
  const bgmInfo = PRESET_BGM_MAP[type];
  if (!bgmInfo || bgmInfo.urls.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * bgmInfo.urls.length);
  return bgmInfo.urls[randomIndex];
}

// 获取视频编辑客户端
function getVideoEditClient(customHeaders?: Record<string, string>) {
  return new VideoEditClient(videoEditConfig, customHeaders);
}

// 获取TTS客户端
function getTTSClient(customHeaders?: Record<string, string>) {
  return new TTSClient(ttsConfig, customHeaders);
}

// 带重试的TTS调用
async function ttsWithRetry(
  ttsClient: TTSClient,
  params: any,
  maxRetries: number = 3
): Promise<string | null> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BGM Process] TTS第${attempt}次尝试...`);
      const response = await ttsClient.synthesize(params);
      
      if (response.audioUri) {
        console.log(`[BGM Process] TTS第${attempt}次成功`);
        return response.audioUri;
      }
      
      lastError = new Error('TTS响应没有audioUri');
    } catch (error) {
      lastError = error;
      console.error(`[BGM Process] TTS第${attempt}次失败:`, error);
    }
    
    if (attempt < maxRetries) {
      const delay = 2000 * attempt;
      console.log(`[BGM Process] 等待${delay}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error('[BGM Process] TTS最终失败:', lastError);
  return null;
}

// 带重试的音视频合并
async function mergeWithRetry(
  videoEditClient: VideoEditClient,
  videoUrl: string,
  audioUrl: string,
  maxRetries: number = 3
): Promise<string | null> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BGM Process] 合并第${attempt}次尝试...`);
      const response = await videoEditClient.compileVideoAudio(
        videoUrl,
        audioUrl,
        {
          isVideoAudioSync: false,
          isAudioReserve: false,
        }
      );
      
      if (response.url) {
        console.log(`[BGM Process] 合并第${attempt}次成功`);
        return response.url;
      }
      
      lastError = new Error('合并响应没有url');
    } catch (error) {
      lastError = error;
      console.error(`[BGM Process] 合并第${attempt}次失败:`, error);
    }
    
    if (attempt < maxRetries) {
      const delay = 2000 * attempt;
      console.log(`[BGM Process] 等待${delay}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error('[BGM Process] 合并最终失败:', lastError);
  return null;
}

// 多级背景音乐处理
export async function POST(request: NextRequest) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  
  try {
    const body = await request.json();
    const { videoUrl, bgmType, customAudioUrl } = body;

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少视频URL参数'
      }, { status: 400 });
    }

    console.log('[BGM Process] ========== 开始处理背景音乐 ==========');
    console.log('[BGM Process] 视频URL:', videoUrl);
    console.log('[BGM Process] BGM类型:', bgmType);

    // 如果有自定义音频，优先使用
    if (customAudioUrl) {
      console.log('[BGM Process] 使用自定义音频:', customAudioUrl);
      const videoEditClient = getVideoEditClient(customHeaders);
      const result = await mergeWithRetry(videoEditClient, videoUrl, customAudioUrl);
      
      if (result) {
        return NextResponse.json({
          success: true,
          url: result,
          source: 'custom',
        });
      }
    }

    // 一级：使用预置音乐（最稳定，无需外部API）
    const presetUrl = getPresetBgmUrl(bgmType);
    if (presetUrl) {
      console.log('[BGM Process] 使用预置音乐:', presetUrl);
      
      // 预置音乐直接返回URL，让前端在播放时处理
      // 这样避免了跨域和CDN访问问题
      return NextResponse.json({
        success: true,
        url: presetUrl,
        source: 'preset',
        note: '预置音乐由前端直接播放，无需合并到视频'
      });
    }

    // 二级：TTS生成（带重试）
    const ttsPrompt = BGM_TTS_DESCRIPTIONS[bgmType];
    if (ttsPrompt) {
      console.log('[BGM Process] 开始TTS生成...');
      const ttsClient = getTTSClient(customHeaders);
      
      const audioUri = await ttsWithRetry(ttsClient, {
        uid: uuidv4(),
        text: ttsPrompt,
        speaker: 'zh_female_xiaohe_uranus_bigtts',
        audioFormat: 'mp3',
        sampleRate: 24000,
        speechRate: 0,
      });

      if (audioUri) {
        console.log('[BGM Process] TTS生成成功，合并到视频...');
        const videoEditClient = getVideoEditClient(customHeaders);
        const result = await mergeWithRetry(videoEditClient, videoUrl, audioUri);
        
        if (result) {
          return NextResponse.json({
            success: true,
            url: result,
            source: 'tts',
          });
        }
      }
    }

    // 三级：所有方案都失败时，尝试返回任意预置音乐作为最终兜底
    const fallbackBgm = getPresetBgmUrl('relaxed');
    console.log('[BGM Process] 所有BGM方案都失败，返回兜底预置音乐');
    return NextResponse.json({
      success: true,
      url: fallbackBgm || videoUrl,
      source: fallbackBgm ? 'fallback' : 'original',
      degraded: true,
      note: fallbackBgm ? '首选方案不可用，已降级到预置音乐' : '无可用音乐，返回原视频',
    });

  } catch (error: any) {
    console.error('[BGM Process] 处理异常:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// 获取可用的BGM类型
export async function GET() {
  return NextResponse.json({
    success: true,
    types: Object.entries(PRESET_BGM_MAP).map(([key, value]) => ({
      type: key,
      name: value.name,
      description: value.description,
      urlCount: value.urls.length,
    })),
    note: '预置音乐来自Pixabay免版权CDN，Web Audio为浏览器端备选方案'
  });
}
