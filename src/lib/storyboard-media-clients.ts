import { Config, S3Storage, TTSClient, VideoEditClient } from '@/lib/native-provider-sdk';
import { createHuiyingObjectStorage } from './huiying-object-storage';

const config = new Config();

export const storyboardVideoEditor = new VideoEditClient(config);
export const storyboardSpeechSynthesizer = new TTSClient(config);

let storageClient: S3Storage | null = null;

export function getStoryboardStorageClient(): S3Storage | null {
  if (!storageClient) {
    try {
      storageClient = createHuiyingObjectStorage() as S3Storage;
    } catch (error) {
      console.warn('[Storyboard] 对象存储客户端初始化失败:', error);
      storageClient = null;
    }
  }

  return storageClient;
}
