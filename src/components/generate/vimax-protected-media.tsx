'use client';

import { Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  canStreamWorkspaceProtectedMedia,
  fetchWorkspaceProtectedMedia,
  isWorkspaceProtectedMediaUrl,
  prepareWorkspaceProtectedMediaStream,
} from '@/lib/creation-agent/workspace-protected-media';

export function VimaxProtectedVideo({
  url,
  requestHeaders = {},
  className,
}: {
  url: string;
  requestHeaders?: Record<string, string>;
  className?: string;
}) {
  const protectedUrl = isWorkspaceProtectedMediaUrl(url);
  const canStreamDirectly = canStreamWorkspaceProtectedMedia(url, requestHeaders);
  const needsAuthenticatedFetch = protectedUrl && !canStreamDirectly;
  const [blobSource, setBlobSource] = useState('');
  const [streamReady, setStreamReady] = useState(!protectedUrl);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!protectedUrl) {
      setBlobSource('');
      setStreamReady(true);
      setError('');
      return;
    }
    const controller = new AbortController();
    let objectUrl = '';
    setBlobSource('');
    setStreamReady(false);
    setError('');
    if (canStreamDirectly) {
      void prepareWorkspaceProtectedMediaStream(controller.signal)
        .then(() => setStreamReady(true))
        .catch(reason => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '成片读取失败');
        });
      return () => controller.abort();
    }
    void fetchWorkspaceProtectedMedia(url, requestHeaders, controller.signal)
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setBlobSource(objectUrl);
        setStreamReady(true);
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '成片读取失败');
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canStreamDirectly, needsAuthenticatedFetch, protectedUrl, requestHeaders, url]);

  const source = streamReady ? (needsAuthenticatedFetch ? blobSource : url) : '';
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-4 text-xs text-rose-600">{error}</div>;
  if (!source) return <div className={`flex items-center justify-center gap-2 bg-black text-xs text-white/70 ${className || ''}`}><Loader2 className="h-4 w-4 animate-spin" />正在恢复成片…</div>;
  return <video key={source} src={source} controls playsInline preload="metadata" className={className} />;
}

export function VimaxProtectedDownload({
  url,
  filename,
  label,
  requestHeaders = {},
}: {
  url: string;
  filename: string;
  label: string;
  requestHeaders?: Record<string, string>;
}) {
  const className = 'inline-flex items-center gap-1.5 rounded-lg bg-[#2f6bff] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#235bd9] disabled:opacity-60';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!isWorkspaceProtectedMediaUrl(url)) {
    return <a data-testid="vimax-download-result" href={url} download={filename} target="_blank" rel="noreferrer" className={className}><Download className="h-3.5 w-3.5" />下载{label}</a>;
  }
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await fetchWorkspaceProtectedMedia(url, requestHeaders);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '成片下载失败');
    } finally {
      setBusy(false);
    }
  };
  return <span className="inline-flex flex-col gap-1"><button type="button" data-testid="vimax-download-result" onClick={() => void download()} disabled={busy} className={className}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}下载{label}</button>{error ? <span className="text-[11px] text-rose-600">{error}</span> : null}</span>;
}
