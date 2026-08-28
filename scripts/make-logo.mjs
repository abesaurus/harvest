#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   make-logo.mjs — render a crisp pixel-art crop sprite (pumpkin or
   strawberry) as a transparent PNG, for use as the Ponsfarm logo /
   favicon / social avatar. Zero dependencies: writes a real RGBA
   PNG using only Node's built-in zlib. The art matches the crops
   drawn on the in-game canvas, scaled up cleanly.

   USAGE
     npm run logo                          # default: pumpkin, scale 16
     npm run logo -- --crop=strawberry
     npm run logo -- --scale=24            # bigger export
     npm run logo -- --bg=disc             # add a dark rounded badge
     npm run logo -- --out=public/logo.png
   ═══════════════════════════════════════════════════════════════ */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);

const CROP = String(args.crop ?? "pumpkin").toLowerCase();
const SCALE = Math.max(1, parseInt(args.scale ?? "16", 10));
const BG = String(args.bg ?? "none").toLowerCase(); // none | disc
const W = 24, H = 24;                                 // art grid
const OUT = resolve(process.cwd(), args.out ?? `public/logo-${CROP}.png`);

/* ── RGBA framebuffer ── */
const buf = new Uint8Array(W * H * 4); // all transparent

function px(x, y, c, a = 255) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  if (a >= 255) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; return; }
  // alpha-over onto existing
  const sa = a / 255, da = buf[i + 3] / 255, oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  buf[i]     = Math.round((c[0] * sa + buf[i]     * da * (1 - sa)) / oa);
  buf[i + 1] = Math.round((c[1] * sa + buf[i + 1] * da * (1 - sa)) / oa);
  buf[i + 2] = Math.round((c[2] * sa + buf[i + 2] * da * (1 - sa)) / oa);
  buf[i + 3] = Math.round(oa * 255);
}
function rect(x, y, w, h, c, a = 255) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, a);
}
function discFill(cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(cx + x, cy + y, c);
}

/* ── optional dark rounded badge behind the sprite ── */
if (BG === "disc") {
  const bg1 = [0x1c, 0x2a, 0x1a], bg2 = [0x07, 0x0b, 0x07], ring = [0x8d, 0xff, 0x6a];
  const r = 4; // corner radius
  const inCard = (x, y) => {
    // rounded-square mask
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const nx = x < r ? r - x : x >= W - r ? x - (W - 1 - r) : 0;
    const ny = y < r ? r - y : y >= H - r ? y - (H - 1 - r) : 0;
    return nx * nx + ny * ny <= r * r;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inCard(x, y)) continue;
      const t = (x + y) / (W + H);
      const c = [
        Math.round(bg1[0] + (bg2[0] - bg1[0]) * t),
        Math.round(bg1[1] + (bg2[1] - bg1[1]) * t),
        Math.round(bg1[2] + (bg2[2] - bg1[2]) * t),
      ];
      px(x, y, c);
      // green rim: draw where a neighbour is outside the card
      const edge = !inCard(x - 1, y) || !inCard(x + 1, y) || !inCard(x, y - 1) || !inCard(x, y + 1);
      if (edge) px(x, y, ring, 150);
    }
}

/* ═══════════ CROP SPRITES (scaled-up, canvas-matched) ═══════════ */

function drawPumpkin() {
  const F  = [0xe8, 0x80, 0x2a]; // fruit
  const FH = [0xff, 0xab, 0x5c]; // highlight
  const FD = [0xd2, 0x6a, 0x14]; // dark rib
  const S  = [0x6f, 0x48, 0x26]; // stalk
  const L  = [0x63, 0xb8, 0x4a]; // leaf
  const LD = [0x3f, 0x8f, 0x36]; // leaf dark

  const cx = 12, cy = 14;
  // three overlapping lobes for a classic ribbed pumpkin
  discFill(cx,     cy, 9, 8, F);   // centre lobe (widest)
  discFill(cx - 5, cy, 5, 7, F);   // left lobe
  discFill(cx + 5, cy, 5, 7, F);   // right lobe
  // ribs — darker seams between the lobes
  for (let y = -7; y <= 7; y++) {
    const yy = cy + y;
    if ((y * y) / (8 * 8) <= 1) {
      px(cx - 3, yy, FD); px(cx + 3, yy, FD);
      px(cx - 8, yy, FD, 160); px(cx + 8, yy, FD, 160);
    }
  }
  // top-left glossy highlight (small, tidy)
  px(cx - 4, cy - 3, FH); px(cx - 3, cy - 3, FH);
  px(cx - 4, cy - 2, FH, 200);
  // bottom shading for volume
  for (let x = -8; x <= 8; x++) px(cx + x, cy + 7, FD, 120);
  // stalk
  rect(cx - 1, cy - 11, 3, 4, S);
  px(cx + 1, cy - 12, S);
  // curled leaf + vine to the upper-right, connected to the stalk
  px(cx + 2, cy - 10, LD);
  discFill(cx + 5, cy - 9, 3, 2, L);
  px(cx + 8, cy - 10, LD); px(cx + 6, cy - 11, L); px(cx + 4, cy - 8, LD);
}

function drawStrawberry() {
  const F  = [0xe8, 0x35, 0x4f]; // berry
  const FH = [0xff, 0x70, 0x88]; // highlight
  const FD = [0xb5, 0x1f, 0x3a]; // dark
  const SD = [0xff, 0xf3, 0xc4]; // seed
  const L  = [0x63, 0xb8, 0x4a]; // calyx leaf
  const LD = [0x3f, 0x8f, 0x36];

  const cx = 12, cy = 9;
  // heart / cone berry body: wide top with a subtle centre dip, tapering to a point
  for (let y = 0; y <= 12; y++) {
    const t = y / 12;
    const half = Math.round((1 - t) * 9 + 1); // narrows toward the tip
    for (let x = -half; x <= half; x++) {
      // shallow single-pixel notch at the very top centre (fill the shoulders)
      if (y === 0 && x === 0) continue;
      px(cx + x, cy + y, F);
    }
  }
  // shading + highlight
  for (let y = 0; y <= 12; y++) {
    const t = y / 12; const half = Math.round((1 - t) * 9 + 1);
    px(cx + half, cy + y, FD); px(cx + half - 1, cy + y, FD, 120);
  }
  discFill(cx - 3, cy + 3, 2, 3, FH);
  px(cx - 4, cy + 2, FH, 200);
  // seeds — neat diagonal rows
  for (let y = 2; y <= 11; y += 2) {
    const t = y / 12; const half = Math.round((1 - t) * 9 + 1);
    const off = (y / 2) % 2 === 0 ? 0 : 2;
    for (let x = -half + 2 + off; x <= half - 2; x += 4) px(cx + x, cy + y, SD);
  }
  // green calyx / leaves on top
  discFill(cx, cy - 1, 8, 2, L);
  for (const dx of [-7, -3, 0, 3, 7]) { px(cx + dx, cy - 2, L); px(cx + dx, cy - 3, LD); }
  px(cx - 5, cy - 2, LD); px(cx + 5, cy - 2, LD);
  // little stem
  rect(cx - 1, cy - 6, 2, 4, LD);
  px(cx, cy - 7, L);
}

if (CROP === "strawberry") drawStrawberry();
else drawPumpkin();

/* ═══════════ ENCODE RGBA PNG (zero deps) ═══════════ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const OW = W * SCALE, OH = H * SCALE;
const raw = Buffer.alloc((OW * 4 + 1) * OH);
let o = 0;
for (let y = 0; y < OH; y++) {
  raw[o++] = 0; // filter: none
  const sy = (y / SCALE) | 0;
  for (let x = 0; x < OW; x++) {
    const sx = (x / SCALE) | 0;
    const i = (sy * W + sx) * 4;
    raw[o++] = buf[i]; raw[o++] = buf[i + 1]; raw[o++] = buf[i + 2]; raw[o++] = buf[i + 3];
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // colour type: truecolour + alpha
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`✓ ${OUT}`);
console.log(`  crop=${CROP}  bg=${BG}  art=${W}x${H}  file=${OW}x${OH}  ${(png.length / 1024).toFixed(1)} KB`);
