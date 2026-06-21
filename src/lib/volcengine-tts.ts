/**
 * 火山引擎（Volcengine/豆包语音）TTS 提供者
 * 
 * 使用火山引擎大模型声音复刻 TTS API (volcano_icl cluster)
 * 
 * API 规格（2025-04 验证通过）:
 *   端点: https://openspeech.bytedance.com/api/v1/tts
 *   认证: api-key header
 *   Cluster: volcano_icl (大模型声音复刻)
 *   Operation: query (直接查询，无需submit)
 *   voice_type: S_xxxxxx 格式
 *   返回: JSON { code:3000, data:"<base64音频>", addition:{duration} }
 */

import {
  type TTSProvider,
  type TTSRequest,
  type TTSResult,
  type TTSCapability,
  type TTSVoiceInfo,
  TTSErrorType,
  classifyTTSError,
  fetchWithTimeout,
  DEFAULT_TTS_TIMEOUT_MS,
} from './tts-provider';

// ========== 常量配置 ==========

const VOLCENGINE_TTS_URL = 'https://openspeech.bytedance.com/api/v1/tts';
const VOLCENGINE_CLUSTER = 'volcano_icl';
const DEFAULT_APP_ID = 'default';
const PROVIDER_NAME = 'volcengine';

/** 火山引擎最大单次文本长度 (字符) - 实测支持较长文本 */
const MAX_TEXT_LENGTH = 2000;

// ========== 音色配置 ==========

export interface VolcengineVoiceInfo {
  id: string;
  name: string;
  gender: 'female' | 'male';
  style?: string;
  voiceType: string;
}

/**
 * 火山引擎可用音色列表
 * 
 * 注意: S_ 格式为"大模型声音复刻"类型音色，
 * 与标准TTS音色(zh_female_xxx格式)不同。
 */
export const VOLCENGINE_VOICES: VolcengineVoiceInfo[] = [
  {
    id: 'S_v7xollyj1',
    name: '大模型复刻-默认',
    gender: 'female',
    style: '大模型声音复刻音色，支持中英文',
    voiceType: 'female',
  },
];

export const DEFAULT_VOLCENGINE_SPEAKER = 'S_v7xollyj1';

/** 系统 voiceType → 火山引擎 speaker ID 映射 */
export const VOLCENGINE_VOICE_MAP: Record<string, string[]> = {
  'female': ['S_v7xollyj1'],
  'female_tianmei': ['S_v7xollyj1'],
  'female_shuang': ['S_v7xollyj1'],
  'male': ['S_v7xollyj1'],
  'male_tianshu': ['S_v7xollyj1'],
};

/** 根据 voiceType 获取火山引擎 speaker ID */
export function resolveVolcengineSpeaker(voiceType: string): string {
  const candidates = VOLCENGINE_VOICE_MAP[voiceType];
  if (candidates && candidates.length > 0) {
    return candidates[0];
  }
  return DEFAULT_VOLCENGINE_SPEAKER;
}

// ========== 实现 TTSProvider 接口 ==========

/**
 * 火山引擎 TTS 提供者实例
 * 
 * 使用方式:
 * ```ts
 * import { volcengineTTSProvider } from './volcengine-tts';
 * const result = await volcengineTTSProvider.synthesize({ text, voiceType, speechSpeed });
 * ```
 */
export const volcengineTTSProvider: TTSProvider = {
  name: PROVIDER_NAME,

  async getCapability(): Promise<TTSCapability> {
    const apiKey = process.env.VOLCENGINE_TTS_API_KEY || '';
    return {
      name: PROVIDER_NAME,
      priority: 20,
      voices: VOLCENGINE_VOICES.map(v => ({
        id: v.id,
        name: v.name,
        gender: v.gender,
        language: 'zh-CN',
        style: v.style,
      })),
      maxTextLength: MAX_TEXT_LENGTH,
      supportsStreaming: false,
      isConfigured: apiKey.length > 0,
    };
  },

  /**
   * 火山引擎音色匹配
   * 
   * 当前只有1个音色(S_v7xollyj1)，所有 voiceType 都映射到它。
   * 匹配度策略:
   * - 任何 female 相关 → 30 (有女声可用，但非精确匹配)
   * - 任何 male 相关 → 25 (通用音色，性别不完全匹配)
   * - 其他 → 20 (兜底)
   */
  resolveSpeaker(voiceType: string): string {
    return resolveVolcengineSpeaker(voiceType);
  },

  getMatchScore(voiceType: string): number {
    // Volcengine 只有1个通用音色，匹配度中等偏低
    if (!voiceType) return 20;
    const vt = voiceType.toLowerCase();
    if (vt.includes('female') || vt.includes('tianmei') || vt.includes('shaonv')) return 30;
    if (vt.includes('male') || vt.includes('tianshu')) return 25;
    return 20;
  },

  /**
   * Volcengine 候选音色列表
   * 
   * 当前只有1个可用音色(S_v7xollyj1)，所有 voiceType 都返回它。
   */
  resolveSpeakerCandidates(voiceType: string): string[] {
    return [resolveVolcengineSpeaker(voiceType)];
  },

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const startTime = Date.now();
    const apiKey = process.env.VOLCENGINE_TTS_API_KEY || '';
    const reqId = `ve_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 前置检查
    if (!apiKey) {
      return {
        success: false,
        provider: PROVIDER_NAME,
        message: '未配置 VOLCENGINE_TTS_API_KEY 环境变量',
        errorType: TTSErrorType.NOT_CONFIGURED,
        reqId,
      };
    }

    if (!request.text?.trim()) {
      return {
        success: false,
        provider: PROVIDER_NAME,
        message: '文本为空',
        errorType: TTSErrorType.BAD_REQUEST,
        reqId,
      };
    }

    const speakerId = resolveVolcengineSpeaker(request.voiceType);
    const text = request.text.trim().substring(0, MAX_TEXT_LENGTH);
    const encoding = request.outputFormat || 'mp3';
    const speedRatio = Math.max(0.2, Math.min(4.0, request.speechSpeed ?? 1.0));
    const uid = request.uid || `ve_${Date.now()}`;
    const timeoutMs = request.timeoutMs ?? DEFAULT_TTS_TIMEOUT_MS;

    console.log(
      `[${PROVIDER_NAME}] 合成开始: speaker=${speakerId}, ` +
      `text=${text.substring(0, 60)}..., speed=${speedRatio}, encoding=${encoding}`,
    );

    try {
      const requestBody = {
        app: {
          appid: DEFAULT_APP_ID,
          token: 'access_token',
          cluster: VOLCENGINE_CLUSTER,
        },
        user: { uid },
        audio: {
          voice_type: speakerId,
          encoding,
          speed_ratio: speedRatio,
          volume_ratio: 1.0,
          pitch_ratio: 1.0,
        },
        request: {
          reqid: reqId,
          text,
          text_type: 'plain',
          operation: 'query',
        },
      };

      const response = await fetchWithTimeout(VOLCENGINE_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        timeoutMs,
      });

      const responseData = await response.json();
      const elapsed = Date.now() - startTime;

      if (responseData.code === 3000 && responseData.data) {
        const audioBase64 = responseData.data;
        const durationMs = responseData.addition?.duration
          ? parseInt(String(responseData.addition.duration), 10)
          : undefined;

        console.log(
          `[${PROVIDER_NAME}] ✅ 成功! base64=${audioBase64.length}ch, ` +
          `duration=${durationMs}ms,耗时=${elapsed}ms`,
        );

        return {
          success: true,
          audioBase64,
          audioSizeBytes: Math.floor(audioBase64.length * 0.75), // 近似值
          durationMs,
          provider: PROVIDER_NAME,
          speakerId,
          reqId,
        };
      }

      // 错误处理
      const errMsg = responseData.message || '未知错误';
      const errCode = responseData.code;
      const errorType = classifyTTSError(errCode, errMsg);

      console.warn(`[${PROVIDER_NAME}] ❌ code=${errCode} [${errorType}] ${errMsg}`);

      return {
        success: false,
        provider: PROVIDER_NAME,
        speakerId,
        message: errMsg,
        errorType,
        rawCode: errCode,
        reqId,
      };

    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);
      const errorType = errMsg.includes('abort')
        ? TTSErrorType.TIMEOUT
        : errMsg.includes('fetch failed')
          ? TTSErrorType.NETWORK_ERROR
          : TTSErrorType.UNKNOWN;

      console.error(`[${PROVIDER_NAME}] ❌ 异常 [${errorType}] ${errMsg}, 耗时=${elapsed}ms`);

      return {
        success: false,
        provider: PROVIDER_NAME,
        speakerId,
        message: errMsg,
        errorType,
        reqId,
      };
    }
  },

  async healthCheck(): Promise<{ available: boolean; error?: string; errorType?: TTSErrorType }> {
    const apiKey = process.env.VOLCENGINE_TTS_API_KEY || '';
    if (!apiKey) {
      return { available: false, error: '未配置 API Key', errorType: TTSErrorType.NOT_CONFIGURED };
    }

    try {
      const result = await this.synthesize({
        text: '你好，健康检查。',
        voiceType: 'female',
        speechSpeed: 1.0,
        timeoutMs: 15_000, // 健康检查用较短超时
      });

      if (result.success) {
        return { available: true };
      }
      return { available: false, error: result.message, errorType: result.errorType };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { available: false, error: msg, errorType: TTSErrorType.UNKNOWN };
    }
  },
};

// ========== 向后兼容的便捷导出 ==========

/** 旧接口兼容: 直接调用合成 (保持向后兼容) */
export async function synthesizeWithVolcengine(
  text: string,
  speakerId: string = DEFAULT_VOLCENGINE_SPEAKER,
  options?: {
    encoding?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus';
    speedRatio?: number;
    volumeRatio?: number;
    pitchRatio?: number;
    uid?: string;
  },
  apiKey?: string,
) {
  // 如果传入了 apiKey，临时设置环境变量（仅本次调用有效）
  const originalKey = process.env.VOLCENGINE_TTS_API_KEY;
  if (apiKey) {
    process.env.VOLCENGINE_TTS_API_KEY = apiKey;
  }

  try {
    // 直接用 speakerId 跳过映射
    const result = await volcengineTTSProvider.synthesize({
      text,
      voiceType: '', // 空字符串触发默认回退
      speechSpeed: options?.speedRatio ?? 1.0,
      outputFormat: options?.encoding as 'mp3' | 'wav' | 'pcm',
      uid: options?.uid,
    });

    // 转换为旧格式返回
    return {
      success: result.success,
      audioData: result.audioBase64,
      audioBase64: result.audioBase64,
      reqid: result.reqId,
      message: result.message,
      code: result.rawCode,
      durationMs: result.durationMs,
    };
  } finally {
    // 恢复原始环境变量
    if (apiKey) {
      process.env.VOLCENGINE_TTS_API_KEY = originalKey;
    }
  }
}

/** 旧接口兼容: 快速合成 */
export async function quickSynthesize(
  text: string,
  voiceType: string = 'female',
  speechSpeed: number = 1.0,
  apiKey?: string,
) {
  return synthesizeWithVolcengine(text, resolveVolcengineSpeaker(voiceType), {
    speedRatio: speechSpeed,
  }, apiKey);
}

/** 旧接口兼容: 探测是否可用 */
export async function probeVolcengineTTS(apiKey?: string) {
  const originalKey = process.env.VOLCENGINE_TTS_API_KEY;
  if (apiKey) process.env.VOLCENGINE_TTS_API_KEY = apiKey;

  try {
    const health = await volcengineTTSProvider.healthCheck();
    const cap = await volcengineTTSProvider.getCapability();

    return {
      available: health.available,
      voices: [...cap.voices] as unknown as VolcengineVoiceInfo[],
      error: health.error,
    };
  } finally {
    if (apiKey) process.env.VOLCENGINE_TTS_API_KEY = originalKey;
  }
}
