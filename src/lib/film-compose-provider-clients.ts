import { createHuiyingObjectStorage } from './huiying-object-storage';

const FILM_COMPOSE_URL_EXPIRE_SECONDS = 7 * 24 * 60 * 60;

type FilmComposeRuntime = {
  createVideoEditor: () => any;
  createSpeechSynthesizer: () => any;
  createStorage: () => any;
};

let runtimePromise: Promise<FilmComposeRuntime> | null = null;
let storageClient: any | null | undefined;

async function getFilmComposeRuntime(): Promise<FilmComposeRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const { Config, TTSClient, VideoEditClient } = await import('coze-coding-dev-sdk');
      const config = new Config();

      return {
        createVideoEditor: () => new VideoEditClient(config),
        createSpeechSynthesizer: () => new TTSClient(config),
        createStorage: () => createHuiyingObjectStorage(),
      };
    })();
  }
  return runtimePromise;
}

async function getFilmComposeStorageClient(): Promise<any | null> {
  if (storageClient !== undefined) return storageClient;

  try {
    const runtime = await getFilmComposeRuntime();
    storageClient = runtime.createStorage();
  } catch (error) {
    console.warn('[Film Compose] 对象存储初始化失败:', error);
    storageClient = null;
  }

  return storageClient;
}

export async function storeFilmComposeUrl(
  url: string,
  options: { timeout?: number; expireTime?: number } = {}
): Promise<string | undefined> {
  const storage = await getFilmComposeStorageClient();
  if (!storage) return undefined;

  const fileKey = await storage.uploadFromUrl({
    url,
    timeout: options.timeout || 120000,
  });
  return storage.generatePresignedUrl({
    key: fileKey,
    expireTime: options.expireTime || FILM_COMPOSE_URL_EXPIRE_SECONDS,
  });
}

export async function concatFilmComposeVideos(
  videoUrls: string[],
  transitions?: string[]
): Promise<{ url: string }> {
  const runtime = await getFilmComposeRuntime();
  return runtime.createVideoEditor().concatVideos(videoUrls, {
    urlExpire: FILM_COMPOSE_URL_EXPIRE_SECONDS,
    transitions,
  });
}

export async function synthesizeFilmComposeVoice(
  request: { uid: string; text: string; speaker: string; audioFormat: 'mp3' }
): Promise<{ audioUri?: string }> {
  const runtime = await getFilmComposeRuntime();
  return runtime.createSpeechSynthesizer().synthesize(request);
}

export async function compileFilmComposeAudio(
  videoUrl: string,
  audioUrl: string,
  reserveAudio: boolean
): Promise<{ url: string }> {
  const runtime = await getFilmComposeRuntime();
  return runtime.createVideoEditor().compileVideoAudio(videoUrl, audioUrl, {
    isVideoAudioSync: false,
    isAudioReserve: reserveAudio,
    outputSync: {
      sync_method: 'trim',
      sync_mode: 'video',
    },
    urlExpire: FILM_COMPOSE_URL_EXPIRE_SECONDS,
  });
}
