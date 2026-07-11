export type FilmComposeStreamEvent =
  | { type: 'ignore' }
  | { type: 'progress'; progress: number; message: string }
  | { type: 'complete'; videoUrl: string }
  | { type: 'error'; message: string };

export function parseFilmComposeStreamLine(line: string): FilmComposeStreamEvent {
  if (!line.startsWith('data: ')) return { type: 'ignore' };

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line.slice(6)) as Record<string, unknown>;
  } catch {
    return { type: 'ignore' };
  }

  if (data.stage === 'error' || data.success === false) {
    return {
      type: 'error',
      message: typeof data.error === 'string' && data.error.trim() ? data.error : '合成失败',
    };
  }

  if (data.stage === 'complete') {
    if (data.success !== true || typeof data.videoUrl !== 'string' || !data.videoUrl.trim()) {
      return { type: 'error', message: '合成服务未返回最终视频' };
    }
    return { type: 'complete', videoUrl: data.videoUrl };
  }

  return {
    type: 'progress',
    progress: typeof data.progress === 'number' ? data.progress : 0,
    message: typeof data.message === 'string' ? data.message : '',
  };
}
