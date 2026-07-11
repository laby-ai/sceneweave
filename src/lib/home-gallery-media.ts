const DAY_MS = 24 * 60 * 60 * 1000;

export function selectHomeGalleryPreviewWidth(span: string): 256 | 640 {
  return span.split(/\s+/).includes('col-span-2') ? 640 : 256;
}

export function homeGalleryPreviewSizes(span: string): string {
  if (selectHomeGalleryPreviewWidth(span) === 640) {
    return '(max-width: 767px) 100vw, (max-width: 1279px) 40vw, 25vw';
  }
  return '(max-width: 767px) 50vw, (max-width: 1279px) 20vw, 13vw';
}

export function mediaFreshnessBonus(
  fullPath: string,
  lastWriteTime: string,
  now = Date.now(),
): number {
  const normalizedPath = fullPath.toLowerCase().replace(/\\/g, '/');
  if (!normalizedPath.includes('/public/generated/')) return 0;

  const timestamp = Date.parse(lastWriteTime);
  if (!Number.isFinite(timestamp)) return 0;
  const age = Math.max(0, now - timestamp);
  if (age <= 7 * DAY_MS) return 500;
  if (age <= 30 * DAY_MS) return 260;
  if (age <= 90 * DAY_MS) return 100;
  return 0;
}
