/**
 * 视频后处理工具模块
 * 包含音频、字幕、视频文字等后处理功能
 * 
 * 此模块被以下位置引用：
 * - /api/video/submit/route.ts (普通视频生成)
 * - /api/video/nine-grid/route.ts (九宫格视频生成)
 */

import { VideoEditClient, TTSClient, Config } from 'coze-coding-dev-sdk';
import { ttsOrchestrate } from './tts-orchestrator';

// ========== 辅助函数 ==========
function getVideoEditClient(customHeaders?: Record<string, string>) {
  // 使用默认Config（不设置baseUrl，让SDK使用内部默认值）
  const config = new Config();
  return new VideoEditClient(config, customHeaders);
}

function getTTSClient(customHeaders?: Record<string, string>) {
  // 使用默认Config（不设置baseUrl，让SDK使用内部默认值）
  const config = new Config();
  return new TTSClient(config, customHeaders);
}

// ========== 类型定义 ==========

// 字幕配置类型
export interface SubtitleParams {
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: 'top' | 'middle' | 'bottom' | 'custom';
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  // 字幕样式扩展
  subtitleFontWeight?: string;
  subtitleBackgroundColor?: string;
  subtitleBackgroundOpacity?: number;
  subtitleBorderColor?: string;
  subtitleBorderWidth?: number;
  subtitleShadowColor?: string;
  subtitleShadowEnabled?: boolean;
  subtitleAlignment?: 'left' | 'center' | 'right';
  subtitleCustomPositionY?: number;
  subtitleFontType?: string; // 字体类型（如 'noto', 'simhei', 'simsun' 等，用于解决中文乱码）
  // 视频文字相关
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
    // 扩展属性
    alignment?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    backgroundOpacity?: number;
    borderColor?: string;
    borderWidth?: number;
    shadowColor?: string;
    shadowEnabled?: boolean;
    fontWeight?: 'normal' | 'bold';
  }>;
}

// BGM处理结果类型
export type BgmResult = {
  videoUrl: string;
  bgmUrl?: string;
  source: 'preset' | 'tts' | 'custom' | 'none';
};

// ========== 字幕降级方案相关类型 ==========

/**
 * SRT字幕条目
 */
export interface SrtEntry {
  index: number;
  startTime: string;  // 格式: "00:00:01,000"
  endTime: string;    // 格式: "00:00:04,000"
  text: string;
}

/**
 * 字幕处理结果（支持服务端烧录 + 前端降级两种模式）
 */
export interface SubtitleProcessResult {
  videoUrl: string;           // 视频URL（可能已烧录字幕，也可能没有）
  subtitleBurned: boolean;    // 是否成功烧录字幕到视频
  srtData?: string;           // SRT格式字幕数据（供前端渲染降级使用）
  srtEntries?: SrtEntry[];    // 结构化字幕条目（供前端自定义渲染）
}

// 背景音乐配置 - 使用描述性文本生成环境音
export const BGM_MAP: Record<string, { 
  description: string; 
  prompt: string;
  mood: string;
}> = {
  'relaxed': { 
    description: '轻松舒缓', 
    prompt: '轻柔的钢琴曲，缓慢的节奏，适合放松和冥想',
    mood: 'calm'
  },
  'energetic': { 
    description: '活力动感', 
    prompt: '节奏明快的电子音乐，充满活力的节拍',
    mood: 'energetic'
  },
  'cinematic': { 
    description: '电影史诗', 
    prompt: '宏大的管弦乐，电影配乐风格，戏剧性',
    mood: 'epic'
  },
  'nature': { 
    description: '自然白噪音', 
    prompt: '自然声音：鸟鸣、流水声、微风',
    mood: 'peaceful'
  },
  'lofi': { 
    description: 'Lo-Fi 氛围', 
    prompt: 'Lo-Fi hip hop beats，柔和的背景音乐，适合学习工作',
    mood: 'chill'
  },
  'jazz': { 
    description: '爵士氛围', 
    prompt: 'Smooth jazz，优雅的萨克斯风，温馨的酒吧氛围',
    mood: 'sophisticated'
  },
  'electronic': { 
    description: '电子合成', 
    prompt: '现代电子音乐，合成器音效，未来感',
    mood: 'modern'
  },
  'acoustic': { 
    description: '原声吉他', 
    prompt: '木吉他弹奏，温暖的原声音乐，民谣风格',
    mood: 'warm'
  },
};

// ========== 处理背景音乐 - 多级降级方案 ==========

/**
 * 处理背景音乐
 * 一级：预置免费音乐URL（最稳定，无需外部API）
 * 二级：TTS生成（带重试）
 * 三级：VideoEdit合并
 */
export async function processBackgroundMusic(
  videoUrl: string,
  backgroundBgm: string,
  customHeaders?: Record<string, string>,
  onProgress?: (message: string) => void,
  customAudio?: { url: string; name: string },
  maxRetries: number = 3
): Promise<BgmResult> {
  console.log('[BGM] ========== 开始处理背景音乐 ==========');
  console.log('[BGM] 背景音乐类型:', backgroundBgm);

  // 处理自定义音频（优先）
  if (backgroundBgm === 'custom' && customAudio?.url) {
    console.log('[BGM] 使用自定义音频:', customAudio.url);
    onProgress?.('正在处理自定义音频...');

    let compileSuccess = false;
    let compileError: any = null;
    
    for (let retry = 0; retry < maxRetries && !compileSuccess; retry++) {
      try {
        const videoEditClient = getVideoEditClient(customHeaders);
        console.log(`[BGM] 第${retry + 1}次尝试合并自定义音频...`);

        const compileResponse = await videoEditClient.compileVideoAudio(
          videoUrl,
          customAudio.url,
          {
            isVideoAudioSync: false,
            isAudioReserve: false,
          }
        );

        console.log('[BGM] VideoEdit响应:', JSON.stringify(compileResponse));

        if (compileResponse.url) {
          compileSuccess = true;
          console.log(`[BGM] 第${retry + 1}次成功!`);
          return {
            videoUrl: compileResponse.url,
            source: 'custom' as const,
            bgmUrl: customAudio.url,
          };
        }
        
        compileError = new Error('响应中没有URL');
      } catch (error) {
        console.error(`[BGM] 第${retry + 1}次失败:`, error);
        compileError = error;
        if (retry < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
        }
      }
    }

    console.error('[BGM] 自定义音频处理失败:', compileError);
    throw compileError || new Error('自定义音频处理失败');
  }

  // 预置BGM类型
  const bgmConfig = BGM_MAP[backgroundBgm];
  if (!bgmConfig) {
    console.warn('[BGM] 未知的BGM类型:', backgroundBgm);
    return { videoUrl, source: 'none' as const };
  }

  console.log('[BGM] BGM配置:', bgmConfig.description);
  onProgress?.(`正在添加${bgmConfig.description}背景音乐...`);

  // 方案一：尝试使用预置的免费音乐URL
  const presetMusicUrls: Record<string, string> = {
    'relaxed': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'energetic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'cinematic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'nature': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', // 较安静
    'lofi': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'jazz': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    'electronic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'acoustic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  };

  const presetUrl = presetMusicUrls[backgroundBgm];
  
  if (presetUrl) {
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const videoEditClient = getVideoEditClient(customHeaders);
        console.log(`[BGM] 尝试预设URL第${retry + 1}次...`);

        const compileResponse = await videoEditClient.compileVideoAudio(
          videoUrl,
          presetUrl,
          {
            isVideoAudioSync: false,
            isAudioReserve: false,
          }
        );

        console.log('[BGM] 预设URL响应:', JSON.stringify(compileResponse));

        if (compileResponse.url) {
          console.log(`[BGM] 预设URL第${retry + 1}次成功!`);
          return {
            videoUrl: compileResponse.url,
            source: 'preset' as const,
            bgmUrl: presetUrl,
          };
        }
      } catch (error) {
        console.error(`[BGM] 预设URL第${retry + 1}次失败:`, error);
        if (retry < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
        }
      }
    }
  }

  // 方案二：TTS生成环境音作为降级方案
  console.log('[BGM] 尝试TTS生成环境音...');
  onProgress?.('正在生成环境音...');
  
  try {
    const ttsClient = getTTSClient(customHeaders);
    
    const ttsResponse = await ttsClient.synthesize({
      uid: `bgm_${Date.now()}`,
      text: `请播放一段${bgmConfig.mood}风格的背景音乐，${bgmConfig.prompt}，时长约30秒`,
      speaker: 'zh_female_tianmei_moon_bigtts',
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: 0,
      loudnessRate: 0,
    });

    console.log('[BGM] TTS响应:', JSON.stringify(ttsResponse));

    if (ttsResponse.audioUri) {
      const videoEditClient = getVideoEditClient(customHeaders);
      
      const compileResponse = await videoEditClient.compileVideoAudio(
        videoUrl,
        ttsResponse.audioUri,
        {
          isVideoAudioSync: false,
          isAudioReserve: false,
        }
      );

      if (compileResponse.url) {
        console.log('[BGM] TTS降级成功!');
        return {
          videoUrl: compileResponse.url,
          source: 'tts' as const,
          bgmUrl: ttsResponse.audioUri,
        };
      }
    }
  } catch (ttsError) {
    console.error('[BGM] TTS降级失败:', ttsError);
  }

  // 所有方案都失败，返回原始视频
  console.warn('[BGM] 所有方案都失败，返回原始视频');
  return { videoUrl, source: 'none' as const };
}

// ========== TTS 可用说话人运行时检测与缓存 ==========

/**
 * MiniMax TTS 所有已知的说话人 ID（官方文档声明支持）
 * 
 * ⚠️ 注意：实际可用性取决于平台配置
 * 通过 probeAvailableSpeakers() 在运行时自动检测哪些可用
 */
const ALL_KNOWN_SPEAKERS: { id: string; name: string; gender: 'female' | 'male'; lang: string }[] = [
  // 中文女声 (bigtts 高质量模型)
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小禾', gender: 'female', lang: 'zh' },
  { id: 'zh_female_tianmei_moon_bigtts', name: '甜美', gender: 'female', lang: 'zh' },
  { id: 'zh_female_shuangkuaisi_moon_bigtts', name: '爽快思', gender: 'female', lang: 'zh' },
  // 中文男声 (bigtts 高质量模型)
  { id: 'zh_male_chunlv_moon_bigtts', name: '春绿', gender: 'male', lang: 'zh' },
  { id: 'zh_male_tianshu_moon_bigtts', name: '天书', gender: 'male', lang: 'zh' },
];

/**
 * 运行时可用音色由当前显式 TTS 集成探测。
 */

/** 缓存的可用说话人列表（首次检测后持久化） */
let cachedAvailableSpeakers: string[] | null = null;
let speakerProbeInProgress = false;

/** 兜底可用说话人（经验证始终可用） */
const WORKING_SPEAKER_FALLBACK = 'zh_female_xiaohe_uranus_bigtts';

/**
 * 探测当前环境可用的 TTS 说话人
 * 
 * 工作原理：
 * 1. 对每个已知说话人发送最简TTS请求（"你好"，2个字）
 * 2. 检查响应 code==0 表示可用，code=55000000(mismatched)表示不可用
 * 3. 缓存结果避免重复探测
 * 
 * @returns 可用说话人ID列表（按优先级排序）
 */
export async function probeAvailableSpeakers(
  customHeaders?: Record<string, string>
): Promise<string[]> {
  // 已有缓存直接返回
  if (cachedAvailableSpeakers && cachedAvailableSpeakers.length > 0) {
    return cachedAvailableSpeakers;
  }
  
  // 防止并发重复探测
  if (speakerProbeInProgress) {
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (!speakerProbeInProgress || cachedAvailableSpeakers) {
          clearInterval(check);
          resolve();
        }
      }, 200);
    });
    return cachedAvailableSpeakers || [WORKING_SPEAKER_FALLBACK];
  }

  speakerProbeInProgress = true;
  console.log('[TTS Probe] ========== 开始探测可用说话人 ==========');
  
  const available: string[] = [];
  const testText = '你好';

  for (const speaker of ALL_KNOWN_SPEAKERS) {
    try {
      const ttsClient = getTTSClient(customHeaders);
      const response = await ttsClient.synthesize({
        uid: `probe_${speaker.id}`,
        text: testText,
        speaker: speaker.id,
        audioFormat: 'mp3',
        sampleRate: 24000,
      });

      if (response && response.audioUri) {
        available.push(speaker.id);
        console.log(`[TTS Probe] ✅ ${speaker.name} (${speaker.id}) — 可用`);
      } else {
        console.log(`[TTS Probe] ❌ ${speaker.name} (${speaker.id}) — 无音频返回`);
      }
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const isMismatched = errMsg.includes('mismatched') || errMsg.includes('resource');
      console.log(
        `[TTS Probe] ${isMismatched ? '⚠️' : '❌'} ${speaker.name} (${speaker.id})` +
        ` — ${isMismatched ? '未配置' : errMsg.substring(0, 60)}`
      );
    }
  }

  console.log(`[TTS Probe] 探测完成: ${available.length}/${ALL_KNOWN_SPEAKERS.length} 个可用`);
  
  if (available.length > 0) {
    cachedAvailableSpeakers = available;
  } else {
    cachedAvailableSpeakers = [WORKING_SPEAKER_FALLBACK];
    console.warn(`[TTS Probe] ⚠️ 全部不可用，使用兜底: ${WORKING_SPEAKER_FALLBACK}`);
  }

  speakerProbeInProgress = false;
  return cachedAvailableSpeakers;
}

/**
 * 获取最佳匹配的可用说话人ID
 * 根据用户选择的voiceType和性别偏好，从可用列表中选择最合适的
 */
export async function resolveBestSpeaker(
  voiceType: string,
  customHeaders?: Record<string, string>
): Promise<string> {
  const available = await probeAvailableSpeakers(customHeaders);
  
  if (available.length === 1) {
    if (available[0] !== voiceType) {
      console.log(`[Voice] 仅${available[0]}可用(请求:${voiceType})，使用唯一可用声`);
    }
    return available[0];
  }

  if (available.includes(voiceType)) {
    return voiceType;
  }

  const isMale = voiceType.includes('male') || voiceType === 'male';
  const genderMatch = available.find(id => 
    isMale ? id.includes('male') : id.includes('female')
  );
  if (genderMatch) {
    console.log(`[Voice] 性别匹配: ${voiceType} → ${genderMatch}`);
    return genderMatch;
  }

  console.log(`[Voice] 无精确/性别匹配(${voiceType})，使用默认: ${available[0]}`);
  return available[0];
}

// ========== 处理语音旁白 ==========

/**
 * 前端voiceType到当前 TTS 说话人ID的映射
 *
 * ⚠️ 重要：经过实测验证（2026-02），当前环境仅配置了 1 个可用说话人：
 *   ✅ zh_female_xiaohe_uranus_bigtts (小禾/女声) — 唯一可用
 *   ❌ 所有其他ID（长短格式）均返回 "resource ID is mismatched"
 *
 * 策略：每个voiceType先尝试其理想说话人，最终回退到唯一可用的女声
 *
 * ⚠️ 注意：男声类 voiceType 不再强制回退女声。
 * 最终 Provider 选择由 ttsOrchestrator 按匹配度动态决定。
 */
const WORKING_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

const VOICE_TYPE_MAP: Record<string, string[]> = {
  // 女声 - 包含可用女声作为候选
  'female': [WORKING_SPEAKER],
  'female_tianmei': ['zh_female_tianmei_moon_bigtts', WORKING_SPEAKER],
  'female_shuang': ['zh_female_shuangkuaisi_moon_bigtts', WORKING_SPEAKER],
  // 男声 - 不回退女声（让编排器选择可用男声音色）
  'male': ['zh_male_chunlv_moon_bigtts'],
  'male_tianshu': ['zh_male_tianshu_moon_bigtts'],
};

/**
 * 获取TTS候选说话人ID列表（Coze Provider专用）
 *
 * 仅返回 Coze 集成TTS 的候选。最终选择由 ttsOrchestrator 按匹配度调度。
 */
function getCandidateSpeakerIds(voiceType: string): string[] {
  if (voiceType.startsWith('zh_')) {
    return [voiceType];
  }
  const candidates = VOICE_TYPE_MAP[voiceType];
  if (candidates && candidates.length > 0) {
    console.log(`[Voice] Coze候选列表: ${voiceType} → ${candidates.join(', ')}`);
    return candidates;
  }
  console.warn(`[Voice] 未知的voiceType '${voiceType}'，Coze无候选`);
  return [];
}

/**
 * 处理语音旁白 - 使用TTS生成并合并到视频
 *
 * 增强版：运行时自动探测可用说话人 + 多候选自动切换
 * 优先使用 resolveBestSpeaker() 的检测结果，失败时回退到静态候选列表
 */
export async function processVoiceNarration(
  videoUrl: string,
  subtitleText: string,
  voiceType: string = 'female_tianmei',
  speechSpeed: number = 1.0,
  customHeaders?: Record<string, string>,
  onProgress?: (message: string) => void,
  maxRetries: number = 3
): Promise<string> {
  console.log('[Voice] ========== 开始处理语音旁白 ==========');
  console.log('[Voice] 文本:', subtitleText.substring(0, 50));
  console.log('[Voice] 声音类型(原始):', voiceType);
  console.log('[Voice] 语速参数:', speechSpeed);

  if (!subtitleText || !subtitleText.trim()) {
    console.log('[Voice] 没有语音文本，跳过');
    return videoUrl;
  }

  onProgress?.('正在生成语音旁白...');

  // === 使用 TTS 编排器统一调度所有提供者 ===
  // 编排器自动按优先级尝试当前显式音频服务
  // 内置健康检查缓存、智能重试、错误分类
  const ttsResult = await ttsOrchestrate(subtitleText, voiceType, {
    speechSpeed,
    outputFormat: 'mp3',
    timeoutMs: 30_000,
    uid: `voice_narration_${Date.now()}`,
    onProgress,
    maxRetriesPerProvider: Math.max(1, maxRetries),
  });

  const ttsAudioUri = ttsResult.success ? ttsResult.audioBase64 : undefined;

  if (!ttsAudioUri) {
    console.error('[Voice] ❌ TTS编排器全部失败:', ttsResult.message);
    console.error(`[Voice] ❌ 提供者=${ttsResult.provider}, 错误类型=${ttsResult.errorType}`);
    return videoUrl;
  }

  console.log(`[Voice] ✅ TTS成功! provider=${ttsResult.provider}, speaker=${ttsResult.speakerId}`);

  // 使用VideoEdit合并语音到视频
  console.log('[Voice] 开始合并语音到视频...');
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const videoEditClient = getVideoEditClient(customHeaders);
      console.log(`[Voice] 合并第${retry + 1}次尝试...`);

      const compileResponse = await videoEditClient.compileVideoAudio(
        videoUrl,
        ttsAudioUri,
        {
          isVideoAudioSync: true, // 保持音视频同步
          isAudioReserve: false, // 替换原有音频
        }
      );

      console.log('[Voice] VideoEdit响应:', JSON.stringify(compileResponse));

      if (compileResponse.url) {
        console.log('[Voice] 语音旁白添加成功:', compileResponse.url);
        onProgress?.('语音旁白添加完成');
        console.log('[Voice] ========== 语音旁白处理完成 ==========');
        return compileResponse.url;
      }
      
      console.log('[Voice] 合并响应没有URL，重试...');
    } catch (error) {
      console.error(`[Voice] 合并第${retry + 1}次失败:`, error);
    }
    
    if (retry < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
    }
  }

  console.error('[Voice] ========== 语音旁白处理失败 ==========');
  return videoUrl;
}

// ========== 处理视频文字 ==========

/**
 * 处理视频文字 - 使用 VideoEdit addSubtitles
 */
export async function processVideoText(
  videoUrl: string,
  params: SubtitleParams,
  customHeaders?: Record<string, string>,
  onProgress?: (message: string) => void,
  maxRetries: number = 3
): Promise<string> {
  console.log('[VideoText] ========== 开始处理视频文字 ==========');
  
  const {
    enableVideoText,
    videoText,
    videoTextPosition = 'center',
    videoTextStartTime = 0,
    videoTextEndTime,
    useMultiSegmentVideoText = false,
    videoTextSegments = [],
  } = params;

  if (!enableVideoText) {
    console.log('[VideoText] 视频文字未启用');
    return videoUrl;
  }

  onProgress?.('正在添加视频文字...');

  // 确定要处理的文字列表
  let textList: Array<{ end_time: number; start_time: number; text: string }> = [];

  if (useMultiSegmentVideoText && videoTextSegments.length > 0) {
    // 多段模式：使用每个segment的文字和时间
    textList = videoTextSegments.map((seg, index) => ({
      text: seg.text || '',
      start_time: seg.startTime ?? (index * 3), // 默认每段3秒
      end_time: seg.endTime ?? ((index + 1) * 3),
    }));
    console.log('[VideoText] 多段模式，共', textList.length, '段');
  } else if (videoText && videoText.trim()) {
    // 单段模式：整个视频显示同一文字
    textList = [{
      text: videoText.trim(),
      start_time: videoTextStartTime || 0,
      end_time: videoTextEndTime || 9999, // 很大的数表示持续到结束
    }];
    console.log('[VideoText] 单段模式');
  }

  if (textList.length === 0 || textList.every(item => !item.text)) {
    console.log('[VideoText] 没有有效的视频文字内容');
    return videoUrl;
  }

  console.log('[VideoText] 文字列表:', JSON.stringify(textList.map(t => ({ ...t, text: t.text.substring(0, 20) }))));

  // 构建样式配置（符合API要求的格式）
  const firstSegment = videoTextSegments[0] || {} as any;
  const sizeMap: Record<string, number> = { small: 24, medium: 36, large: 48, xlarge: 60 };
  
  // 计算位置（转换为font_pos_config格式）
  let posX = '0%';   // 默认居中
  let posY = '50%';  // 默认中间
  
  if (videoTextPosition === 'custom') {
    // 自定义XY坐标模式
    const customX = firstSegment.customPositionX ?? 50;
    const customY = firstSegment.customPositionY ?? 50;
    
    // X轴：0%=左, 50%=居中, 100%=右 → 转换为偏移量
    posX = `${customX - 50}%`;
    posY = `${customY}%`;
    
    console.log('[VideoText] 使用自定义XY坐标:', { customX, customY, posX, posY });
  } else {
    // 预设位置模式
    const posYMap: Record<string, string> = {
      'top': '10%',
      'upper-third': '33%',
      'middle': '50%',
      'lower-third': '67%',
      'bottom': '90%',
      'custom': '50%',
    };
    posY = posYMap[videoTextPosition || 'middle'] || '50%';
    
    // 根据对齐方式设置X轴
    const alignment = firstSegment.alignment || 'center';
    switch (alignment) {
      case 'left': posX = '5%'; break;
      case 'right': posX = '-5%'; break;
      default: posX = '0%'; break; // center
    }
    
    console.log('[VideoText] 使用预设位置:', { position: videoTextPosition, alignment, posX, posY });
  }
  
  // 正确的SubtitleConfig格式（必须包含font_pos_config）
  const styleConfig: any = {
    font_size: sizeMap[firstSegment.fontSize || 'medium'] || 36,
    font_color: firstSegment.color || '#FFFFFF',
    background_color: firstSegment.backgroundColor || '#000000',
    border_color: firstSegment.borderColor || 'transparent',
    border_width: firstSegment.borderWidth || 0,
    font_type: 'noto', // 使用支持中文的字体，避免乱码
    // 必需的font_pos_config对象
    font_pos_config: {
      height: 'auto',
      width: '80%',
      pos_x: posX,
      pos_y: posY,
    },
  };

  console.log('[VideoText] 样式配置:', styleConfig);

  // 使用 VideoEdit addSubtitles
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const videoEditClient = getVideoEditClient(customHeaders);
      console.log(`[VideoText] 第${retry + 1}次尝试添加视频文字...`);

      const response = await videoEditClient.addSubtitles(videoUrl, styleConfig as any, {
        textList: textList,
        urlExpire: 7 * 24 * 60 * 60,
      });

      console.log('[VideoText] VideoEdit响应:', JSON.stringify(response));

      if (response.url) {
        console.log('[VideoText] 视频文字添加成功:', response.url);
        onProgress?.('视频文字添加完成');
        return response.url;
      }
      
      console.log('[VideoText] 响应没有URL，重试...');
    } catch (error) {
      console.error(`[VideoText] 第${retry + 1}次添加失败:`, error);
    }
    
    if (retry < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
    }
  }

  console.log('[VideoText] ========== 视频文字添加失败 ==========');
  return videoUrl;
}

// ========== 字幕降级工具函数 ==========

/**
 * 将秒数转换为SRT时间格式 "HH:MM:SS,mmm"
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * 将文本按句子分割为字幕条目
 * 根据视频时长均匀分配时间轴
 */
export function generateSrtEntries(
  text: string,
  totalDuration: number = 30,
  maxCharsPerSegment: number = 22
): SrtEntry[] {
  // 清理文本
  const cleanText = text.trim().replace(/\s+/g, ' ');
  if (!cleanText) return [];

  // 按标点分割为片段
  const sentences = cleanText.split(/(?<=[。！？.!?；;])\s*/).filter(s => s.trim().length > 0);

  const entries: SrtEntry[] = [];
  let currentTime = 0.5; // 从0.5秒开始（留出片头）

  for (const sentence of sentences) {
    // 如果单句太长，进一步按字数分割
    if (sentence.length > maxCharsPerSegment) {
      const chunks: string[] = [];
      let remaining = sentence;
      while (remaining.length > 0) {
        if (remaining.length <= maxCharsPerSegment) {
          chunks.push(remaining);
          break;
        }
        // 在maxCharsPerSegment附近寻找断点（优先在标点处）
        let cutPos = maxCharsPerSegment;
        const punctMatch = remaining.substring(0, maxCharsPerSegment + 5).match(/[,，、:：]/);
        if (punctMatch && punctMatch.index && punctMatch.index > maxCharsPerSegment * 0.5) {
          cutPos = punctMatch.index + 1;
        }
        chunks.push(remaining.substring(0, cutPos));
        remaining = remaining.substring(cutPos).trim();
      }

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        // 每段时长根据字数和语速估算（约4字/秒）
        const segmentDuration = Math.max(1.5, chunk.length / 4.5);
        const endTime = Math.min(currentTime + segmentDuration, totalDuration - 0.5);

        entries.push({
          index: entries.length + 1,
          startTime: formatSrtTime(currentTime),
          endTime: formatSrtTime(endTime),
          text: chunk.trim(),
        });
        currentTime = endTime + 0.2; // 段间间隙0.2秒
      }
    } else {
      const segmentDuration = Math.max(1.5, sentence.length / 4.5);
      const endTime = Math.min(currentTime + segmentDuration, totalDuration - 0.5);

      entries.push({
        index: entries.length + 1,
        startTime: formatSrtTime(currentTime),
        endTime: formatSrtTime(endTime),
        text: sentence.trim(),
      });
      currentTime = endTime + 0.2;
    }
  }

  return entries;
}

/**
 * 将SrtEntry数组序列化为标准SRT格式字符串
 */
export function serializeSrt(entries: SrtEntry[]): string {
  return entries.map(entry => {
    return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`;
  }).join('\n\n');
}

// ========== 处理字幕 ==========

/**
 * 处理字幕（仅处理字幕，不处理视频文字）
 *
 * 增强版：当服务端addSubtitles失败时，自动生成SRT数据供前端渲染降级
 * 返回 SubtitleProcessResult 包含视频URL和字幕数据
 */
export async function processSubtitles(
  videoUrl: string,
  params: SubtitleParams,
  customHeaders?: Record<string, string>,
  onProgress?: (message: string) => void,
  maxRetries: number = 3
): Promise<SubtitleProcessResult> {
  console.log('[Subtitle] ========== 开始处理字幕 ==========');
  
  const {
    enableSubtitle,
    subtitleText,
    subtitlePosition = 'bottom',
    subtitleFontSize = 'medium',
    subtitleColor = '#FFFFFF',
    generateVoice = false,
    // 字幕样式扩展
    subtitleFontWeight = 'normal',
    subtitleBackgroundColor = '#000000',
    subtitleBackgroundOpacity = 0.6,
    subtitleBorderColor = 'transparent',
    subtitleBorderWidth = 0,
    subtitleShadowColor = '#000000',
    subtitleShadowEnabled = true,
    subtitleAlignment = 'center',
    subtitleCustomPositionY,
    subtitleFontType = 'noto',
  } = params;

  if (!enableSubtitle || !subtitleText?.trim()) {
    console.log('[Subtitle] 字幕未启用或无文本');
    return { videoUrl, subtitleBurned: false };
  }

  onProgress?.('正在添加字幕...');

  // 构建字幕文本列表（简单实现：整段字幕）
  const textList = [{
    text: subtitleText.trim(),
    start_time: 0,
    end_time: 9999,
  }];

  // 构建样式配置（严格符合SDK SubtitleConfig接口定义）
  const fontSizeMap: Record<string, number> = { small: 20, medium: 28, large: 36, xlarge: 48 };
  
  // 计算位置（转换为font_pos_config格式）
  let posX = '0%';   // 居中
  let posY = '90%';  // 底部
  
  if (subtitlePosition === 'custom' && subtitleCustomPositionY !== undefined) {
    posY = `${subtitleCustomPositionY}%`;
    posX = '0%'; // 自定义时默认居中
  } else {
    const posYMap: Record<string, string> = {
      'top': '10%',
      'upper-third': '33%',
      'middle': '50%',
      'lower-third': '67%',
      'bottom': '90%',
      'custom': '50%',
    };
    posY = posYMap[subtitlePosition] || '90%';
    
    // 根据对齐方式设置X轴
    switch (subtitleAlignment) {
      case 'left': posX = '5%'; break;
      case 'right': posX = '-5%'; break;
      default: posX = '0%'; break; // center
    }
  }
  
  // 严格按照SDK的SubtitleConfig接口构建（不包含额外字段）
  const fontPosConfig = {
    height: 'auto' as string,
    width: '80%' as string,
    pos_x: posX as string,
    pos_y: posY as string,
  };
  
  const subtitleConfig = {
    font_size: fontSizeMap[subtitleFontSize] || 28,
    font_color: subtitleColor,
    background_color: subtitleBackgroundColor,
    border_color: subtitleBorderColor,
    border_width: subtitleBorderWidth || 0,
    font_type: subtitleFontType,
    // 必需的font_pos_config对象（SDK内部会访问其height/pos_x/pos_y/width属性）
    font_pos_config: fontPosConfig,
  };

  console.log('[Subtitle] 参数:', {
    enableSubtitle,
    subtitleText: subtitleText.substring(0, 50),
    subtitlePosition,
    subtitleFontSize,
    subtitleColor,
    generateVoice,
  });
  console.log('[Subtitle] 样式详情:', subtitleConfig);
  console.log('[Subtitle] 文本列表:', textList);

  // 使用 VideoEdit addSubtitles（已知服务端可能返回500+空URL）
  let lastError: string | null = null;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const videoEditClient = getVideoEditClient(customHeaders);
      console.log(`[Subtitle] 第${retry + 1}次尝试添加字幕...`);
      console.log('[Subtitle] 完整参数:', JSON.stringify({
        videoUrl: videoUrl?.substring(0, 80),
        subtitleConfig,
        options: { textList: textList.map(t => ({...t, text: t.text.substring(0,30)})), urlExpire: 7 * 24 * 60 * 60 }
      }, null, 2));

      const response = await videoEditClient.addSubtitles(
        videoUrl, 
        subtitleConfig as any, 
        {
          textList: textList,
          urlExpire: 7 * 24 * 60 * 60,
        }
      );

      console.log('[Subtitle] VideoEdit原始响应:', JSON.stringify(response));
      console.log('[Subtitle] 响应类型:', typeof response);
      if (response && typeof response === 'object') {
        console.log('[Subtitle] 响应keys:', Object.keys(response));
        console.log('[Subtitle] 响应值预览:', JSON.stringify(response).substring(0, 300));
      }

      if (response && (response as any).url) {
        console.log('[Subtitle] ✅ 字幕烧录成功:', (response as any).url);
        onProgress?.('字幕添加完成');
        return {
          videoUrl: (response as any).url,
          subtitleBurned: true,
          // 同时生成SRT数据供前端备用
          srtEntries: generateSrtEntries(subtitleText.trim()),
          srtData: serializeSrt(generateSrtEntries(subtitleText.trim())),
        };
      }
      
      // 详细分析无URL的原因
      if ((response as any).statusCode) {
        lastError = `statusCode=${(response as any).statusCode}`;
        console.error(`[Subtitle] ⚠️ 服务端返回状态码: ${(response as any).statusCode}`);
      } else if ((response as any).error) {
        lastError = String((response as any).error);
        console.error('[Subtitle] ⚠️ API返回error:', (response as any).error);
      } else if ((response as any).code) {
        lastError = `code=${(response as any).code}, msg=${(response as any).message || ''}`;
        console.error('[Subtitle] ⚠️ API返回code:', (response as any).code, (response as any).message);
      } else {
        lastError = '响应为空或无URL字段';
        console.warn('[Subtitle] ⚠️ 响应没有URL字段，完整响应:', JSON.stringify(response)?.substring(0, 200));
      }
      
      // 如果是500错误，记录但不重试太多次（服务端问题）
      if (lastError && lastError.includes('500')) {
        console.error('[Subtitle] ❌ 服务端内部错误(500)，addSubtitles端点可能未完全实现');
        break; // 提前退出，不浪费时间重试
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[Subtitle] 第${retry + 1}次异常:`, lastError);
      console.error(`[Subtitle] 堆栈:`, error instanceof Error ? error.stack : 'N/A');
      
      // 如果是特定错误（如font_pos_config），立即停止重试
      if (lastError.includes('height') || lastError.includes('font_pos')) {
        console.error('[Subtitle] 检测到font_pos_config相关错误，停止重试');
        break;
      }
    }
    
    if (retry < maxRetries - 1) {
      console.log(`[Subtitle] 等待 ${2000 * (retry + 1)}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
    }
  }

  // ========== 字幕烧录失败 → 生成SRT数据作为降级方案 ==========
  console.error(`[Subtitle] ========== 字幕烧录失败(${lastError || '未知原因'}) ==========`);
  console.error('[Subtitle] 原因: addSubtitles服务端API返回空URL或错误');
  console.log('[Subtitle] 🔄 启用降级方案: 生成SRT字幕数据供前端渲染');

  // 生成SRT数据供前端叠加渲染
  const srtEntries = generateSrtEntries(subtitleText.trim());
  const srtData = serializeSrt(srtEntries);

  console.log(`[Subtitle] ✅ SRT降级数据已生成: ${srtEntries.length}条字幕, ${srtData.length}字符`);
  console.log('[Subtitle] SRT预览:', srtData.substring(0, 200) + (srtData.length > 200 ? '...' : ''));

  return {
    videoUrl,
    subtitleBurned: false,   // 标记未烧录
    srtData,                  // SRT格式字符串
    srtEntries,               // 结构化条目
  };
}
