type VideoContentItem = Record<string, unknown>;

type VideoGenerationOptions = {
  model: string;
  duration: number;
  ratio: string;
  resolution: string;
  generateAudio: boolean;
  watermark: boolean;
  camerafixed: boolean;
};

type SpeechRequest = {
  uid: string;
  text: string;
  speaker: string;
  speechRate: number;
};

export class VideoGenerateProviderError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'VideoGenerateProviderError';
    this.statusCode = statusCode;
  }
}

export function isVideoGenerateProviderError(error: unknown): error is VideoGenerateProviderError {
  return error instanceof VideoGenerateProviderError;
}

async function getProviderRuntime(headers: Headers) {
  const {
    APIError,
    Config,
    HeaderUtils,
    TTSClient,
    VideoEditClient,
    VideoGenerationClient,
  } = await import('coze-coding-dev-sdk');

  const customHeaders = HeaderUtils.extractForwardHeaders(headers);
  const config = new Config({
    timeout: 1800000,
  } as any);

  return {
    APIError,
    config,
    customHeaders,
    createVideoClient: () => new VideoGenerationClient(config, customHeaders),
    createSpeechClient: () => new TTSClient(config, customHeaders),
    createVideoEditor: () => new VideoEditClient(config, customHeaders),
  };
}

function wrapProviderError(error: unknown, APIError: new (...args: any[]) => Error): never {
  if (error instanceof APIError) {
    const apiError = error as Error & { statusCode?: number };
    throw new VideoGenerateProviderError(apiError.message, apiError.statusCode);
  }
  throw error;
}

export async function generateVideoWithProvider(
  content: VideoContentItem[],
  options: VideoGenerationOptions,
  headers: Headers
): Promise<any> {
  const runtime = await getProviderRuntime(headers);
  try {
    return await runtime.createVideoClient().videoGeneration(content as any, options as any);
  } catch (error: unknown) {
    wrapProviderError(error, runtime.APIError);
  }
}

export async function synthesizeVideoGenerateSpeech(
  request: SpeechRequest,
  headers: Headers
): Promise<{ audioUri: string }> {
  const runtime = await getProviderRuntime(headers);
  try {
    return await runtime.createSpeechClient().synthesize({
      uid: request.uid,
      text: request.text,
      speaker: request.speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: request.speechRate,
    });
  } catch (error: unknown) {
    wrapProviderError(error, runtime.APIError);
  }
}

export async function compileVideoGenerateAudio(
  videoUrl: string,
  audioUri: string,
  headers: Headers
): Promise<{ url?: string }> {
  const runtime = await getProviderRuntime(headers);
  try {
    return await runtime.createVideoEditor().compileVideoAudio(videoUrl, audioUri, {
      isVideoAudioSync: true,
      isAudioReserve: false,
      outputSync: {
        sync_mode: 'video',
        sync_method: 'trim',
      },
    });
  } catch (error: unknown) {
    wrapProviderError(error, runtime.APIError);
  }
}
