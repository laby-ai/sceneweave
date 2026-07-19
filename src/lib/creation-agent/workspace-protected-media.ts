const FINAL_VIDEO_PATH = /\/api\/final-videos\/[0-9a-f-]{36}$/;

export function isWorkspaceProtectedMediaUrl(url: string) {
  try {
    return FINAL_VIDEO_PATH.test(new URL(url, 'http://sceneweave.local').pathname);
  } catch {
    return false;
  }
}

export async function fetchWorkspaceProtectedMedia(
  url: string,
  requestHeaders: Record<string, string>,
  signal?: AbortSignal,
) {
  const response = await fetch(url, { headers: requestHeaders, signal });
  if (!response.ok) throw new Error(`成片读取失败（${response.status}）`);
  return response.blob();
}
