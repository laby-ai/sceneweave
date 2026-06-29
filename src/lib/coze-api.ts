/**
 * Coze SDK API 封装
 * 统一封装 coze-coding-dev-sdk 的 LLM / 图像 / 视频 / TTS 能力
 */

import type { LLMConfig, Message, LLMResponse } from 'coze-coding-dev-sdk';
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
} from 'coze-coding-dev-sdk';
import type {
  Content as VideoContent,
  Resolution,
  Ratio,
  VideoGenerationResponse,
} from 'coze-coding-dev-sdk';
import type { TTSRequest, TTSResponse } from 'coze-coding-dev-sdk';

type CozeSdk = typeof import('coze-coding-dev-sdk');

type CozeClients = {
  llmClient: InstanceType<CozeSdk['LLMClient']>;
  imageClient: InstanceType<CozeSdk['ImageGenerationClient']>;
  videoClient: InstanceType<CozeSdk['VideoGenerationClient']>;
  ttsClient: InstanceType<CozeSdk['TTSClient']>;
};

let sdkPromise: Promise<CozeSdk> | null = null;
let clientsPromise: Promise<CozeClients> | null = null;

function loadCozeSdk(): Promise<CozeSdk> {
  sdkPromise ??= import('coze-coding-dev-sdk');
  return sdkPromise;
}

function getCozeClients(): Promise<CozeClients> {
  clientsPromise ??= loadCozeSdk().then(({ Config, LLMClient, ImageGenerationClient, VideoGenerationClient, TTSClient }) => {
    // coze-coding-dev-sdk 标准环境变量: COZE_WORKLOAD_IDENTITY_API_KEY + COZE_INTEGRATION_BASE_URL
    // 同时兼容 COZE_API_KEY / COZE_API_BASE_URL（自定义代码引用）
    const config = new Config({
      apiKey: process.env.COZE_WORKLOAD_IDENTITY_API_KEY || process.env.COZE_API_KEY,
      baseUrl: process.env.COZE_INTEGRATION_BASE_URL || process.env.COZE_API_BASE_URL || 'https://api.coze.cn',
      retryTimes: 2,
      retryDelay: 1000,
      timeout: 60000,
    });

    return {
      llmClient: new LLMClient(config),
      imageClient: new ImageGenerationClient(config),
      videoClient: new VideoGenerationClient(config),
      ttsClient: new TTSClient(config),
    };
  });
  return clientsPromise;
}

// ==================== 多模态内容类型 ====================

/** 文本内容部分 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/** 图片URL内容部分 */
export interface ImageUrlContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/** 视频URL内容部分 */
export interface VideoUrlContentPart {
  type: 'video_url';
  video_url: {
    url: string;
    fps?: number;
  };
}

/** 多模态内容部分联合类型 */
export type MultimodalContentPart = TextContentPart | ImageUrlContentPart | VideoUrlContentPart;

/** 多模态消息类型 */
export interface MultimodalMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContentPart[];
}

// ==================== LLM 对话 ====================

export interface CozeChatResult {
  content: string;
  model: string;
}

/**
 * 将 MultimodalMessage[] 转换为 SDK Message[]
 * SDK 内部 convertContent 支持 string | ContentPart[]，但 TS 类型只声明了 string
 */
function toSdkMessages(messages: MultimodalMessage[]): Message[] {
  return messages.map(m => ({
    role: m.role,
    content: m.content,
  })) as Message[];
}

/**
 * LLM 对话（非流式）— 支持多模态
 * 注意：SDK invoke() 在当前环境下存在兼容性问题，因此通过 stream 收集完整响应
 */
export async function cozeChat(
  messages: MultimodalMessage[],
  options?: { model?: string; temperature?: number }
): Promise<CozeChatResult> {
  const model = options?.model || 'doubao-seed-2-0-pro-260215';

  const llmMessages = toSdkMessages(messages);

  const llmConfig: LLMConfig = {
    model,
    temperature: options?.temperature,
    streaming: true,
  };

  // 通过流式收集完整结果（绕过 invoke 兼容性问题）
  const { llmClient } = await getCozeClients();
  const stream = llmClient.stream(llmMessages, llmConfig);
  let content = '';
  for await (const chunk of stream) {
    if (chunk?.content) {
      content += chunk.content;
    }
  }

  return {
    content,
    model,
  };
}

/**
 * 视觉模型对话（非流式）— 使用 invoke 代替 stream
 * 支持多模态输入（文本+图片URL），使用当前可用的LLM模型
 * 
 * 内置重试机制：最多重试2次，失败后尝试降级模型
 */
export async function cozeVisionChat(
  messages: MultimodalMessage[],
  options?: { model?: string; temperature?: number; maxRetries?: number }
): Promise<CozeChatResult> {
  const primaryModel = options?.model || 'doubao-seed-1-8-251228';
  const fallbackModel = 'doubao-seed-2-0-pro-260215';
  const maxRetries = options?.maxRetries ?? 2;
  const temperature = options?.temperature ?? 0.3;

  const modelsToTry = [primaryModel, fallbackModel];

  for (const model of modelsToTry) {
    const llmMessages = toSdkMessages(messages);
    const llmConfig: LLMConfig = { model, temperature };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.info(`[CozeVisionChat] 尝试模型=${model}, 第${attempt}次`);
        const { llmClient } = await getCozeClients();
        const response = await llmClient.invoke(llmMessages, llmConfig);
        const content = response?.content ?? '';

        if (content) {
          console.info(`[CozeVisionChat] 成功, 模型=${model}, 内容长度=${typeof content === 'string' ? content.length : JSON.stringify(content).length}`);
          return {
            content: typeof content === 'string' ? content : JSON.stringify(content),
            model,
          };
        }

        console.warn(`[CozeVisionChat] 模型=${model} 返回空内容, 第${attempt}次`);
      } catch (err) {
        console.error(`[CozeVisionChat] 模型=${model} 第${attempt}次失败:`, err);
        // 如果是参数错误（如模型不支持），直接跳到下一个模型
        const errStr = String(err);
        if (errStr.includes('invalid_param') || errStr.includes('ErrInvalidParam') || errStr.includes('model not found') || errStr.includes('已停运')) {
          console.warn(`[CozeVisionChat] 模型=${model} 不可用，跳到降级模型`);
          break; // 跳出重试循环，进入下一个模型
        }
      }

      // 重试前等待一小段时间
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  // 所有模型和重试都失败
  throw new Error('视觉模型调用失败，已尝试所有降级模型');
}

/**
 * LLM 对话（流式）— 支持多模态
 * 包装为 ReadableStream<Uint8Array> 以便 SSE 传输
 */
export function cozeChatStream(
  messages: MultimodalMessage[],
  options?: { model?: string; temperature?: number }
): ReadableStream<Uint8Array> {
  const model = options?.model || 'doubao-seed-2-0-pro-260215';
  const encoder = new TextEncoder();

  const llmMessages = toSdkMessages(messages);

  const llmConfig: LLMConfig = {
    model,
    temperature: options?.temperature,
    streaming: true,
  };

  return new ReadableStream({
    async start(controller) {
      try {
        const { llmClient } = await getCozeClients();
  const stream = llmClient.stream(llmMessages, llmConfig);

        for await (const chunk of stream) {
          if (chunk?.content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('[Coze LLM] 流式对话异常:', err);
        controller.error(err);
      }
    },
  });
}

// ==================== 图像生成 ====================

export interface CozeImageResult {
  urls: string[];
  model: string;
}

/**
 * 图像生成
 */
export async function cozeGenerateImage(
  prompt: string,
  options?: { model?: string; size?: string; image?: string | string[] }
): Promise<CozeImageResult> {
  const request: ImageGenerationRequest = {
    prompt,
    model: options?.model,
    size: options?.size || '2K',
    responseFormat: 'url',
    image: options?.image,  // 角色参考图，确保人物视觉一致性
  };

  const [{ imageClient }, { ImageGenerationResponseHelper }] = await Promise.all([
    getCozeClients(),
    loadCozeSdk(),
  ]);
  const response: ImageGenerationResponse = await imageClient.generate(request);
  const helper = new ImageGenerationResponseHelper(response);

  return {
    urls: helper.imageUrls,
    model: response.model,
  };
}

// ==================== 视频生成 ====================

export interface CozeVideoResult {
  videoUrl: string | null;
  taskId: string;
  model: string;
}

/**
 * 视频生成（同步等待结果）
 */
export async function cozeGenerateVideo(
  prompt: string,
  options?: {
    model?: string;
    duration?: number;
    ratio?: string;
    resolution?: string;
    imageUrl?: string;
  }
): Promise<CozeVideoResult> {
  const contentItems: VideoContent[] = [];

  if (options?.imageUrl) {
    contentItems.push({
      type: 'image_url',
      image_url: { url: options.imageUrl },
    });
  }

  contentItems.push({
    type: 'text',
    text: prompt,
  });

  const videoOpts: Record<string, unknown> = {
    model: options?.model,
    duration: options?.duration || 8,    ratio: (options?.ratio as Ratio) || '16:9',
  };
  // Only include resolution if explicitly provided — default may cause 400 errors
  if (options?.resolution) {
    videoOpts.resolution = options.resolution as Resolution;
  }

  const { videoClient } = await getCozeClients();
  const response: VideoGenerationResponse = await videoClient.videoGeneration(
    contentItems,
    videoOpts
  );

  return {
    videoUrl: response.videoUrl,
    taskId: response.response?.id || '',
    model: options?.model || 'doubao-seedance-1-5-pro-251215',
  };
}

/**
 * 视频生成（异步提交，返回任务ID）
 */
export async function cozeGenerateVideoAsync(
  prompt: string,
  options?: {
    model?: string;
    duration?: number;
    ratio?: string;
    resolution?: string;
    imageUrl?: string;
  }
): Promise<CozeVideoResult> {
  const contentItems: VideoContent[] = [];

  if (options?.imageUrl) {
    contentItems.push({
      type: 'image_url',
      image_url: { url: options.imageUrl },
    });
  }

  contentItems.push({
    type: 'text',
    text: prompt,
  });

  const asyncVideoOpts: Record<string, unknown> = {
    model: options?.model,
    duration: options?.duration || 8,    ratio: (options?.ratio as Ratio) || '16:9',
  };
  if (options?.resolution) {
    asyncVideoOpts.resolution = options.resolution as Resolution;
  }

  const { videoClient } = await getCozeClients();
  const response: VideoGenerationResponse = await videoClient.videoGenerationAsync(
    contentItems,
    asyncVideoOpts
  );

  return {
    videoUrl: response.videoUrl,
    taskId: response.response?.id || '',
    model: options?.model || 'doubao-seedance-1-5-pro-251215',
  };
}

// ==================== TTS 语音合成 ====================

export interface CozeTTSResult {
  audioUrl: string;
  audioSize: number;
}

/**
 * TTS 语音合成
 */
export async function cozeTTS(
  text: string,
  options?: { speaker?: string; audioFormat?: 'pcm' | 'mp3' | 'ogg_opus'; sampleRate?: number }
): Promise<CozeTTSResult> {
  const request: TTSRequest = {
    uid: `tts_${Date.now()}`,
    text,
    speaker: options?.speaker,
    audioFormat: options?.audioFormat,
    sampleRate: options?.sampleRate as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000,
  };

  const { ttsClient } = await getCozeClients();
  const response: TTSResponse = await ttsClient.synthesize(request);

  return {
    audioUrl: response.audioUri,
    audioSize: response.audioSize,
  };
}

// ==================== 统一导出 ====================

export const CozeAPI = {
  chat: cozeChat,
  chatStream: cozeChatStream,
  visionChat: cozeVisionChat,
  generateImage: cozeGenerateImage,
  generateVideo: cozeGenerateVideo,
  generateVideoAsync: cozeGenerateVideoAsync,
  generateTTS: cozeTTS,
};
