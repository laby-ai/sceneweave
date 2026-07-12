import {
  extractBYOKConnection,
  imageWithBYOK,
  submitVideoWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
} from './byok-provider';
import { mergeVideosWithLocalFfmpeg } from './local-video-merge';
import { extractLastFrameWithLocalUpload } from './video-frame-extraction';
import { volcengineTTSProvider } from './volcengine-tts';

export class APIError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

export class Config {
  timeout: number;
  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 180_000;
  }
}

export class HeaderUtils {
  static extractForwardHeaders(headers: Headers): Record<string, string> {
    const forwarded: Record<string, string> = {};
    for (const name of [
      'x-yh-provider',
      'x-yh-api-base',
      'x-yh-api-key',
      'x-yh-model',
      'x-yh-image-model',
      'x-yh-video-model',
    ]) {
      const value = headers.get(name)?.trim();
      if (value) forwarded[name] = value;
    }
    return forwarded;
  }
}

function connectionFrom(headers: Record<string, string> = {}): BYOKConnection {
  const requestHeaders = new Headers(headers);
  const connection = extractBYOKConnection(requestHeaders);
  if (!connection) {
    throw new APIError('未配置 Ark/OpenAI-compatible provider', 503);
  }
  return connection;
}

function chatUrl(apiBase: string) {
  const base = apiBase.replace(/\/+$/, '');
  const pathname = new URL(base).pathname.replace(/\/+$/, '');
  return /\/v\d+(?:\/.*)?$/.test(pathname) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function providerError(payload: unknown, status: number) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    return JSON.stringify((payload as { error: unknown }).error);
  }
  return `HTTP ${status}`;
}

async function providerChat(
  headers: Record<string, string>,
  messages: Array<Record<string, unknown>>,
  options: Record<string, unknown> = {},
) {
  const connection = connectionFrom(headers);
  const model = String(options.model || connection.model || '').trim();
  if (!model) throw new APIError('文本模型未配置', 400);
  const response = await fetch(chatUrl(connection.apiBase), {
    method: 'POST',
    headers: { Authorization: `Bearer ${connection.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? options.max_tokens,
    }),
  });
  const raw = await response.text();
  let payload: unknown;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) throw new APIError(providerError(payload, response.status), response.status);
  const content = payload && typeof payload === 'object' && 'choices' in payload
    ? (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
    : undefined;
  if (!content) throw new APIError('文本模型未返回内容', 502);
  return { content: String(content), model };
}

export class LLMClient {
  constructor(_config = new Config(), private readonly headers: Record<string, string> = {}) {}

  async chat(messages: Array<Record<string, unknown>>, options: Record<string, unknown> = {}) {
    return providerChat(this.headers, messages, options);
  }

  async invoke(messages: Array<Record<string, unknown>>, options: Record<string, unknown> = {}) {
    return this.chat(messages, options);
  }

  async *stream(messages: Array<Record<string, unknown>>, options: Record<string, unknown> = {}) {
    const result = await providerChat(this.headers, messages, options);
    yield { content: result.content };
  }
}

export class ImageGenerationClient {
  constructor(_config = new Config(), private readonly headers: Record<string, string> = {}) {}

  async generate(params: Record<string, unknown>) {
    const connection = connectionFrom(this.headers);
    const result = await imageWithBYOK(connection, {
      prompt: String(params.prompt || ''),
      model: typeof params.model === 'string' ? params.model : undefined,
      size: typeof params.size === 'string' ? params.size : undefined,
      n: typeof params.n === 'number' ? params.n : undefined,
    });
    return { data: [{ url: result.url }], imageUrls: [result.url] };
  }

  getResponseHelper(response: unknown) {
    const result = response as { imageUrls?: string[]; data?: Array<{ url?: string }> } | null;
    const imageUrls = result?.imageUrls || result?.data?.map(item => item.url).filter((url): url is string => Boolean(url)) || [];
    return {
      success: imageUrls.length > 0,
      imageUrls,
      errorMessages: imageUrls.length ? [] : ['图片模型未返回图像'],
    };
  }
}

type ProviderContentItem = {
  type?: string;
  text?: string;
  role?: string;
  image_url?: { url?: string };
};

type ProviderVideoOptions = {
  model?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  camerafixed?: boolean;
};

function promptFromContent(content: ProviderContentItem[]) {
  return content.find(item => item.type === 'text')?.text || '';
}

function imageByRole(content: ProviderContentItem[], role: string) {
  return content.find(item => item.type === 'image_url' && item.role === role)?.image_url?.url;
}

export class VideoGenerationClient {
  constructor(_config = new Config(), private readonly headers: Record<string, string> = {}) {}

  async videoGeneration(content: ProviderContentItem[], options: ProviderVideoOptions) {
    const connection = connectionFrom(this.headers);
    const task = await submitVideoWithBYOK(connection, {
      prompt: promptFromContent(content),
      model: options.model,
      duration: options.duration,
      ratio: options.ratio,
      resolution: options.resolution,
      generateAudio: options.generateAudio,
      watermark: options.watermark,
      cameraFixed: options.camerafixed,
      firstFrameImage: imageByRole(content, 'first_frame'),
      lastFrameImage: imageByRole(content, 'last_frame'),
      referenceImages: content
        .filter(item => item.type === 'image_url' && item.role === 'reference_image')
        .map(item => item.image_url?.url)
        .filter((url): url is string => Boolean(url)),
    });
    const result = await waitForVideoWithBYOK(connection, task.taskId);
    return { videoUrl: result.videoUrl, response: { id: task.taskId }, lastFrameUrl: result.lastFrameUrl };
  }

  async videoGenerationAsync(content: ProviderContentItem[], options: ProviderVideoOptions) {
    const connection = connectionFrom(this.headers);
    const task = await submitVideoWithBYOK(connection, {
      prompt: promptFromContent(content),
      model: options.model,
      duration: options.duration,
      ratio: options.ratio,
      resolution: options.resolution,
      generateAudio: options.generateAudio,
      watermark: options.watermark,
      cameraFixed: options.camerafixed,
      firstFrameImage: imageByRole(content, 'first_frame'),
      lastFrameImage: imageByRole(content, 'last_frame'),
    });
    return { videoUrl: '', response: { id: task.taskId } };
  }
}

export class TTSClient {
  constructor(_config = new Config(), _headers: Record<string, string> = {}) {}
  async synthesize(request: Record<string, unknown>) {
    const result = await volcengineTTSProvider.synthesize({
      text: String(request.text || ''),
      voiceType: String(request.speaker || 'female'),
      speechSpeed: typeof request.speechRate === 'number' ? 1 + request.speechRate / 100 : 1,
      outputFormat: request.audioFormat === 'wav' ? 'wav' : 'mp3',
      uid: typeof request.uid === 'string' ? request.uid : undefined,
    });
    if (!result.success || !result.audioBase64) {
      throw new APIError(result.message || '语音合成失败', 503);
    }
    const format = request.audioFormat === 'wav' ? 'wav' : 'mpeg';
    return {
      audioUri: `data:audio/${format};base64,${result.audioBase64}`,
      audioSize: result.audioSizeBytes || Math.floor(result.audioBase64.length * 0.75),
    };
  }
}

export class VideoEditClient {
  constructor(_config = new Config(), _headers: Record<string, string> = {}) {}
  async concatVideos(videoUrls: string[], _options: Record<string, unknown> = {}) {
    const result = await mergeVideosWithLocalFfmpeg(videoUrls);
    return { url: result.videoUrl };
  }
  async compileVideoAudio(
    _videoUrl: string,
    _audioUrl: string,
    _options: Record<string, unknown> = {},
  ): Promise<{ url: string }> {
    throw new APIError('本地音视频混流尚未配置，请保留原始音轨后重试', 503);
  }
  async addSubtitles(
    _videoUrl: string,
    _subtitleConfig: unknown,
    _options: Record<string, unknown> = {},
  ): Promise<{ url: string }> {
    throw new APIError('本地字幕烧录不可用，已保留可下载字幕文件', 503);
  }
}

export class FrameExtractorClient {
  constructor(_config = new Config(), _headers: Record<string, string> = {}) {}
  async extractByCount(videoUrl: string, _count: number) {
    const frameUrl = await extractLastFrameWithLocalUpload(videoUrl);
    if (!frameUrl) throw new APIError('本地 FFmpeg 未能提取视频帧', 503);
    return { data: { chunks: [{ screenshot: frameUrl, timestamp_ms: 0 }] } };
  }
}

export class SearchClient {
  constructor(_config = new Config(), _headers: Record<string, string> = {}) {}
  async imageSearch(_query: string, _count: number): Promise<{
    image_items: Array<{
      id?: string;
      title?: string;
      site_name?: string;
      url?: string;
      image?: { url?: string; width?: number; height?: number };
    }>;
  }> {
    throw new APIError('未配置独立图片搜索服务', 503);
  }
  async webSearchWithSummary(
    _query: string,
    _count: number,
  ): Promise<{
    web_items: Array<{
      id?: string;
      title?: string;
      site_name?: string;
      url?: string;
      snippet?: string;
      summary?: string;
      auth_info_des?: string;
      auth_info_level?: number;
    }>;
    summary?: string;
  }> {
    throw new APIError('未配置独立网页搜索服务', 503);
  }
}

export class S3Storage {
  constructor(_options: Record<string, unknown>) {
    throw new APIError('请通过 createHuiyingObjectStorage 使用 AWS SDK 存储客户端', 500);
  }
  async uploadFromUrl(_input: Record<string, unknown>): Promise<string> {
    throw new APIError('请通过 createHuiyingObjectStorage 上传远程文件', 500);
  }
  async generatePresignedUrl(_input: Record<string, unknown>): Promise<string> {
    throw new APIError('请通过 createHuiyingObjectStorage 生成签名链接', 500);
  }
}

export type LLMConfig = Record<string, unknown>;
export type Message = Record<string, unknown>;
export type LLMResponse = { content: string; model?: string };
export type TTSRequest = Record<string, unknown>;
export type TTSResponse = { audioUri: string; audioSize: number };
