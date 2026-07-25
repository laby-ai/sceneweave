export interface RecoveredVimaxReferenceAsset {
  url?: string;
  [key: string]: unknown;
}

interface RecoverPersistedVimaxReferenceAssetsInput {
  taskId: string;
  headers: Record<string, string>;
  isCurrent: () => boolean;
  fetchImpl?: typeof fetch;
  sleep?: (durationMs: number) => Promise<void>;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

const defaultSleep = (durationMs: number) => new Promise<void>(resolve => {
  setTimeout(resolve, durationMs);
});

export async function recoverPersistedVimaxReferenceAssets(
  input: RecoverPersistedVimaxReferenceAssetsInput,
): Promise<RecoveredVimaxReferenceAsset[] | null> {
  const fetchImpl = input.fetchImpl || fetch;
  const sleep = input.sleep || defaultSleep;
  const pollIntervalMs = input.pollIntervalMs ?? 2_000;
  const maxWaitMs = input.maxWaitMs ?? 8 * 60_000;
  const deadline = Date.now() + maxWaitMs;
  const taskPath = `/api/tasks/${encodeURIComponent(input.taskId)}`;

  while (Date.now() <= deadline) {
    if (!input.isCurrent()) return null;

    const response = await fetchImpl(taskPath, {
      headers: input.headers,
      cache: 'no-store',
    }).catch(() => null);
    if (response?.ok) {
      const payload = await response.json().catch(() => null) as {
        task?: { result?: { vimaxReferenceAssets?: unknown } };
      } | null;
      const assets = payload?.task?.result?.vimaxReferenceAssets;
      if (Array.isArray(assets) && assets.length > 0) {
        return assets as RecoveredVimaxReferenceAsset[];
      }
    }

    await sleep(pollIntervalMs);
  }

  return null;
}
