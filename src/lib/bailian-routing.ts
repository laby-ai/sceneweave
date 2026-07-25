export const BAILIAN_UNIVERSAL_API_HOST = 'https://dashscope.aliyuncs.com';
// Compatibility export for clients that previously imported this name.
// A workspace host is only valid when it comes from the trusted account profile.
export const BAILIAN_WORKSPACE_API_HOST = BAILIAN_UNIVERSAL_API_HOST;

export interface BailianApiBases {
  apiHost: string;
  planningApiBase: string;
  videoApiBase: string;
}

export function resolveBailianWorkspaceApiHost(workspaceId?: string): string {
  const normalized = workspaceId?.trim().toLowerCase() || '';
  if (!/^ws-[a-z0-9]+$/.test(normalized)) return BAILIAN_UNIVERSAL_API_HOST;
  return `https://${normalized}.cn-beijing.maas.aliyuncs.com`;
}

export function resolveBailianApiBases(value: string): BailianApiBases {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:') throw new Error('百炼 API Host 必须使用 HTTPS。');
  const suffixPattern = /\/(?:compatible-mode\/v1|api\/v1)\/?$/;
  const pathname = parsed.pathname.replace(suffixPattern, '').replace(/\/$/, '');
  const apiHost = `${parsed.origin}${pathname}`;
  return {
    apiHost,
    planningApiBase: `${apiHost}/compatible-mode/v1`,
    videoApiBase: `${apiHost}/api/v1`,
  };
}
