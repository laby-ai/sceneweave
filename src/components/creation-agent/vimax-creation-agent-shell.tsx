'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { AccountStatusButton } from '@/components/home/account-status-button';
import { BailianConnectionControl } from '@/components/generate/bailian-connection-control';
import { GenerateWorkspace } from '@/components/generate/generate-workspace';
import {
  resolvePaperHostEmbedContext,
  type PaperHostEmbedContext,
} from '@/lib/creation-agent/creation-agent-model';
import { createPaperHostMessage, type PaperHostMessageType } from '@/lib/paper-host-bridge';

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

const withBasePath = (url: string) => (
  BASE_PATH && url.startsWith('/') && !url.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${url}` : url
);

const postToPaperHost = (type: PaperHostMessageType, reason?: string) => {
  if (typeof window === 'undefined' || window.parent === window || !document.referrer) return false;
  try {
    const targetOrigin = new URL(document.referrer).origin;
    window.parent.postMessage(createPaperHostMessage(type, reason), targetOrigin);
    return true;
  } catch {
    return false;
  }
};

export function VimaxCreationAgentShell() {
  const [context, setContext] = useState<PaperHostEmbedContext | null>(null);

  useEffect(() => {
    setContext(resolvePaperHostEmbedContext(window.location.search));
    postToPaperHost('paper-host-ready');
  }, []);

  const handleReturn = useCallback(() => {
    if (!postToPaperHost('paper-host-return')) window.history.back();
  }, []);

  const handleAuthenticationRequired = useCallback((reason: string) => {
    postToPaperHost('paper-host-login-required', reason);
  }, []);

  if (!context) {
    return (
      <main className="creation-agent-dark dark flex min-h-screen items-center justify-center bg-[#07090f] text-sm text-slate-400">
        正在进入创作工作台…
      </main>
    );
  }

  return (
    <main
      data-paper-host-creation-agent="true"
      data-paper-host-vimax="true"
      data-creation-agent-theme="dark"
      className="creation-agent-dark dark flex h-screen min-h-0 flex-col overflow-hidden bg-[#07090f] text-slate-100"
    >
      <header className="relative z-50 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#090c13]/94 px-3 shadow-[0_10px_35px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* The packaged brand mark is already a small fixed-size asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBasePath('/brand/huiying-logo-icon.png')}
            alt="绘影"
            className="h-9 w-9 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">绘影</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">AI 影视创作工作台</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {context.embedded ? (
            <button
              type="button"
              onClick={handleReturn}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:px-3"
              aria-label="返回平台"
              title="返回平台"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">返回平台</span>
            </button>
          ) : null}
          <BailianConnectionControl />
          <AccountStatusButton variant="header" />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <GenerateWorkspace
          agentOnly
          showModelSettings={false}
          requestHeaders={context.requestHeaders}
          storageScope={context.storageScope}
          resumeTaskId={context.resumeTaskId}
          onAuthenticationRequired={handleAuthenticationRequired}
        />
      </div>
    </main>
  );
}
