import { createHash } from 'node:crypto';
import { normalizeHappyHorseR2VReferenceImages } from '@/lib/happyhorse-r2v-adapter';
import type { VimaxAgentReferenceAsset } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';

export type HappyHorseR2VReferenceRole = 'subject' | 'shot' | 'scene' | 'prop' | 'reference' | 'previous-tail';

export interface HappyHorseR2VReferenceManifestEntry {
  token: string;
  role: HappyHorseR2VReferenceRole;
  label: string;
  url: string;
}

export interface HappyHorseR2VReferenceManifest {
  version: 'sceneweave-happyhorse-r2v-reference-manifest-v1';
  shotIndex: number;
  artifactRevision: string;
  sha256: string;
  entries: HappyHorseR2VReferenceManifestEntry[];
}

function roleForAsset(kind?: string): HappyHorseR2VReferenceRole {
  if (kind === 'character') return 'subject';
  if (kind === 'scene') return 'scene';
  if (kind === 'prop') return 'prop';
  if (kind === 'shot' || kind === 'shot-reference') return 'shot';
  return 'reference';
}

function roleLabel(role: HappyHorseR2VReferenceRole) {
  return {
    subject: '角色参考',
    shot: '本镜构图参考',
    scene: '场景参考',
    prop: '道具参考',
    reference: '全局视觉参考',
    'previous-tail': '上一镜尾帧参考',
  }[role];
}

export function buildHappyHorseR2VReferenceManifest(input: {
  assets: VimaxAgentReferenceAsset[];
  shotIndex: number;
  artifactRevision: string;
  previousLastFrameUrl?: string;
}): HappyHorseR2VReferenceManifest {
  const shotAssets = input.assets.filter(asset => asset.shotIndex === input.shotIndex);
  const globalAssets = input.assets.filter(asset => asset.shotIndex === undefined);
  const candidates: Array<Omit<HappyHorseR2VReferenceManifestEntry, 'token'>> = [];

  for (const asset of [...shotAssets, ...globalAssets]) {
    for (const view of asset.selectedSubjectViews || []) {
      candidates.push({ role: 'subject', label: view.label, url: view.url });
    }
    if (asset.url) {
      const role = roleForAsset(asset.kind);
      candidates.push({ role, label: asset.label || roleLabel(role), url: asset.url });
    }
  }
  if (input.previousLastFrameUrl) {
    candidates.push({
      role: 'previous-tail',
      label: '上一镜尾帧',
      url: input.previousLastFrameUrl,
    });
  }

  const urls = normalizeHappyHorseR2VReferenceImages(candidates.map(candidate => candidate.url));
  const entries = urls.map((url, index) => {
    const candidate = candidates.find(item => item.url === url) as Omit<HappyHorseR2VReferenceManifestEntry, 'token'>;
    return { token: `[Image ${index + 1}]`, ...candidate };
  });
  const sha256 = createHash('sha256').update(JSON.stringify({
    shotIndex: input.shotIndex,
    artifactRevision: input.artifactRevision,
    entries,
  })).digest('hex');

  return {
    version: 'sceneweave-happyhorse-r2v-reference-manifest-v1',
    shotIndex: input.shotIndex,
    artifactRevision: input.artifactRevision,
    sha256,
    entries,
  };
}

export function buildHappyHorseR2VReferencePrompt(manifest: HappyHorseR2VReferenceManifest) {
  return [
    '【多参考图指代】',
    ...manifest.entries.map(entry => `${entry.token}：${entry.label}（${roleLabel(entry.role)}）`),
    '严格按以上编号识别主体与素材；上一镜尾帧只用于延续人物位置、动作、空间方向和光线，不声称强制成为本镜首帧。',
  ].join('\n');
}
