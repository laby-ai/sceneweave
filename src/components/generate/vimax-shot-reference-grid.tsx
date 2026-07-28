'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { clientApiFetch } from '@/lib/client-api';
import type { ChatMessage } from '@/lib/smart-assistant-panel-model';
import { VimaxProtectedImage } from '@/components/generate/vimax-protected-media';

type VimaxShot = NonNullable<NonNullable<ChatMessage['vimaxAgent']>['shots']>[number];

interface UseNextShotResponse {
  success: boolean;
  error?: string;
  sourceShotIndex?: number;
  targetShotIndex?: number;
  targetReference?: {
    url?: string;
  };
}

export function VimaxShotReferenceGrid({
  taskId,
  shots: initialShots,
  phase,
  requestHeaders,
}: {
  taskId?: string;
  shots: VimaxShot[];
  phase?: NonNullable<ChatMessage['vimaxAgent']>['phase'];
  requestHeaders?: Record<string, string>;
}) {
  const [shots, setShots] = useState(initialShots);
  const [busyShot, setBusyShot] = useState<number | null>(null);
  const [completedShot, setCompletedShot] = useState<number | null>(null);
  const [errorShot, setErrorShot] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => setShots(initialShots), [initialShots]);

  async function assignForNextShot(sourceShotIndex: number) {
    if (!taskId || busyShot !== null) return;
    const targetShotIndex = sourceShotIndex + 1;
    setBusyShot(sourceShotIndex);
    setCompletedShot(null);
    setErrorShot(null);
    setError('');
    try {
      const response = await clientApiFetch<UseNextShotResponse>(
        `/api/production/projects/${encodeURIComponent(taskId)}/references/use-next-shot`,
        {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ sourceShotIndex, targetShotIndex }),
          redirectOnUnauthorized: false,
        },
      );
      if (!response.success || !response.targetReference?.url) {
        throw new Error(response.error || '参考画面保存失败');
      }
      setShots(current => current.map(shot => (
        shot.index === targetShotIndex
          ? { ...shot, referenceUrl: response.targetReference?.url, status: 'reference' as const }
          : shot
      )));
      setCompletedShot(sourceShotIndex);
    } catch (reason) {
      setErrorShot(sourceShotIndex);
      setError(reason instanceof Error ? reason.message : '参考画面保存失败，请重试。');
    } finally {
      setBusyShot(null);
    }
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="vimax-shot-reference-grid">
      {shots.map((shot, index) => {
        const nextShot = shots[index + 1];
        const canUseForNext = Boolean(
          taskId
          && phase === 'reference_assets'
          && shot.referenceUrl
          && !shot.videoUrl
          && nextShot
          && !nextShot.videoUrl,
        );
        return (
          <article key={shot.index} data-testid={`vimax-shot-card-${shot.index}`} className="overflow-hidden rounded-xl border border-[#e1e5eb] bg-[#f8f9fb]">
            {shot.videoUrl ? (
              <video
                src={shot.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
            ) : shot.referenceUrl ? (
              <VimaxProtectedImage
                url={shot.referenceUrl}
                alt={`Clip ${shot.index} · ${shot.title}`}
                requestHeaders={requestHeaders}
                className="aspect-video w-full object-cover"
              />
            ) : null}
            <div className="space-y-1 px-3 py-2 text-xs">
              <div className="flex min-h-[24px] items-center gap-2">
                <span className="shrink-0 font-medium text-[#2f6bff]">镜头 {shot.index}</span>
                <span className="min-w-0 flex-1 truncate text-[#3a414b]">{shot.title}</span>
                <span className="shrink-0 text-[#858c97]">{shot.duration}s · {shot.camera}</span>
              </div>
              {shot.prompt ? <p className="line-clamp-3 text-[#858c97]">{shot.prompt}</p> : null}
              {canUseForNext ? (
                <button
                  type="button"
                  data-testid={`use-shot-${shot.index}-as-next-reference`}
                  disabled={busyShot !== null}
                  onClick={() => void assignForNextShot(shot.index)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#dce4f4] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#52617a] disabled:opacity-50"
                >
                  {busyShot === shot.index ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {busyShot === shot.index ? '正在保存…' : `作为镜头 ${nextShot.index} 参考`}
                </button>
              ) : null}
              {completedShot === shot.index ? (
                <p role="status" className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
                  <Check className="h-3 w-3" />已用于镜头 {nextShot?.index}，刷新后仍会保留。
                </p>
              ) : null}
              {error && errorShot === shot.index && busyShot === null && canUseForNext ? (
                <p role="alert" className="mt-2 text-[11px] text-red-600">{error}</p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
