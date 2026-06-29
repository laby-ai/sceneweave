'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

const OFFICIAL_ACCOUNT_TOKEN_KEYS = ['account_entitlement_token', 'huiying_account_token'];
const AUTH_CHECK_TIMEOUT_MS = 8_000;

type AuthState = 'checking' | 'allowed';

function detectBasePath(): string {
  const configured = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/huiying')) return '/huiying';
  return '';
}

function withBasePath(url: string): string {
  const basePath = detectBasePath();
  if (!basePath) return url;
  if (url.startsWith('/api') && !url.startsWith(`${basePath}/`)) {
    return `${basePath}${url}`;
  }
  return url;
}

function getStoredAccountToken(): string {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of OFFICIAL_ACCOUNT_TOKEN_KEYS) {
      const token = storage.getItem(key)?.trim();
      if (token) return token;
    }
  }
  return '';
}

function loginRedirectUrl(): string {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/account-login.html?next=${encodeURIComponent(next)}`;
}

function shouldGuardCurrentPath(): boolean {
  const forceGuard = process.env.NEXT_PUBLIC_REQUIRE_ACCOUNT_AUTH?.trim().toLowerCase() === 'true';
  return forceGuard || window.location.pathname.startsWith('/huiying');
}

export function AccountProductAuthGuard({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('checking');

  const checkingView = useMemo(
    () => (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-white/70">
        正在确认账号登录状态...
      </div>
    ),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function verifyAccountToken() {
      if (!shouldGuardCurrentPath()) {
        setAuthState('allowed');
        return;
      }

      const token = getStoredAccountToken();
      if (!token) {
        window.location.replace(loginRedirectUrl());
        return;
      }

      try {
        const response = await fetch(withBasePath('/api/account/me'), {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(AUTH_CHECK_TIMEOUT_MS),
        });

        if (!response.ok) {
          window.location.replace(loginRedirectUrl());
          return;
        }

        if (!cancelled) setAuthState('allowed');
      } catch {
        window.location.replace(loginRedirectUrl());
      }
    }

    void verifyAccountToken();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState !== 'allowed') return checkingView;
  return <>{children}</>;
}
