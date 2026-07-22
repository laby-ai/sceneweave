import type { VimaxAgentReferenceAsset } from './vimax-agent-contract';

interface GeneratedReferenceImage {
  url?: string;
  label?: string;
  prompt?: string;
}

interface ShotReference {
  index: number;
  referenceUrl?: string;
}

export function resolveVimaxVideoInputAssets(input: {
  generatedImages?: GeneratedReferenceImage[];
  assets?: VimaxAgentReferenceAsset[];
  shots?: ShotReference[];
}): VimaxAgentReferenceAsset[] {
  const byUrl = new Map<string, VimaxAgentReferenceAsset>();
  const add = (asset: VimaxAgentReferenceAsset) => {
    const url = asset.url?.trim();
    if (!url) return;
    const current = byUrl.get(url);
    if (!current || (current.kind !== 'shot' && asset.kind === 'shot')) {
      byUrl.set(url, { ...current, ...asset, url });
    }
  };

  for (const asset of input.assets || []) add(asset);
  for (const shot of input.shots || []) {
    add({
      kind: 'shot',
      label: `Clip ${shot.index}`,
      shotIndex: shot.index,
      url: shot.referenceUrl,
    });
  }
  for (const [index, image] of (input.generatedImages || []).entries()) {
    add({
      kind: 'reference',
      label: image.label || `参考素材${index + 1}`,
      prompt: image.prompt,
      url: image.url,
    });
  }

  return [...byUrl.values()];
}
