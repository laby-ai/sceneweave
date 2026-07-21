import {
  AccountEntitlementClient,
  AccountServiceError,
  type MemberProviderProfile,
} from '@/lib/account/account-entitlement-client';
import { getAccountApiBase } from '@/lib/account/account-auth-client';
import { resolveAccountSessionFromRequest } from '@/lib/account/account-session';

export type { MemberProviderProfile };

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
  const apiHost = profile.workspace_id
    ? `https://${profile.workspace_id}.cn-beijing.maas.aliyuncs.com`
    : 'https://dashscope.aliyuncs.com';
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
  const client = accountClient();
  if (!client) throw new Error('account_provider_profile_not_configured');
  try {
    return await client.resolveMemberProviderProfile({
      tenantId: session.tenant_id,
      memberId: session.member.id,
      requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof AccountServiceError && error.status === 404) {
      throw new MemberBailianProfileRequiredError();
    }
    throw error;
  }
}
