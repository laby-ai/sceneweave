'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

const OFFICIAL_ACCOUNT_TOKEN_KEYS = ['account_entitlement_token', 'huiying_account_token'];

type AuthState = 'checking' | 'allowed';

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
    []
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
        const response = await fetch('/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
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
