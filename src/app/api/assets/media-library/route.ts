import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CsvRow = Record<string, string>;

const MEDIA_INDEX_PATH = path.resolve(
  process.cwd(),
  '..',
  'outputs',
  'media-addresses',
  'past-image-video-addresses-20260627.csv',
);

const SUPPORTED_TYPES = new Set(['image', 'video']);
const SUPPORTED_EXTENSIONS = new Map<string, string>([
  ['.jpg', 'image'],
  ['.jpeg', 'image'],
  ['.png', 'image'],
  ['.webp', 'image'],
  ['.mp4', 'video'],
  ['.mov', 'video'],
  ['.webm', 'video'],
]);

const CURATED_FILESYSTEM_ROOTS = [
  path.resolve(process.cwd(), 'public', 'generated'),
  path.resolve(process.cwd(), 'public', 'home'),
  path.resolve(process.cwd(), 'public', 'samples'),
  'D:/C_Migrated/Users_16571_Documents_Codex/2026-06-15/files-mentioned-by-the-user-1/work/project/projects/public/generated',
  'D:/C_Migrated/Users_16571_Documents_Codex/2026-06-15/files-mentioned-by-the-user-gz/work/extracted/projects/public/generated',
].map(root => path.normalize(root));

const LOW_QUALITY_NAME_PATTERNS = [
  /apple-touch/i,
  /brand/i,
  /clipboard/i,
  /favicon/i,
  /icon/i,
  /logo/i,
  /placeholder/i,
  /screenshot/i,
  /thumb/i,
];

const LOW_QUALITY_PATH_TOKENS = [
  '/.next/',
  '/appdata/local/temp/',
  '/brand/',
  '/cache/',
  '/node_modules/',
  '/public/favicon',
  '/screenshots/',
  '/screenshot/',
];

const CURATED_SOURCE_TOKENS = [
  '/sceneweave-recovered-live/public/home/',
  '/sceneweave-recovered-live/public/samples/',
  '/sceneweave-recovered-live/public/generated/',
  '/public/home/',
  '/public/samples/',
  '/files-mentioned-by-the-user-1/work/project/projects/public/generated/',
  '/files-mentioned-by-the-user-gz/work/extracted/projects/public/generated/',
];

const GENERATED_PRODUCT_NAME_PATTERN =
  /(sceneweave|huiying|vimax|seedance|rainline|liming|zhibing|kill-line|enterprise-ai|five-dynasties)/i;

const DISALLOWED_GENERATED_NAME_PATTERNS = [
  /prompt-only/i,
  /boundary/i,
];

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function scoreRow(row: CsvRow): number {
  const fullPath = row.full_path.toLowerCase();
  const name = row.name.toLowerCase();
  let score = 0;

  if (row.type === 'video') score += 80;
  if (fullPath.includes('\\public\\generated\\') || fullPath.includes('/public/generated/')) score += 60;
  if (/rainline|liming|zhibing|kill-line|vimax|five-dynasties|enterprise-ai/.test(name)) score += 90;
  if (fullPath.includes('sceneweave') || name.includes('sceneweave')) score += 50;
  if (fullPath.includes('huiying') || name.includes('huiying')) score += 35;
  if (fullPath.includes('seedance') || name.includes('seedance')) score += 25;
  if (fullPath.includes('outputs')) score += 15;
  return score;
}

function isLowQualityRow(row: CsvRow): boolean {
  const fullPath = row.full_path.toLowerCase();
  const normalizedPath = fullPath.replace(/\\/g, '/');
  const name = row.name.toLowerCase();
  const sizeMb = Number(row.size_mb) || 0;

  if (row.type === 'image' && sizeMb < 0.18) return true;
  if (row.type === 'video' && sizeMb < 0.4) return true;
  if (LOW_QUALITY_NAME_PATTERNS.some(pattern => pattern.test(name))) return true;
  if (LOW_QUALITY_PATH_TOKENS.some(token => normalizedPath.includes(token))) return true;
  if (DISALLOWED_GENERATED_NAME_PATTERNS.some(pattern => pattern.test(name))) return true;
  return false;
}

function isCuratedSceneWeaveSource(row: CsvRow): boolean {
  const normalizedPath = row.full_path.toLowerCase().replace(/\\/g, '/');
  const name = row.name.toLowerCase();

  if (CURATED_SOURCE_TOKENS.some(token => normalizedPath.includes(token))) return true;

  return (
    GENERATED_PRODUCT_NAME_PATTERN.test(name) &&
    (normalizedPath.includes('/public/generated/') || normalizedPath.includes('/generated/videos/'))
  );
}

function collectMediaRows(text: string, limit: number): CsvRow[] {
  const [headerLine, ...body] = text.split(/\r?\n/);
  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine);
  const videoLimit = Math.max(1, Math.ceil(limit * 0.65));
  const imageLimit = Math.max(1, limit - videoLimit);
  const candidateLimit = Math.max(limit * 3, 60);
  let videoCandidates: Array<{ row: CsvRow; score: number }> = [];
  let imageCandidates: Array<{ row: CsvRow; score: number }> = [];

  const trimCandidates = (items: Array<{ row: CsvRow; score: number }>) =>
    items
      .sort((a, b) => {
        const scoreDelta = b.score - a.score;
        if (scoreDelta !== 0) return scoreDelta;
        return toTimestamp(b.row.last_write_time) - toTimestamp(a.row.last_write_time);
      })
      .slice(0, candidateLimit);

  for (const line of body) {
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

    if (
      !SUPPORTED_TYPES.has(row.type) ||
      row.generated_like !== 'yes' ||
      !isCuratedSceneWeaveSource(row) ||
      isLowQualityRow(row)
    ) {
      continue;
    }

    if (row.type === 'video') {
      videoCandidates.push({ row, score: scoreRow(row) });
      if (videoCandidates.length > candidateLimit * 2) videoCandidates = trimCandidates(videoCandidates);
    } else {
      imageCandidates.push({ row, score: scoreRow(row) });
      if (imageCandidates.length > candidateLimit * 2) imageCandidates = trimCandidates(imageCandidates);
    }
  }

  const videos = trimCandidates(videoCandidates).slice(0, videoLimit);
  const images = trimCandidates(imageCandidates).slice(0, imageLimit);
  return [...videos, ...images].slice(0, limit).map(candidate => candidate.row);
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rankMediaRows(rows: CsvRow[], limit: number): CsvRow[] {
  const videoLimit = Math.max(1, Math.ceil(limit * 0.65));
  const imageLimit = Math.max(1, limit - videoLimit);
  const seen = new Set<string>();
  const candidates = rows
    .filter(row => SUPPORTED_TYPES.has(row.type) && !isLowQualityRow(row) && isCuratedSceneWeaveSource(row))
    .filter(row => {
      const key = row.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(row => ({ row, score: scoreRow(row) }))
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      return toTimestamp(b.row.last_write_time) - toTimestamp(a.row.last_write_time);
    });

  const videos = candidates.filter(candidate => candidate.row.type === 'video').slice(0, videoLimit);
  const images = candidates.filter(candidate => candidate.row.type === 'image').slice(0, imageLimit);
  return [...videos, ...images].slice(0, limit).map(candidate => candidate.row);
}

async function collectFilesystemMediaRows(maxFiles = 240): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];

  async function walk(root: string, dir: string): Promise<void> {
    if (rows.length >= maxFiles) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (rows.length >= maxFiles) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(root, fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const type = SUPPORTED_EXTENSIONS.get(ext);
      if (!type) continue;

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      rows.push({
        full_path: fullPath,
        name: entry.name,
        type,
        generated_like: 'yes',
        size_mb: (stat.size / 1024 / 1024).toFixed(2),
        last_write_time: stat.mtime.toISOString(),
        curated_root: root,
      });
    }
  }

  for (const root of CURATED_FILESYSTEM_ROOTS) {
    await walk(root, root);
  }

  return rows;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 80), 1), 120);
  const basePath = url.pathname.startsWith('/huiying/') ? '/huiying' : (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

  let text = '';
  let indexAvailable = true;
  try {
    text = await fs.readFile(MEDIA_INDEX_PATH, 'utf8');
  } catch (error) {
    indexAvailable = false;
  }

  const csvRows = indexAvailable ? collectMediaRows(text, limit) : [];
  const filesystemRows = await collectFilesystemMediaRows();
  const rows = rankMediaRows([...csvRows, ...filesystemRows], limit);

  if (!indexAvailable && rows.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'media_index_missing',
        message: `历史素材索引不存在或不可读取：${MEDIA_INDEX_PATH}`,
      },
      { status: 404 },
    );
  }

  const assets = rows.map((row, index) => {
    const mediaUrl = `${basePath}/api/assets/media-file?path=${encodeURIComponent(row.full_path)}`;
    const posterUrl =
      row.type === 'video' && path.extname(row.full_path).toLowerCase() === '.mp4'
        ? `${basePath}/api/assets/video-poster?path=${encodeURIComponent(row.full_path)}`
        : undefined;
    return {
      id: `historical-${index}-${path.basename(row.full_path)}`,
      kind: row.type,
      title: row.name.replace(/\.[^.]+$/, ''),
      url: mediaUrl,
      poster: row.type === 'image' ? mediaUrl : posterUrl,
      createdAt: toTimestamp(row.last_write_time),
      sizeMb: Number(row.size_mb) || 0,
      originalPath: row.full_path,
      source: 'historical',
      curated: true,
    };
  });

  return NextResponse.json({
    success: true,
    indexPath: MEDIA_INDEX_PATH,
    indexAvailable,
    count: assets.length,
    assets,
  });
}
