import type { NextRequest } from 'next/server';
import { resolveAccountAuthContext, type AccountAuthContext } from './account-auth-client';

const SESSION_COOKIE = 'huiying_account_token';

export function accountAuthRequired(): boolean {
  return process.env.ACCOUNT_CENTER_REQUIRE_AUTH?.trim().toLowerCase() === 'true';
}

export function accountSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function bearerTokenFromRequest(request: NextRequest | Request): string {
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  // 回退到会话 Cookie（浏览器端的 fetch 默认带 Cookie，无需手动塞 Authorization 头）。
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : '';
}

export async function resolveAccountSessionFromRequest(request: NextRequest | Request): Promise<AccountAuthContext | null> {
  const token = bearerTokenFromRequest(request);
  if (!token) return null;
  try {
    return await resolveAccountAuthContext(token);
  } catch {
    return null;
  }
}

type SessionCookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  expires?: Date;
};

/** 会话 Cookie 选项。当前 airai.world 走 http，secure 默认关；上 https 后设 ACCOUNT_SESSION_COOKIE_SECURE=true。 */
export function sessionCookieOptions(expiresAt?: string): SessionCookieOptions {
  const expires = expiresAt ? new Date(expiresAt) : undefined;
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.ACCOUNT_SESSION_COOKIE_SECURE?.trim().toLowerCase() === 'true',
    path: '/',
    ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
  };
}

const ACCOUNT_ERROR_MESSAGES: Record<string, string> = {
  account_api_not_configured: '账号服务未配置，请联系管理员。',
  account_request_failed: '账号服务请求失败，请稍后重试。',
  invalid_credentials: '邮箱或密码不正确。',
  user_not_found: '账号不存在，请先注册。',
  email_already_exists: '该邮箱已注册，请直接登录。',
  email_already_registered: '该邮箱已注册，请直接登录。',
  duplicate_email: '该邮箱已注册，请直接登录。',
  weak_password: '密码强度不够，请使用至少 8 位含字母和数字的密码。',
  actor_not_active: '账号已被停用，请联系管理员。',
  rate_limited: '操作过于频繁，请稍后再试。',
};

export function mapAccountError(code: string): string {
  return ACCOUNT_ERROR_MESSAGES[code] || code || '账号服务异常，请稍后重试。';
}
