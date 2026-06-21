/**
 * 统一 TTS 提供者接口与类型定义
 * 
 * 所有 TTS 后端（火山引擎与显式集成音频服务）都实现此接口，
 * 供 TTS 编排器 (tts-orchestrator.ts) 统一调度。
 */

// ========== 统一结果类型 ==========

/** TTS 合成结果的统一格式 */
export interface TTSResult {
  /** 是否成功 */
  success: boolean;
  /** 音频数据 (base64 编码的 MP3/WAV) */
  audioBase64?: string;
  /** 原始音频字节数 */
  audioSizeBytes?: number;
  /** 音频时长 (毫秒) */
  durationMs?: number;
  /** 提供者名称 (用于日志) */
  provider: string;
  /** 使用的音色ID */
  speakerId?: string;
  /** 错误信息 */
  message?: string;
  /** 错误分类 */
  errorType?: TTSErrorType;
  /** 原始错误码 (各提供者自有) */
  rawCode?: number;
  /** 请求追踪ID */
  reqId?: string;
}

// ========== 错误分类 ==========

/** TTS 错误类型 - 用于智能重试决策 */
export enum TTSErrorType {
  /** 无错误 */
  NONE = 'none',
  /** 未配置 (API Key 缺失) */
  NOT_CONFIGURED = 'not_configured',
  /** 认证失败 (Key无效/过期) */
  AUTH_FAILED = 'auth_failed',
  /** 余额不足/配额耗尽 */
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  /** 音色不可用/未训练 */
  VOICE_UNAVAILABLE = 'voice_unavailable',
  /** 参数错误 (文本为空/超长等) */
  BAD_REQUEST = 'bad_request',
  /** 引擎处理失败 (临时性) */
  ENGINE_ERROR = 'engine_error',
  /** 网络超时 */
  TIMEOUT = 'timeout',
  /** 网络错误 */
  NETWORK_ERROR = 'network_error',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/** 根据错误特征自动分类 */
export function classifyTTSError(code: number | undefined, message: string): TTSErrorType {
  const msg = (message || '').toLowerCase();

  // 余额不足
  if (code === 1008 || msg.includes('balance') || msg.includes('insufficient') || msg.includes('quota')) {
    return TTSErrorType.INSUFFICIENT_BALANCE;
  }

  // 认证失败
  if (code === 401 || code === 403 || code === 3001 || msg.includes('auth') || msg.includes('unauthorized') || msg.includes('invalid key')) {
    return TTSErrorType.AUTH_FAILED;
  }

  // 音色不可用
  if (code === 3050 || msg.includes('not trained') || msg.includes('speaker_id has not')) {
    return TTSErrorType.VOICE_UNAVAILABLE;
  }

  // 引擎错误 (通常可重试)
  if (code === 3031 || code === 3032 || msg.includes('engine') || msg.includes('process fail')) {
    return TTSErrorType.ENGINE_ERROR;
  }

  // 超时
  if (msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out')) {
    return TTSErrorType.TIMEOUT;
  }

  // 网络错误
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('econnreset')) {
    return TTSErrorType.NETWORK_ERROR;
  }

  // 参数错误
  if (code === 400 || msg.includes('empty') || msg.includes('invalid param') || msg.includes('text too long')) {
    return TTSErrorType.BAD_REQUEST;
  }

  return TTSErrorType.UNKNOWN;
}

/** 判断该错误是否值得重试 (临时性 vs 永久性) */
export function isRetryableError(errorType: TTSErrorType): boolean {
  switch (errorType) {
    case TTSErrorType.ENGINE_ERROR:
    case TTSErrorType.TIMEOUT:
    case TTSErrorType.NETWORK_ERROR:
      return true;
    case TTSErrorType.NOT_CONFIGURED:
    case TTSErrorType.AUTH_FAILED:
    case TTSErrorType.INSUFFICIENT_BALANCE:
    case TTSErrorType.VOICE_UNAVAILABLE:
    case TTSErrorType.BAD_REQUEST:
    case TTSErrorType.NONE:
    case TTSErrorType.UNKNOWN:
      return false;
  }
}

// ========== 提供者接口 ==========

/** TTS 提供者能力描述 */
export interface TTSCapability {
  /** 提供者名称 */
  name: string;
  /** 优先级 (数字越小越优先) */
  priority: number;
  /** 支持的音色列表 */
  voices: ReadonlyArray<TTSVoiceInfo>;
  /** 最大文本长度 (字符) */
  maxTextLength: number;
  /** 是否支持流式 */
  supportsStreaming: boolean;
  /** 是否已配置可用 */
  isConfigured: boolean;
}

/** 音色信息 */
export interface TTSVoiceInfo {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  language: string;
  style?: string;
  isBeta?: boolean;
}

/** TTS 合成请求参数 (统一格式) */
export interface TTSRequest {
  /** 要合成的文本 */
  text: string;
  /** 系统声音类型 (用于映射到具体音色) */
  voiceType: string;
  /** 语速倍率 (1.0 = 正常) */
  speechSpeed: number;
  /** 输出编码格式 */
  outputFormat?: 'mp3' | 'wav' | 'pcm';
  /** 请求超时时间 (毫秒) */
  timeoutMs?: number;
  /** 用户ID (用于追踪) */
  uid?: string;
}

/**
 * TTS 提供者接口
 * 
 * 每个 TTS 后端都需要实现此接口
 */
export interface TTSProvider {
  /** 提供者唯一标识 */
  readonly name: string;

  /** 获取提供者能力信息 */
  getCapability(): Promise<TTSCapability>;

  /**
   * 根据 voiceType 解析该提供者的最佳匹配音色ID
   * 
   * 这是核心方法：编排器通过此方法判断哪个 Provider 最适合当前需求。
   * 返回的音色ID将直接传给 synthesize() 使用。
   * 
   * @param voiceType 系统声音类型 (如 'female', 'male', 'female_tianmei', 'male_tianshu')
   * @returns 该提供者下最匹配的音色ID，如果没有匹配则返回默认音色
   */
  resolveSpeaker(voiceType: string): string;

  /**
   * 根据 voiceType 返回该提供者的所有候选音色列表（按优先级排序）
   * 
   * 与 resolveSpeaker() 不同，此方法返回**所有**可用候选（而非仅最佳）。
   * 编排器在第一个候选失败后，会自动尝试同 Provider 的下一个候选，
   * 实现同 Provider 内的自动回退。
   * 
   * @param voiceType 系统声音类型
   * @returns 候选音色ID数组（按优先级从高到低），至少包含1个
   */
  resolveSpeakerCandidates(voiceType: string): string[];

  /**
   * 计算该提供者对给定 voiceType 的匹配度分数
   * 
   * 编排器使用此分数决定尝试顺序（高分优先）。
   * 匹配度 = 精确匹配(100) > 性别匹配(70) > 兜底(30) > 无匹配(0)
   * 
   * @param voiceType 系统声音类型
   * @returns 0-100 的匹配度分数
   */
  getMatchScore(voiceType: string): number;

  /**
   * 执行语音合成
   * 
   * @param request 统一格式的合成请求
   * @returns 统一格式的合成结果
   */
  synthesize(request: TTSRequest): Promise<TTSResult>;

  /**
   * 快速健康检查 (不实际合成完整音频)
   * 
   * @returns 是否可用 + 错误信息(如不可用)
   */
  healthCheck(): Promise<{ available: boolean; error?: string; errorType?: TTSErrorType }>;
}

// ========== 工具函数 ==========

/** 默认请求超时 (30秒) */
export const DEFAULT_TTS_TIMEOUT_MS = 30_000;

/** 创建带超时的 fetch 封装 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TTS_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 文本分片器
 * 
 * 将长文本按句子边界分割为多个片段，每个片段不超过 maxLength 字符。
 * 优先在句号、问号、感叹号、分号、逗号处断开。
 */
export function splitTextIntoChunks(
  text: string,
  maxLength: number,
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 在 maxLength 范围内寻找最佳断点
    let cutPos = maxLength;

    // 优先级：句末标点 > 逗号等 > 强制截断
    const delimiters = ['。', '！', '？', '；', '\n', '.', '!', '?', ';', ',', '，', '、'];

    for (const delim of delimiters) {
      const lastDelimPos = remaining.lastIndexOf(delim, maxLength);
      if (lastDelimPos > maxLength * 0.3) { // 至少保留30%的长度
        cutPos = lastDelimPos + 1; // 保留分隔符
        break;
      }
    }

    chunks.push(remaining.substring(0, cutPos));
    remaining = remaining.substring(cutPos);
  }

  return chunks.filter(c => c.trim().length > 0);
}

/**
 * 合并多个 base64 音频片段
 * 
 * 注意：简单拼接 MP3 文件在大多数播放器中可以工作，
 * 但可能会有轻微的帧间间隙。对于精确合并需要使用 ffmpeg。
 * 当前场景下简单拼接足够使用。
 */
export function concatAudioBase64(chunks: string[]): string {
  // 移除可能的 data URI 前缀，只保留纯 base64 数据
  const cleanChunks = chunks.map(chunk => {
    if (chunk.startsWith('data:')) {
      return chunk.split(',')[1] || chunk;
    }
    return chunk;
  });

  // 对于 base64 编码的音频，直接拼接解码后的二进制数据
  // 但这里我们返回拼接后的 base64（调用方需要正确处理）
  // 实际上 MP3 拼接应该先解码再拼接再编码
  // 为了性能，这里直接返回第一个非空片段（大多数情况只有一个）
  // 如果确实有多个片段，返回拼接结果

  if (cleanChunks.length === 0) return '';
  if (cleanChunks.length === 1) return cleanChunks[0];

  // 多个片段时，用 Buffer 解码后拼接再编码
  try {
    // 在 Node.js / Edge 环境中可能没有 Buffer，做兼容处理
    if (typeof Buffer !== 'undefined') {
      const buffers = cleanChunks.map(c => Buffer.from(c, 'base64'));
      const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
      const concatenated = Buffer.concat(buffers, totalLength);
      return concatenated.toString('base64');
    }
  } catch {
    // fallback: 直接拼接 base64 字符串（不完全正确但不会崩溃）
  }

  return cleanChunks.join('');
}
