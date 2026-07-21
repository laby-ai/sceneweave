'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { accountLoginUrl, clearStoredAccountTokens, clientApiFetch } from '@/lib/client-api';

const ACCOUNT_CHECK_TIMEOUT_MS = 8_000;
type AccountMember = {
  id: string;
  display_name: string;
  email: string;
  role_key: string;
  status: string;
};

type AccountMeResponse = {
  member?: AccountMember;
  tenant_name?: string;
};

const baseButtonClass =
  'flex h-12 w-full flex-col items-center justify-center rounded-2xl text-foreground/60 transition-all hover:bg-white/[0.06] hover:text-foreground';

interface AccountStatusButtonProps {
  variant?: 'rail' | 'header';
}

export function AccountStatusButton({ variant = 'rail' }: AccountStatusButtonProps) {
  const [member, setMember] = useState<AccountMember | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loginHref, setLoginHref] = useState('/account-login.html?next=%2Fhuiying');
  const containerRef = useRef<HTMLDivElement>(null);
  const header = variant === 'header';

  useEffect(() => {
    setLoginHref(accountLoginUrl());
    let alive = true;
    clientApiFetch<AccountMeResponse>('/api/account/me', {
      timeoutMs: ACCOUNT_CHECK_TIMEOUT_MS,
      redirectOnUnauthorized: false,
    })
      .then((data) => {
        if (!alive) return;
        setMember(data?.member ?? null);
        setTenantName(data?.tenant_name ?? '');
      })
      .catch(() => {
        if (alive) setMember(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    setLogoutError('');
    setLogoutPending(true);
    try {
      await clientApiFetch('/api/account/logout', {
        method: 'POST',
        timeoutMs: ACCOUNT_CHECK_TIMEOUT_MS,
        redirectOnUnauthorized: false,
      });
      clearStoredAccountTokens();
      setMember(null);
      setTenantName('');
      setOpen(false);
      window.location.replace(accountLoginUrl());
    } catch {
      setLogoutError('暂时无法安全退出，请检查网络后重试。');
    } finally {
      setLogoutPending(false);
    }
  };

  if (!member) {
    return (
      <a
        href={loginHref}
        target={header ? undefined : '_blank'}
        rel={header ? undefined : 'noopener noreferrer'}
        aria-label="登录"
        title="登录账号"
        className={header
          ? 'inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:px-3'
          : baseButtonClass}
      >
        <User className="h-5 w-5" />
        <span className={header ? '' : 'mt-0.5 text-[10px] leading-tight'}>{loading ? '···' : '登录'}</span>
      </a>
    );
  }

  const label = (member.display_name || member.email || '账号').trim();
  const initial = label.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className={header ? 'relative shrink-0' : 'relative w-full'}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="账号信息"
        title={label}
        aria-expanded={open}
        className={header
          ? 'inline-flex h-10 max-w-[150px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 text-slate-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:px-2.5'
          : 'flex h-12 w-full flex-col items-center justify-center rounded-2xl text-foreground/80 transition-all hover:bg-white/[0.06] hover:text-foreground'}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#4F6CFF] text-[11px] font-semibold text-white">{initial}</span>
        <span className={header ? 'hidden min-w-0 truncate text-xs font-medium sm:block' : 'mt-0.5 max-w-full truncate px-1 text-[10px] leading-tight'}>{label}</span>
      </button>
      {open && (
        <div className={`absolute z-[60] w-64 rounded-xl border border-white/10 bg-[#0c0f18]/98 p-3 shadow-2xl shadow-black/60 backdrop-blur-2xl ${header ? 'right-0 top-full mt-2' : 'bottom-0 left-[64px]'}`}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#4F6CFF] text-sm font-semibold text-white">{initial}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{member.display_name || '未命名用户'}</div>
              <div className="truncate text-xs text-muted-foreground">{member.email}</div>
            </div>
          </div>
          {tenantName ? <div className="mt-2 truncate text-[11px] text-muted-foreground">所属团队：{tenantName}</div> : null}
          {logoutError ? <div className="mt-2 text-xs leading-5 text-red-300" role="alert">{logoutError}</div> : null}
          <div className="mt-3 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutPending}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground/80 transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {logoutPending ? '正在安全退出…' : '退出登录'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
