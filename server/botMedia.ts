// Médias des bots de test : un petit dessin PNG (Téléphone cassé) et une
// « imitation » sonore WAV (Mimic). Générés à la volée, sans dépendance.

import { deflateSync } from "node:zlib";
import type { BotMedia } from "@subtitles-party/shared";

// --- PNG ----------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const COLORS: [number, number, number][] = [[27, 27, 31], [230, 57, 70], [42, 157, 143], [69, 123, 157], [244, 162, 97], [142, 68, 173]];

/** Gribouillis 320×240 sur fond blanc (quelques traits et cercles). */
export function botDrawingPng(rng: () => number): string {
  const W = 320;
  const H = 240;
  const px = new Uint8Array(W * H * 3).fill(255);
  const dot = (x: number, y: number, r: number, c: [number, number, number]) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const X = Math.round(x + dx);
        const Y = Math.round(y + dy);
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const i = (Y * W + X) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
    }
  };
  const shapes = 4 + Math.floor(rng() * 4);
  for (let s = 0; s < shapes; s++) {
    const c = COLORS[Math.floor(rng() * COLORS.length)];
    const r = 2 + Math.floor(rng() * 3);
    const cx = 40 + rng() * (W - 80);
    const cy = 40 + rng() * (H - 80);
    const size = 15 + rng() * 55;
    if (rng() < 0.45) {
      for (let a = 0; a < Math.PI * 2; a += 0.04) dot(cx + Math.cos(a) * size, cy + Math.sin(a) * size * 0.8, r, c);
    } else {
      const a = rng() * Math.PI;
      for (let t = -1; t <= 1; t += 0.01) dot(cx + Math.cos(a) * size * t, cy + Math.sin(a) * size * t + Math.sin(t * 9) * 6, r, c);
    }
  }
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0; // filtre « none »
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

// --- WAV ----------------------------------------------------------------------

/** 1 à 2,5 s de « bip-bop » (glissandos + petites pauses), 8 kHz mono 8 bits. */
export function botVoiceWav(rng: () => number): string {
  const rate = 8000;
  const dur = 1 + rng() * 1.5;
  const n = Math.floor(rate * dur);
  const data = Buffer.alloc(n);
  const notes = 2 + Math.floor(rng() * 4);
  const freqs = Array.from({ length: notes }, () => 200 + rng() * 500);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const note = Math.min(notes - 1, Math.floor(t * notes));
    const local = t * notes - note;
    const freq = freqs[note] * (1 + 0.4 * Math.sin(local * Math.PI));
    phase += (2 * Math.PI * freq) / rate;
    const env = local < 0.85 ? Math.sin(Math.min(1, local / 0.85) * Math.PI) : 0;
    data[i] = 128 + Math.round(Math.sin(phase) * 90 * env);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(36 + n, 4);
  head.write("WAVE", 8, "ascii");
  head.write("fmt ", 12, "ascii");
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate, 28);
  head.writeUInt16LE(1, 32);
  head.writeUInt16LE(8, 34);
  head.write("data", 36, "ascii");
  head.writeUInt32LE(n, 40);
  return `data:audio/wav;base64,${Buffer.concat([head, data]).toString("base64")}`;
}

export const botMedia: BotMedia = { drawing: botDrawingPng, voice: botVoiceWav };
