/**
 * 账号中台「本地鉴权」客户端（AUTH_MODE=local）。
 * 注册/登录/会话校验全部走中台 /v1/auth/*，由中台签发 JWT，绘影只持有 token。
 * 契约已对照线上实测：register / login / me 均稳定返回 { token, member, tenant }。
 */

export type AccountMember = {
  id: string;
  display_name: string;
  email: string;
  role_key: string;
  status: string;
};

export type AccountAuthSession = {
  token: string;
  expires_at: string;
  tenant_id: string;
  tenant_name: string;
  member: AccountMember;
};

export type AccountAuthContext = Omit<AccountAuthSession, 'token' | 'expires_at'> & {
  expires_at?: string;
};

export type AccountPasswordResetResult = {
  status: string;
  delivery?: 'email' | 'manual_follow_up' | string;
  message?: string;
};

function envValue(name: string): string {
  return process.env[name]?.trim() || '';
}

export function getAccountApiBase(): string {
  return envValue('ACCOUNT_CENTER_API_BASE').replace(/\/$/, '');
}

export function getAccountTenantId(): string {
  return envValue('ACCOUNT_CENTER_TENANT_ID') || 'tenant_acme';
}

function accountEndpoint(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function getPasswordResetEndpoint(baseUrl: string): string {
  return envValue('ACCOUNT_CENTER_PASSWORD_RESET_URL')
    || accountEndpoint(baseUrl, envValue('ACCOUNT_CENTER_PASSWORD_RESET_PATH') || '/v1/auth/password-reset/request');
}

async function readAccountResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error || 'account_request_failed')
      : 'account_request_failed';
    throw new Error(error);
  }
  return payload as T;
}

export async function loginAccountUser(input: { email: string; password: string }): Promise<AccountAuthSession> {
  const baseUrl = getAccountApiBase();
  if (!baseUrl) throw new Error('account_api_not_configured');
  const response = await fetch(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readAccountResponse<AccountAuthSession>(response);
}

export async function registerAccountUser(input: {
  email: string;
  password: string;
  displayName: string;
  tenantId?: string;
}): Promise<AccountAuthSession> {
  const baseUrl = getAccountApiBase();
  if (!baseUrl) throw new Error('account_api_not_configured');
  const response = await fetch(`${baseUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      display_name: input.displayName,
      tenant_id: input.tenantId || getAccountTenantId(),
    }),
  });
  return readAccountResponse<AccountAuthSession>(response);
}

export async function resolveAccountAuthContext(token: string): Promise<AccountAuthContext> {
  const baseUrl = getAccountApiBase();
  if (!baseUrl) throw new Error('account_api_not_configured');
  const response = await fetch(`${baseUrl}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return readAccountResponse<AccountAuthContext>(response);
}

export async function requestAccountPasswordReset(input: { email: string; tenantId?: string }): Promise<AccountPasswordResetResult> {
  const baseUrl = getAccountApiBase();
  if (!baseUrl) throw new Error('account_api_not_configured');
  const response = await fetch(getPasswordResetEndpoint(baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      tenant_id: input.tenantId || getAccountTenantId(),
    }),
  });
  return readAccountResponse<AccountPasswordResetResult>(response);
}
