/**
 * TTS 编排器 (Orchestrator)
 * 
 * 统一管理所有 TTS 提供者，实现智能回退链、健康检查缓存、错误分类处理。
 * 
 * 架构:
 *   调用方 → ttsOrchestrate() → 按优先级遍历 Provider → 返回首个成功结果
 * 
 * 默认提供者:
 *   1. 火山引擎 TTS (volcano_icl)
 */

import {
  type TTSProvider,
  type TTSRequest,
  type TTSResult,
  TTSErrorType,
  isRetryableError,
} from './tts-provider';
import { volcengineTTSProvider } from './volcengine-tts';

// ========== 健康检查缓存 ==========

interface HealthCacheEntry {
  available: boolean;
  checkedAt: number;
  error?: string;
  errorType?: TTSErrorType;
}

/** 健康检查缓存有效期 (5分钟) */
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

/** 健康检查缓存 */
const healthCache: Map<string, HealthCacheEntry> = new Map();

/**
 * 获取缓存的健康状态（如果未过期）
 */
function getCachedHealth(providerName: string): HealthCacheEntry | null {
  const cached = healthCache.get(providerName);
  if (!cached) return null;

  const age = Date.now() - cached.checkedAt;
  if (age > HEALTH_CACHE_TTL_MS) {
    healthCache.delete(providerName);
    return null;
  }

  return cached;
}

/**
 * 更新健康状态缓存
 */
function setCachedHealth(
  providerName: string,
  entry: Omit<HealthCacheEntry, 'checkedAt'>,
): void {
  healthCache.set(providerName, {
    ...entry,
    checkedAt: Date.now(),
  });
}

/**
 * 清除指定提供者的健康缓存（强制下次重新检查）
 */
export function invalidateHealthCache(providerName?: string): void {
  if (providerName) {
    healthCache.delete(providerName);
  } else {
    healthCache.clear();
  }
}

// ========== 编排器核心 ==========

/** 所有已注册的 TTS 提供者 */
const registeredProviders: TTSProvider[] = [];

/**
 * 注册一个 TTS 提供者到编排器
 */
export function registerTTSProvider(provider: TTSProvider): void {
  const existingIdx = registeredProviders.findIndex(p => p.name === provider.name);
  if (existingIdx >= 0) {
    registeredProviders[existingIdx] = provider;
  } else {
    registeredProviders.push(provider);
  }

  // 按 priority 排序（延迟到实际调用时排序，因为 getCapability 是异步的）
  // 排序逻辑在 ttsOrchestrate() 中执行
}

/** 初始化默认提供者 */
let providersInitialized = false;

async function ensureProvidersInitialized(): Promise<void> {
  if (providersInitialized) return;

  // 注册外部提供者
  registerTTSProvider(volcengineTTSProvider);

  providersInitialized = true;
}

/**
 * TTS 合成 - 主入口 (需求驱动调度)
 * 
 * **核心策略**: 根据 voiceType 需求，按"匹配度"排序提供者，而非固定优先级。
 * 
 * 调度示例:
 *   voiceType="female_tianmei"
 *     → Volcengine best matching voice
 * 
 * 每个提供者通过 resolveSpeaker() 返回自己的最佳匹配音色，
 * 通过 getMatchScore() 返回对当前 voiceType 的匹配程度。
 * 
 * @param text 要合成的文本
 * @param voiceType 声音类型 (决定 Provider 排序和音色选择)
 * @param options 可选参数
 * @returns TTS 合成结果
 */
export async function ttsOrchestrate(
  text: string,
  voiceType: string,
  options?: {
    speechSpeed?: number;
    outputFormat?: 'mp3' | 'wav' | 'pcm';
    timeoutMs?: number;
    uid?: string;
    /** 进度回调 */
    onProgress?: (msg: string) => void;
    /** 最大重试次数 (每个提供者) */
    maxRetriesPerProvider?: number;
  },
): Promise<TTSResult> {
  await ensureProvidersInitialized();

  const startTime = Date.now();
  const speechSpeed = options?.speechSpeed ?? 1.0;
  const timeoutMs = options?.timeoutMs ?? 30_000;

  console.log(`[TTS-Orchestrator] ========== 需求驱动编排 ==========`);
  console.log(`[TTS-Orchestrator] 文本: ${text.substring(0, 60)}..., voiceType=${voiceType}, speed=${speechSpeed}`);

  if (!text?.trim()) {
    return {
      success: false,
      provider: 'orchestrator',
      message: '文本为空',
      errorType: TTSErrorType.BAD_REQUEST,
    };
  }

  // 构建请求对象
  const request: TTSRequest = {
    text,
    voiceType,
    speechSpeed,
    outputFormat: options?.outputFormat || 'mp3',
    timeoutMs,
    uid: options?.uid,
  };

  // 收集显式注册的提供者。
  const allProviders: TTSProvider[] = [...registeredProviders];

  // ========== 核心变更: 按 voiceType 匹配度动态排序 ==========
  const providerScores: Array<{ provider: TTSProvider; score: number; speakerId: string }> = [];

  for (const provider of allProviders) {
    const cap = await provider.getCapability();
    if (!cap.isConfigured) continue;

    const score = provider.getMatchScore(voiceType);
    const speakerId = provider.resolveSpeaker(voiceType);
    providerScores.push({ provider, score, speakerId });
  }

  // 按匹配度降序排列 (高分优先)
  providerScores.sort((a, b) => b.score - a.score);

  console.log(
    `[TTS-Orchestrator] 📋 Provider排名 (voiceType="${voiceType}"):`,
    providerScores.map(ps =>
      `${ps.provider.name}(score=${ps.score}, speaker=${ps.speakerId})`,
    ).join(' → '),
  );

  if (providerScores.length === 0) {
    return {
      success: false,
      provider: 'orchestrator',
      message: '没有可用的 TTS 提供者',
      errorType: TTSErrorType.NOT_CONFIGURED,
    };
  }

  // ========== 二维调度: Provider × Candidates ==========
  let lastResult: TTSResult | null = null;
  const errors: Array<{ provider: string; speaker: string; score: number; error: string; errorType?: TTSErrorType }> = [];
  let totalAttempts = 0;

  for (let pi = 0; pi < providerScores.length; pi++) {
    const { provider, score } = providerScores[pi];
    const candidates = provider.resolveSpeakerCandidates(voiceType);

    // 检查健康缓存
    const cachedHealth = getCachedHealth(provider.name);
    if (cachedHealth && !cachedHealth.available) {
      const isRetryable = isRetryableError(cachedHealth.errorType ?? TTSErrorType.UNKNOWN);
      if (!isRetryable) {
        console.log(`[TTS-Orchestrator] ⏭️ ${provider.name}: 缓存不可用 [${cachedHealth.errorType}], 跳过全部${candidates.length}个候选`);
        errors.push({ provider: provider.name, speaker: '-', score, error: cachedHealth.error || '未知', errorType: cachedHealth.errorType });
        continue;
      }
      console.log(`[TTS-Orchestrator] 🔄 ${provider.name}: 缓存不可用但可重试 [${cachedHealth.errorType}]`);
    }

    console.log(
      `[TTS-Orchestrator] 🎯 Provider #${pi + 1}/${providerScores.length}: ${provider.name} ` +
      `(score=${score}, candidates=${candidates.join(', ')})`,
    );

    // === 内层循环: 遍历该 Provider 的所有候选音色 ===
    for (let ci = 0; ci < candidates.length; ci++) {
      const speakerId = candidates[ci];
      totalAttempts++;
      const maxRetries = options?.maxRetriesPerProvider ?? 1;

      options?.onProgress?.(`正在合成语音... [${provider.name}] ${speakerId} (${ci + 1}/${candidates.length})`);
      console.log(
        `[TTS-Orchestrator]   🔸 候选 #${ci + 1}/${candidates.length}: ${speakerId} ` +
        `(总尝试#${totalAttempts})`,
      );

      // === 内内层: 同一候选的重试 ===
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await provider.synthesize({ ...request });
          lastResult = result;

          if (result.success) {
            const elapsed = Date.now() - startTime;
            console.log(
              `[TTS-Orchestrator] ✅ 成功! provider=${provider.name}, ` +
              `speaker=${result.speakerId || speakerId}, ` +
              `候选#${ci + 1}/${candidates.length}, 重试#${attempt}, ` +
              `耗时=${elapsed}ms, 总尝试#${totalAttempts}`,
            );
            setCachedHealth(provider.name, { available: true });
            return result;
          }

          // 失败处理
          const errorType = result.errorType ?? classifyTTSErrorFromMessage(result.message);
          console.warn(
            `[TTS-Orchestrator]   ❌ ${provider.name}/${speakerId} 失败 ` +
            `(重试${attempt}/${maxRetries}) [${errorType}]: ${result.message}`,
          );

          if (!isRetryableError(errorType)) {
            // 永久性错误 → 记录并跳到下一个候选（而非跳到下一个 Provider！）
            errors.push({
              provider: provider.name,
              speaker: speakerId,
              score,
              error: result.message || '未知',
              errorType,
            });

            // 如果是"音色不可用"(VOICE_UNAVAILABLE)，只标记该音色，不标记整个 Provider
            if (errorType !== TTSErrorType.VOICE_UNAVAILABLE && errorType !== TTSErrorType.AUTH_FAILED) {
              setCachedHealth(provider.name, { available: false, error: result.message, errorType });
            }
            break; // 跳出重试循环 → 下一个候选
          }

          // 可重试错误 → 等待后重试同一候选
          if (attempt < maxRetries) {
            const delay = Math.min(3000, 1000 * attempt);
            console.log(`[TTS-Orchestrator]   ⏳ ${errorType} 可重试, ${delay}ms后第${attempt + 1}次...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            // 重试耗尽 → 跳到下一个候选
            errors.push({ provider: provider.name, speaker: speakerId, score, error: result.message || '未知', errorType });
          }

        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[TTS-Orchestrator]   💥 ${provider.name}/${speakerId} 异常: ${errMsg}`);
          errors.push({ provider: provider.name, speaker: speakerId, score, error: errMsg, errorType: TTSErrorType.UNKNOWN });

          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }
      // 候选 ci 结束 → 自动进入候选 ci+1 (同 Provider 内回退)
    }
    // 所有候选耗尽 → 自动进入下一个 Provider (跨 Provider 回退)
  }

  // 全部失败
  const elapsed = Date.now() - startTime;
  console.error(`[TTS-Orchestrator] ❌ 全部失败! 耗时=${elapsed}ms, voiceType=${voiceType}, 总尝试=${totalAttempts}`);
  errors.forEach(e => {
    console.error(`  - ${e.provider}/${e.speaker}(score=${e.score}): [${e.errorType}] ${e.error}`);
  });

  return {
    success: false,
    provider: 'orchestrator',
    message: `所有TTS提供者均失败 (voiceType=${voiceType}): ${errors.map(e => e.provider).join(', ')}`,
    errorType: TTSErrorType.UNKNOWN,
    reqId: `orch_fail_${Date.now()}`,
  };
}

// ========== 辅助函数 ==========

/** 从消息推断错误类型 (简化版，用于编排器内部) */
function classifyTTSErrorFromMessage(message: string | undefined): TTSErrorType {
  if (!message) return TTSErrorType.UNKNOWN;
  const msg = message.toLowerCase();
  if (msg.includes('balance') || msg.includes('insufficient')) return TTSErrorType.INSUFFICIENT_BALANCE;
  if (msg.includes('auth') || msg.includes('unauthorized')) return TTSErrorType.AUTH_FAILED;
  if (msg.includes('not trained') || msg.includes('3050')) return TTSErrorType.VOICE_UNAVAILABLE;
  if (msg.includes('engine') || msg.includes('3031')) return TTSErrorType.ENGINE_ERROR;
  if (msg.includes('timeout') || msg.includes('abort')) return TTSErrorType.TIMEOUT;
  if (msg.includes('fetch failed') || msg.includes('network')) return TTSErrorType.NETWORK_ERROR;
  return TTSErrorType.UNKNOWN;
}
