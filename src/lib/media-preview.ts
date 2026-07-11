type MediaPreviewImageOptions = {
  width: 256 | 640 | 1080 | 1920;
  quality?: number;
  basePath?: string;
};

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/\/$/, '');
  return trimmed.startsWith('/') ? trimmed : '';
}

export function buildMediaPreviewImageUrl(
  source: string | null | undefined,
  options: MediaPreviewImageOptions,
): string {
  if (!source) return '';
  if (/^(blob:|data:)/i.test(source)) return source;
  if (/\/api\//i.test(source)) return source;

  const quality = Math.min(80, Math.max(40, options.quality ?? 58));
  const configuredBasePath = options.basePath ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const basePath = normalizeBasePath(configuredBasePath);
  const params = new URLSearchParams({
    url: source,
    w: String(options.width),
    q: String(quality),
  });

  return `${basePath}/_next/image?${params.toString()}`;
}
