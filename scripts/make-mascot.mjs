#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   make-mascot.mjs — render the in-game farmer mascot (the little
   character that walks around the farm) FACING FORWARD, as a big
   transparent PNG for use as an X / social profile picture.
   Zero dependencies: writes a real RGBA PNG using Node's zlib.

   The art is the exact same "facing down" sprite used on the game
   canvas (see F_DOWN in src/px.ts), with idle legs added, scaled up.

   USAGE
     npm run mascot                       # default: badge bg, scale 24
     npm run mascot -- --bg=none          # transparent, no badge
     npm run mascot -- --bg=round         # circular avatar badge
     npm run mascot -- --scale=32
     npm run mascot -- --out=public/mascot.png
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

const SCALE = Math.max(1, parseInt(args.scale ?? "24", 10));
const BG = String(args.bg ?? "round").toLowerCase(); // none | square | round
const OUT = resolve(process.cwd(), args.out ?? "public/mascot.png");

/* ── palette (matches FARMER_PAL in src/px.ts) ── */
const PAL = {
  K: "#2a1e14", S: "#f4cb9c", s: "#dca87a",
  H: "#f0c85c", h: "#c49a30",
  B: "#4a8fdc", b: "#2f6cb0",
  O: "#3a55a8", o: "#283d80",
  E: "#22160e", R: "#e05646",
  G: "#8a5a2e", g: "#5f3c1c", W: "#ffffff",
  D: "#283d80", // denim dark for legs
};

/* ── facing-DOWN farmer (14 wide) + idle legs, straw hat, blue shirt ── */
const ROWS = [
  "..............",
  "...hhhhhhhh...",
  "..hHHHHHHHHh..",
  ".hhHHHHHHHHhh.",
  "hhhhhhhhhhhhhh",
  "..KSSSSSSSSK..",
  "..KSSSSSSSSK..",
  "..KSEWSSWESK..",
  "..KSSSSSSSSK..",
  "...KSSssSSK...",
  "....KKKKKK....",
  "...RRRRRRRR...",
  "..bBBBBBBBBb..",
  ".sBBBOOOOBBBs.",
  ".SBBOOOOOOBBS.",
  ".SBBOOOOOOBBS.",
  ".sKOOOOOOOOKs.",
  "..OOOOOOOOOO..",
  "..OOOOOOOOOO..",
  "...OO....OO...",  // idle legs (denim)
  "...OO....OO...",
  "...GG....GG...",  // boots
];

const AW = 14, AH = ROWS.length;      // art grid of the sprite itself
// Build a SQUARE canvas so a round badge is a true circle (good for avatars).
const SIDE = Math.max(AW, AH) + 8;    // square side with breathing room
const W = SIDE, H = SIDE;
const OX = Math.floor((W - AW) / 2);  // horizontal offset to centre the sprite
const OY = Math.floor((H - AH) / 2);  // vertical offset to centre the sprite

/* ── RGBA framebuffer ── */
const buf = new Uint8Array(W * H * 4);
function put(x, y, hex, a = 255) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const i = (y * W + x) * 4;
  if (a >= 255) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; return; }
  const sa = a / 255, da = buf[i + 3] / 255, oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  buf[i]     = Math.round((c[0] * sa + buf[i]     * da * (1 - sa)) / oa);
  buf[i + 1] = Math.round((c[1] * sa + buf[i + 1] * da * (1 - sa)) / oa);
  buf[i + 2] = Math.round((c[2] * sa + buf[i + 2] * da * (1 - sa)) / oa);
  buf[i + 3] = Math.round(oa * 255);
}

/* ── optional badge background ── */
const CX = W / 2, CY = H / 2;
function inRound(x, y) {
  const rx = W / 2 - 0.5, ry = H / 2 - 0.5;
  const dx = (x + 0.5 - CX) / rx, dy = (y + 0.5 - CY) / ry;
  return dx * dx + dy * dy <= 1;
}
function inSquare(x, y) {
  const r = 5;
  const nx = x < r ? r - x : x >= W - r ? x - (W - 1 - r) : 0;
  const ny = y < r ? r - y : y >= H - r ? y - (H - 1 - r) : 0;
  return nx * nx + ny * ny <= r * r;
}
if (BG === "round" || BG === "square") {
  const test = BG === "round" ? inRound : inSquare;
  const bg1 = [0x1c, 0x3a, 0x18], bg2 = [0x0a, 0x14, 0x0a];
  const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!test(x, y)) continue;
      // vertical gradient (sky-ish green) + tiny vignette
      const t = y / H;
      const c = [
        Math.round(bg1[0] + (bg2[0] - bg1[0]) * t),
        Math.round(bg1[1] + (bg2[1] - bg1[1]) * t),
        Math.round(bg1[2] + (bg2[2] - bg1[2]) * t),
      ];
      put(x, y, toHex(c));
      // bright green rim
      const edge = !test(x - 1, y) || !test(x + 1, y) || !test(x, y - 1) || !test(x, y + 1);
      if (edge) put(x, y, "#8dff6a", 170);
    }
  // a little ground shadow under the mascot's feet
  for (let x = -4; x <= 4; x++) put(CX + x, OY + AH, "#000000", 60);
}

/* ── paint the sprite centred on the square canvas ── */
for (let y = 0; y < AH; y++) {
  const row = ROWS[y];
  for (let x = 0; x < row.length; x++) {
    const ch = row[x];
    const hex = PAL[ch];
    if (!hex) continue;
    put(OX + x, OY + y, hex);
  }
}

/* ═══════════ ENCODE RGBA PNG (zero deps) ═══════════ */
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
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
  raw[o++] = 0;
  const sy = (y / SCALE) | 0;
  for (let x = 0; x < OW; x++) {
    const sx = (x / SCALE) | 0;
    const i = (sy * W + sx) * 4;
    raw[o++] = buf[i]; raw[o++] = buf[i + 1]; raw[o++] = buf[i + 2]; raw[o++] = buf[i + 3];
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`✓ ${OUT}`);
console.log(`  bg=${BG}  art=${W}x${H}  file=${OW}x${OH}  ${(png.length / 1024).toFixed(1)} KB`);
