'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { GenerateWorkspace } from '@/components/generate/generate-workspace';
import {
  resolvePaperHostEmbedContext,
  type PaperHostEmbedContext,
} from '@/lib/creation-agent/creation-agent-model';
import { createPaperHostMessage, type PaperHostMessageType } from '@/lib/paper-host-bridge';

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
      <main className="flex min-h-screen items-center justify-center bg-black text-sm text-white/60">
        正在进入创作工作台…
      </main>
    );
  }

  return (
    <main
      data-paper-host-creation-agent="true"
      data-paper-host-vimax="true"
      className="flex h-screen min-h-0 flex-col overflow-hidden bg-black"
    >
      <header className="flex h-11 shrink-0 items-center justify-end border-b border-white/10 bg-black px-3">
        <button
          type="button"
          onClick={handleReturn}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          返回平台
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <GenerateWorkspace
          requestHeaders={context.requestHeaders}
          storageScope={context.storageScope}
          onAuthenticationRequired={handleAuthenticationRequired}
        />
      </div>
    </main>
  );
}
