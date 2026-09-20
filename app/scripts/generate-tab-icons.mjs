#!/usr/bin/env node
// Generates simple template-style tab bar icons (emergency + account) as PNGs.
// “template” rendering tints only the opaque silhouette, so we draw solid black.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'images', 'tabIcons');

const SIZE = 24;
const SCALES = [1, 2, 3];

function crc32(buf) {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Coverage of a shape test at a given coordinate in a SIZE x SIZE space.
function coverage(px, py, inside) {
  const SAMPLES = 4;
  let hits = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const x = px + (sx + 0.5) / SAMPLES;
      const y = py + (sy + 0.5) / SAMPLES;
      if (inside(x, y)) hits++;
    }
  }
  return hits / (SAMPLES * SAMPLES);
}

function render(shape) {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const alpha = Math.round(coverage(x, y, shape) * 255);
      const offset = (y * SIZE + x) * 4;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = alpha;
    }
  }
  return pixels;
}

// Emergency: a bold medical cross.
function emergencyShape(x, y) {
  const v = x >= 8 && x < 16 && y >= 4 && y < 20;
  const h = y >= 8 && y < 16 && x >= 4 && x < 20;
  return v || h;
}

// Account: person silhouette (head circle + shoulders).
function accountShape(x, y) {
  const head = (x - 12) ** 2 + (y - 7.5) ** 2 <= 4.2 ** 2;
  const shoulders = y >= 15 && (x - 12) ** 2 / (9.5) ** 2 + (y - 17) ** 2 / (9) ** 2 <= 1;
  return head || shoulders;
}

const ICONS = {
  emergency: emergencyShape,
  account: accountShape,
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, shape] of Object.entries(ICONS)) {
  for (const scale of SCALES) {
    const size = SIZE * scale;
    const rgba = Buffer.alloc(size * size * 4);
    const base = render(shape);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const srcX = Math.min(SIZE - 1, Math.floor(x / scale));
        const srcY = Math.min(SIZE - 1, Math.floor(y / scale));
        const srcOff = (srcY * SIZE + srcX) * 4;
        const dstOff = (y * size + x) * 4;
        rgba[dstOff] = base[srcOff];
        rgba[dstOff + 1] = base[srcOff + 1];
        rgba[dstOff + 2] = base[srcOff + 2];
        rgba[dstOff + 3] = base[srcOff + 3];
      }
    }
    const suffix = scale === 1 ? '' : `@${scale}x`;
    writeFileSync(join(OUT_DIR, `${name}${suffix}.png`), encodePng(size, size, rgba));
    console.log(`wrote ${name}${suffix}.png (${size}x${size})`);
  }
}