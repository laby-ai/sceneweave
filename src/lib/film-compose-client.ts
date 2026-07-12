'use client';

import { clientApiRequest, type ClientApiOptions } from '@/lib/client-api';
import { filmComposeFailureMessage, parseFilmComposeStreamLine } from '@/lib/film-compose-stream';

export type FilmComposeShotInput = {
  id: string;
  videoUrl: string;
  narration?: string;
  dialogue?: string;
  duration?: number;
  emotion?: string;
  shotType?: string;
  cameraMovement?: string;
};

export type FilmCompositionRequest = {
  shots: FilmComposeShotInput[];
  enableSubtitle: boolean;
  enableVoice: boolean;
  bgmType: string;
  bgmVolume: 'low' | 'medium' | 'high';
  sfxType: string | null;
  sfxVolume: 'low' | 'medium' | 'high';
  style: string;
};

export type FilmCompositionResult = {
  videoUrl: string;
  message: string;
};

type FilmComposeProgress = {
  progress: number;
  message: string;
};

type FilmComposeRequester = (path: string, options: ClientApiOptions) => Promise<Response>;

type FilmComposeClientOptions = {
  request?: FilmComposeRequester;
  onProgress?: (event: FilmComposeProgress) => void;
};

function parseSingleResult(payload: unknown): FilmCompositionResult {
  if (!payload || typeof payload !== 'object') throw new Error('合成服务返回了无效结果');
  const result = payload as { success?: unknown; videoUrl?: unknown; message?: unknown; error?: unknown };
  if (result.success !== true || typeof result.videoUrl !== 'string' || !result.videoUrl) {
    throw new Error(typeof result.error === 'string' ? result.error : '合成服务未返回最终视频');
  }
  return {
    videoUrl: result.videoUrl,
    message: typeof result.message === 'string' && result.message ? result.message : '影片合成完成',
  };
}

async function parseStreamResult(
  response: Response,
  onProgress?: (event: FilmComposeProgress) => void,
): Promise<FilmCompositionResult> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: FilmCompositionResult | null = null;

  const consumeLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const event = parseFilmComposeStreamLine(line);
    if (event.type === 'complete') {
      finalResult = { videoUrl: event.videoUrl, message: event.message };
    } else if (event.type === 'error') {
      throw new Error(event.message);
    } else if (event.type === 'progress') {
      onProgress?.({ progress: event.progress, message: event.message });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) consumeLine(line);
  }
  if (buffer) consumeLine(buffer);
  if (!finalResult) throw new Error('合成服务未返回最终视频');
  return finalResult;
}

export async function requestFilmComposition(
  input: FilmCompositionRequest,
  options: FilmComposeClientOptions = {},
): Promise<FilmCompositionResult> {
  if (input.shots.length === 0) throw new Error('没有可合成的视频，请先生成分镜视频');

  const response = await (options.request || clientApiRequest)('/api/film/compose', {
    method: 'POST',
    body: JSON.stringify({ ...input, requireDurableOutput: true }),
    timeoutMs: 10 * 60_000,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(filmComposeFailureMessage(payload, response.status));
  }

  if (input.shots.length === 1) return parseSingleResult(await response.json());
  return parseStreamResult(response, options.onProgress);
}
