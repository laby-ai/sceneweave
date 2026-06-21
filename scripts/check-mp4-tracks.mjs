#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/check-mp4-tracks.mjs <local-mp4-path>');
  process.exit(2);
}

const input = process.argv[2];
if (!input) usage();

const filePath = path.resolve(input);
if (!fs.existsSync(filePath)) {
  console.error(JSON.stringify({ ok: false, error: 'file not found', source: filePath }, null, 2));
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);

function readBoxHeader(offset, end) {
  if (offset + 8 > end || offset + 8 > buffer.length) return null;
  let size = buffer.readUInt32BE(offset);
  const type = buffer.toString('ascii', offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > end || offset + 16 > buffer.length) return null;
    const wideSize = buffer.readBigUInt64BE(offset + 8);
    if (wideSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(wideSize);
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (size < headerSize || offset + size > end || offset + size > buffer.length) return null;
  return {
    type,
    start: offset,
    end: offset + size,
    dataStart: offset + headerSize,
  };
}

function childrenOf(start, end) {
  const boxes = [];
  let offset = start;
  while (offset < end) {
    const box = readBoxHeader(offset, end);
    if (!box) break;
    boxes.push(box);
    offset = box.end;
  }
  return boxes;
}

function findChildren(box, type) {
  return childrenOf(box.dataStart, box.end).filter(child => child.type === type);
}

function findChild(box, type) {
  return findChildren(box, type)[0] || null;
}

function handlerTypeFromTrak(trak) {
  const mdia = findChild(trak, 'mdia');
  if (!mdia) return null;
  const hdlr = findChild(mdia, 'hdlr');
  if (!hdlr || hdlr.dataStart + 12 > hdlr.end) return null;
  return buffer.toString('ascii', hdlr.dataStart + 8, hdlr.dataStart + 12);
}

const topBoxes = childrenOf(0, buffer.length);
const moov = topBoxes.find(box => box.type === 'moov');
if (!moov) {
  console.error(JSON.stringify({ ok: false, error: 'moov box missing', source: filePath }, null, 2));
  process.exit(1);
}

const tracks = findChildren(moov, 'trak')
  .map((trak, index) => ({
    index,
    handlerType: handlerTypeFromTrak(trak),
  }))
  .filter(track => track.handlerType);

const audioTracks = tracks.filter(track => track.handlerType === 'soun');
const videoTracks = tracks.filter(track => track.handlerType === 'vide');

const output = {
  ok: true,
  source: filePath,
  bytes: buffer.length,
  trackCount: tracks.length,
  videoTrackCount: videoTracks.length,
  audioTrackCount: audioTracks.length,
  hasVideo: videoTracks.length > 0,
  hasAudio: audioTracks.length > 0,
  tracks,
};

console.log(JSON.stringify(output, null, 2));
if (!output.hasVideo) process.exit(1);
