'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { accountLoginUrl, clientApiFetch, hasStoredAccountToken } from '@/lib/client-api';

const AUTH_CHECK_TIMEOUT_MS = 8_000;

type AuthState = 'checking' | 'allowed';

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

      if (!hasStoredAccountToken()) {
        window.location.replace(accountLoginUrl());
        return;
      }

      try {
        await clientApiFetch('/api/account/me', { timeoutMs: AUTH_CHECK_TIMEOUT_MS });
        if (!cancelled) setAuthState('allowed');
      } catch {
        if (!cancelled) window.location.replace(accountLoginUrl());
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
