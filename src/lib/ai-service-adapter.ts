/**
 * 统一AI服务适配层
 *
 * 提供统一接口，内部通过 model-router 自动选择 provider。
 * 视频主生成不再走本适配层的旧供应商路径，请使用 BYOK video submit 或 production assembly segment service。
 *
 * 使用方式:
 *   import { aiService } from '@/lib/ai-service-adapter';
 *   const result = await aiService.generateImage({ prompt: '...' });
 */

import {
  getCurrentRoute,
  getProviderHealthStatus,
  type ServiceType,
  type RouteResult,
} from './model-router';

import { chatWithBYOK, imageWithBYOK, type BYOKConnection } from './byok-provider';

// ==================== 类型定义 ====================

export interface ImageGenParams {
  prompt: string;
  model?: string;
  size?: string;
  width?: number;
  height?: number;
  n?: number;
  style?: string;
  image?: string | string[];  // 角色参考图，确保人物视觉一致性
  negative_prompt?: string;   // 负面提示词，排除不想要的风格/元素
  byokConnection?: BYOKConnection;
}

export interface VideoGenParams {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  imageUrl?: string;
  resolution?: string;
}

export interface LLMChatParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  byokConnection?: BYOKConnection;
}

export interface TTSParams {
  text: string;
  voiceId?: string;
  speed?: number;
  model?: string;
  outputFormat?: 'mp3' | 'wav';
}

export interface ImageGenResult {
  url: string;
  prompt: string;
  provider: 'byok';
}

export interface VideoGenResult {
  taskId: string;
  statusUrl?: string;
  videoUrl?: string | null;
  provider: 'disabled';
}

export interface ChatResult {
  content: string;
  provider: 'byok';
  model: string;
}

export interface TTSGenResult {
  audioUrl: string;
  provider: 'disabled';
}

// ==================== 工具函数 ====================

function requireBYOK(connection: BYOKConnection | undefined, serviceName: string): BYOKConnection {
  if (!connection) {
    throw new Error(`${serviceName}已关闭内置 Coze/Minimax fallback。请在设置页配置 BYOK API Base、API Key 和模型后再调用。`);
  }
  return connection;
}

// ==================== 统一服务 ====================

export const aiService = {
  /**
   * 图像生成（BYOK only）。
   */
  async generateImage(params: ImageGenParams): Promise<RouteResult<ImageGenResult>> {
    const connection = requireBYOK(params.byokConnection, '图像生成');
    const startTime = Date.now();
    const result = await imageWithBYOK(connection, {
      prompt: params.prompt,
      model: params.model,
      size: params.size,
      n: params.n || 1,
    });
    return {
      data: { url: result.url, prompt: params.prompt, provider: 'byok' },
      provider: 'byok',
      latency: Date.now() - startTime,
      degraded: false,
    };
  },

  /**
   * 视频生成旧路径已关闭。
   *
   * ArcReel 对齐原则：视频 provider job 必须由显式 BYOK/assembly service 创建、
   * 持久化和恢复，不能继续藏在通用 adapter 的隐式 fallback 里。
   */
  async generateVideo(params: VideoGenParams): Promise<RouteResult<VideoGenResult>> {
    void params;
    throw new Error('aiService.generateVideo legacy provider path is disabled. Use /api/video/submit BYOK or production assembly segment start.');
  },

  /**
   * LLM 对话（BYOK only）。
   */
  async chat(params: LLMChatParams): Promise<RouteResult<ChatResult>> {
    const connection = requireBYOK(params.byokConnection, '文本生成');
    const startTime = Date.now();
    const result = await chatWithBYOK(connection, {
      messages: params.messages,
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
    return {
      data: result,
      provider: 'byok',
      latency: Date.now() - startTime,
      degraded: false,
    };
  },

  /**
   * LLM 流式对话（BYOK only）。
   * 返回 ReadableStream<Uint8Array> (SSE格式)
   */
  chatStream(params: LLMChatParams): ReadableStream<Uint8Array> {
    return createBYOKChatStream(params);
  },

  /**
   * TTS 旧适配路径已关闭。可交付样片应走显式有声视频/音频服务。
   */
  async tts(params: TTSParams): Promise<RouteResult<TTSGenResult>> {
    void params;
    throw new Error('aiService.tts legacy Coze/Minimax path is disabled. Use the explicit audio/video production service.');
  },

  /**
   * 查询服务健康状态
   */
  getHealthStatus() {
    return getProviderHealthStatus();
  },

  /**
   * 查询当前路由决策
   */
  getCurrentRoute(service: ServiceType) {
    return getCurrentRoute(service);
  },
};

// ==================== BYOK 流式对话适配 ====================

function createBYOKChatStream(params: LLMChatParams): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const connection = requireBYOK(params.byokConnection, '文本流式生成');
        const result = await chatWithBYOK(connection, {
          messages: params.messages,
          model: params.model,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
        });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: result.content })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}
