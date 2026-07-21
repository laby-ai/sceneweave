import {
  AccountEntitlementClient,
  AccountServiceError,
  type MemberProviderProfile,
} from '@/lib/account/account-entitlement-client';
import { getAccountApiBase } from '@/lib/account/account-auth-client';
import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';

export type { MemberProviderProfile };

export interface MemberBailianOwner {
  tenantId: string;
  memberId: string;
}

export const BAILIAN_TEXT_MODEL = 'qwen3.7-plus';
export const BAILIAN_IMAGE_MODEL = 'qwen-image-3.0-pro';
export const BAILIAN_TTS_MODEL = 'qwen-audio-3.0-tts-plus';
export const BAILIAN_VIDEO_MODEL = 'happyhorse-1.1-i2v';

export class MemberBailianProfileRequiredError extends Error {
  readonly status = 428;
  readonly code = 'bailian_profile_required';

  constructor() {
    super('请先在右上角配置百炼 API Key。');
    this.name = 'MemberBailianProfileRequiredError';
  }
}

export class MemberBailianApiBaseRequiredError extends Error {
  readonly status = 428;
  readonly code = 'bailian_api_base_required';

  constructor() {
    super('请先在右上角补充百炼 API Base，并重新填写 API Key。');
    this.name = 'MemberBailianApiBaseRequiredError';
  }
}

const BAILIAN_WORKSPACE_SUFFIX = '.cn-beijing.maas.aliyuncs.com';

export function parseBailianWorkspaceId(apiBase: string): string {
  const parsed = new URL(apiBase.trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('百炼 API Base 必须是 HTTPS 工作空间地址。');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(BAILIAN_WORKSPACE_SUFFIX)) {
    throw new Error('百炼 API Base 应为 cn-beijing.maas.aliyuncs.com 工作空间地址。');
  }
  const workspaceId = hostname.slice(0, -BAILIAN_WORKSPACE_SUFFIX.length);
  if (!/^[a-z0-9_-]{3,128}$/.test(workspaceId)) {
    throw new Error('百炼 API Base 中缺少有效的工作空间标识。');
  }
  return workspaceId;
}

export function bailianWorkspaceApiHost(workspaceId: string): string {
  const normalized = workspaceId.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,128}$/.test(normalized)) throw new MemberBailianApiBaseRequiredError();
  return `https://${normalized}${BAILIAN_WORKSPACE_SUFFIX}`;
}

function envValue(name: string): string {
  return process.env[name]?.trim() || '';
}

function accountClient(): AccountEntitlementClient | null {
  const baseUrl = getAccountApiBase();
  const appKey = envValue('ACCOUNT_CENTER_APP_KEY');
  const credentialKey = envValue('ACCOUNT_CENTER_CREDENTIAL_KEY');
  const clientSecret = envValue('ACCOUNT_CENTER_CLIENT_SECRET');
  if (!baseUrl || !appKey || !credentialKey || !clientSecret) return null;
  return new AccountEntitlementClient({ baseUrl, appKey, credentialKey, clientSecret });
}

export function buildMemberBailianConnections(profile: MemberProviderProfile) {
  if (profile.provider_id !== 'aliyun-bailian' || profile.region !== 'cn-beijing') {
    throw new Error('unsupported_member_provider_profile');
  }
  const apiHost = bailianWorkspaceApiHost(profile.workspace_id);
  return {
    planning: {
      provider: 'openai-compatible' as const,
      apiBase: `${apiHost}/compatible-mode/v1`,
      apiKey: profile.api_key,
      model: BAILIAN_TEXT_MODEL,
      imageModel: BAILIAN_IMAGE_MODEL,
    },
    video: {
      provider: 'happyhorse-dashscope' as const,
      apiBase: `${apiHost}/api/v1`,
      apiKey: profile.api_key,
      videoModel: BAILIAN_VIDEO_MODEL,
    },
  };
}

export async function resolveMemberBailianProfile(
  request: Request,
): Promise<MemberProviderProfile | null> {
  const session = await resolveAccountSessionFromRequest(request);
  if (!session) return null;
  return resolveMemberBailianProfileForOwner(
    { tenantId: session.tenant_id, memberId: session.member.id },
    request.headers.get('x-request-id') || crypto.randomUUID(),
  );
}

export async function resolveMemberBailianProfileForOwner(
  owner: MemberBailianOwner,
  requestId = crypto.randomUUID(),
): Promise<MemberProviderProfile> {
  const client = accountClient();
  if (!client) throw new Error('account_provider_profile_not_configured');
  try {
    return await client.resolveMemberProviderProfile({
      tenantId: owner.tenantId,
      memberId: owner.memberId,
      requestId,
    });
  } catch (error) {
    if (error instanceof AccountServiceError && error.status === 404) {
      throw new MemberBailianProfileRequiredError();
    }
    throw error;
  }
}
