'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const withBasePath = (url: string) =>
  BASE_PATH && url.startsWith('/') && !url.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${url}` : url;

// 账号中台登录入口（与 nginx /account 一致）。未登录时跳转登录页，登录后回到首页。
const LOGIN_URL = 'http://39.97.246.33/account?next=%2F';

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

export function AccountStatusButton() {
  const [member, setMember] = useState<AccountMember | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(withBasePath('/api/account/me'), { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<AccountMeResponse>) : null))
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
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleLogout = async () => {
    try {
      await fetch(withBasePath('/api/account/logout'), { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* 即使登出请求失败也刷新，回到未登录视图。 */
    }
    window.location.reload();
  };

  if (!member) {
    return (
      <a href={LOGIN_URL} target="_blank" rel="noopener noreferrer" aria-label="登录" title="登录账号" className={baseButtonClass}>
        <User className="h-5 w-5" />
        <span className="mt-0.5 text-[10px] leading-tight">{loading ? '···' : '登录'}</span>
      </a>
    );
  }

  const label = (member.display_name || member.email || '账号').trim();
  const initial = label.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="账号信息"
        title={label}
        className="flex h-12 w-full flex-col items-center justify-center rounded-2xl text-foreground/80 transition-all hover:bg-white/[0.06] hover:text-foreground"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#4F6CFF] text-[11px] font-semibold text-white">{initial}</span>
        <span className="mt-0.5 max-w-full truncate px-1 text-[10px] leading-tight">{label}</span>
      </button>
      {open && (
        <div className="absolute bottom-0 left-[64px] z-[60] w-60 rounded-2xl border border-white/10 bg-[#0c0f18]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#4F6CFF] text-sm font-semibold text-white">{initial}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{member.display_name || '未命名用户'}</div>
              <div className="truncate text-xs text-muted-foreground">{member.email}</div>
            </div>
          </div>
          {tenantName ? <div className="mt-2 truncate text-[11px] text-muted-foreground">所属团队：{tenantName}</div> : null}
          <div className="mt-3 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground/80 transition hover:bg-white/[0.06]"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
