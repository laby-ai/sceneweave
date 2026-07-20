import fs from 'node:fs/promises';
import path from 'node:path';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fc[0-9a-f]{2}:/i,
  /^\[?fd[0-9a-f]{2}:/i,
];

export interface PublicFrameHandoffReadiness {
  ready: boolean;
  blockers: string[];
  baseUrl?: string;
  note: string;
}

function readEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function resolvePublicAssetStore() {
  const configured = readEnv('HUIYING_PUBLIC_ASSET_STORE_PATH');
  return configured ? path.resolve(configured) : path.join(process.cwd(), 'public');
}

function normalizePublicBaseUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value.replace(/\/+$/, ''));
    if (url.protocol !== 'https:') return undefined;
    const host = url.hostname.toLowerCase();
    if (PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(host))) return undefined;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

export function getPublicFrameHandoffReadiness(): PublicFrameHandoffReadiness {
  const rawBaseUrl = readEnv('HUIYING_PUBLIC_ASSET_BASE_URL') || readEnv('HUIYING_PROJECT_DOMAIN_DEFAULT');
  const baseUrl = normalizePublicBaseUrl(rawBaseUrl);
  if (!baseUrl) {
    return {
      ready: false,
      blockers: ['HUIYING_PUBLIC_ASSET_BASE_URL'],
      note: '可选本地抽帧公网回传通道未 ready：需要 HTTPS 公网地址，localhost/内网地址不能提供给 Ark 作为 firstFrame。',
    };
  }

  return {
    ready: true,
    blockers: [],
    baseUrl,
    note: '可把本地 FFmpeg 抽出的尾帧写入 public/generated/frames，并通过公网 HTTPS URL 交给下一段。',
  };
}

export async function savePublicFrameForHandoff(framePath: string): Promise<string | undefined> {
  const readiness = getPublicFrameHandoffReadiness();
  if (!readiness.ready || !readiness.baseUrl) return undefined;

  const publicDir = path.join(resolvePublicAssetStore(), 'generated', 'frames');
  const fileName = `last-frame-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  const targetPath = path.join(publicDir, fileName);
  await fs.mkdir(publicDir, { recursive: true });
  await fs.copyFile(framePath, targetPath);
  return `${readiness.baseUrl}/generated/frames/${fileName}`;
}
