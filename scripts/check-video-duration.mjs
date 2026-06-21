#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const input = process.argv[2];

if (!input) {
  console.error('Usage: node scripts/check-video-duration.mjs <local-mp4-path-or-url>');
  process.exit(1);
}

async function readInput(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to download video: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return fs.readFile(path.resolve(source));
}

function findBox(buffer, type, start = 0, end = buffer.length) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const name = buffer.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) return null;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (!Number.isFinite(size) || size < headerSize || offset + size > end) {
      return null;
    }

    if (name === type) {
      return {
        offset,
        size,
        dataStart: offset + headerSize,
        dataEnd: offset + size,
      };
    }

    offset += size;
  }
  return null;
}

function parseDurationSeconds(buffer) {
  const moov = findBox(buffer, 'moov');
  if (!moov) {
    throw new Error('MP4 moov box not found');
  }
  const mvhd = findBox(buffer, 'mvhd', moov.dataStart, moov.dataEnd);
  if (!mvhd) {
    throw new Error('MP4 mvhd box not found');
  }

  const version = buffer.readUInt8(mvhd.dataStart);
  let timescale;
  let duration;

  if (version === 1) {
    timescale = buffer.readUInt32BE(mvhd.dataStart + 20);
    duration = Number(buffer.readBigUInt64BE(mvhd.dataStart + 24));
  } else {
    timescale = buffer.readUInt32BE(mvhd.dataStart + 12);
    duration = buffer.readUInt32BE(mvhd.dataStart + 16);
  }

  if (!timescale) {
    throw new Error('MP4 timescale is zero or missing');
  }

  return duration / timescale;
}

try {
  const buffer = await readInput(input);
  const seconds = parseDurationSeconds(buffer);
  console.log(JSON.stringify({
    ok: true,
    source: /^https?:\/\//i.test(input) ? input : path.resolve(input),
    bytes: buffer.length,
    durationSeconds: Number(seconds.toFixed(3)),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    source: input,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
