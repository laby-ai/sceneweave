import { clientApiDownloadBlob, clientApiRequest, ClientRequestError } from '@/lib/client-api';

const FINAL_VIDEO_PATH = /\/api\/final-videos\/[0-9a-f-]{36}$/;
const PROJECT_ATTACHMENT_PATH = /\/api\/project-attachments\/[0-9a-f-]{36}$/;

export function isWorkspaceProtectedMediaUrl(url: string) {
  try {
    return FINAL_VIDEO_PATH.test(new URL(url, 'http://sceneweave.local').pathname);
  } catch {
    return false;
  }
}

export function isWorkspaceProtectedImageUrl(url: string) {
  try {
    return PROJECT_ATTACHMENT_PATH.test(new URL(url, 'http://sceneweave.local').pathname);
  } catch {
    return false;
  }
}

export function canStreamWorkspaceProtectedMedia(
  url: string,
  requestHeaders: Record<string, string>,
) {
  return isWorkspaceProtectedMediaUrl(url) && Object.keys(requestHeaders).length === 0;
}

export async function prepareWorkspaceProtectedMediaStream(signal?: AbortSignal) {
  const response = await clientApiRequest('/api/account/me', {
    signal,
    redirectOnUnauthorized: false,
  });
  if (!response.ok) {
    throw new Error(`成片读取失败（${response.status}）`);
  }
}

export async function fetchWorkspaceProtectedMedia(
  url: string,
  requestHeaders: Record<string, string>,
  signal?: AbortSignal,
) {
  try {
    return await clientApiDownloadBlob(url, {
      headers: requestHeaders,
      signal,
      redirectOnUnauthorized: false,
    });
  } catch (error) {
    if (error instanceof ClientRequestError && error.status) {
      throw new Error(`成片读取失败（${error.status}）`);
    }
    throw error;
  }
}

export async function fetchWorkspaceProtectedImage(
  url: string,
  requestHeaders: Record<string, string>,
  signal?: AbortSignal,
) {
  try {
    return await clientApiDownloadBlob(url, {
      headers: requestHeaders,
      signal,
      redirectOnUnauthorized: false,
    });
  } catch (error) {
    if (error instanceof ClientRequestError && error.status) {
      throw new Error(`参考图读取失败（${error.status}）`);
    }
    throw error;
  }
}
