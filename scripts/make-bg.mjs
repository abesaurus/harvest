#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   make-bg.mjs — generate the pixel-art background for the landing
   page (index "/"). Zero dependencies: writes a real PNG using
   only Node's built-in zlib.

   USAGE
     npm run bg                          # default: day, seed 7
     npm run bg -- --time=dusk           # day | dusk | night | dawn
     npm run bg -- --seed=42             # change the world layout
     npm run bg -- --w=320 --h=180       # art resolution (upscaled by CSS)
     npm run bg -- --scale=4             # bake an integer upscale into the file
     npm run bg -- --out=public/bg.png   # output path
     npm run bg -- --list               # show presets and exit

   The image is drawn at low resolution (1 art pixel = 1 real pixel)
   so it stays crisp pixel art when CSS scales it up with
   `image-rendering: pixelated`.
   ═══════════════════════════════════════════════════════════════ */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/* ───────── args ───────── */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);

const PRESETS = {
  dawn: {
    skyTop: [0x3f, 0x4b, 0x7a], skyMid: [0xd9, 0x84, 0x7a], skyBot: [0xff, 0xc9, 0x8e],
    sun: [0xff, 0xe4, 0xa8], sunGlow: [0xff, 0xb5, 0x6b], light: [0xff, 0xd0, 0xa0], amb: 0.82,
    stars: 0.25, sunY: 0.62, sunX: 0.74,
  },
  day: {
    skyTop: [0x4f, 0xa8, 0xd8], skyMid: [0x8c, 0xd2, 0xea], skyBot: [0xd6, 0xf0, 0xe2],
    sun: [0xff, 0xf6, 0xc9], sunGlow: [0xff, 0xd9, 0x4a], light: [0xff, 0xff, 0xff], amb: 1.0,
    stars: 0, sunY: 0.16, sunX: 0.80,
  },
  dusk: {
    skyTop: [0x2c, 0x2f, 0x63], skyMid: [0x8c, 0x4d, 0x82], skyBot: [0xf2, 0x9d, 0x63],
    sun: [0xff, 0xd0, 0x86], sunGlow: [0xff, 0x8c, 0x4a], light: [0xff, 0xc2, 0x92], amb: 0.72,
    stars: 0.4, sunY: 0.66, sunX: 0.22,
  },
  night: {
    skyTop: [0x0d, 0x14, 0x33], skyMid: [0x1b, 0x27, 0x52], skyBot: [0x33, 0x44, 0x6b],
    sun: [0xe8, 0xf0, 0xff], sunGlow: [0x9c, 0xb8, 0xf0], light: [0x8c, 0xa8, 0xe0], amb: 0.46,
    stars: 1.0, sunY: 0.18, sunX: 0.24,
  },
};

if (args.list) {
  console.log("presets:", Object.keys(PRESETS).join(", "));
  console.log("flags:   --time --seed --w --h --scale --out");
  process.exit(0);
}

const TIME = String(args.time ?? "day").toLowerCase();
const P = PRESETS[TIME] ?? PRESETS.day;
const W = Math.max(120, parseInt(args.w ?? "384", 10));
const H = Math.max(80, parseInt(args.h ?? "216", 10));
const SCALE = Math.max(1, parseInt(args.scale ?? "1", 10));
const SEED0 = parseInt(args.seed ?? "7", 10);
const OUT = resolve(process.cwd(), args.out ?? "public/bg.png");

/* ───────── deterministic rng ───────── */

let _s = (SEED0 * 2654435761) % 2147483647 || 12345;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const ri = (n) => Math.floor(rnd() * n);

/* ───────── framebuffer (RGB) ───────── */

const buf = new Uint8Array(W * H * 3);

function px(x, y, c, a = 1) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  if (a >= 1) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; return; }
  buf[i] += (c[0] - buf[i]) * a;
  buf[i + 1] += (c[1] - buf[i + 1]) * a;
  buf[i + 2] += (c[2] - buf[i + 2]) * a;
}
function rect(x, y, w, h, c, a = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, a);
}
function disc(cx, cy, r, c, a = 1) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let dx = -w; dx <= w; dx++) px(cx + dx, cy + dy, c, a);
  }
}
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
/** tint a colour by the scene's ambient light */
const lit = (c) => {
  const k = P.amb;
  const L = P.light;
  return [
    Math.min(255, Math.round(c[0] * k * (L[0] / 255) + c[0] * (1 - k) * 0.35)),
    Math.min(255, Math.round(c[1] * k * (L[1] / 255) + c[1] * (1 - k) * 0.35)),
    Math.min(255, Math.round(c[2] * k * (L[2] / 255) + c[2] * (1 - k) * 0.35)),
  ];
};

/* ───────── palette ───────── */

const C = {
  grass1: lit([0x5f, 0xa8, 0x45]), grass2: lit([0x69, 0xb4, 0x4c]), grass3: lit([0x4c, 0x8f, 0x38]),
  grassFar: lit([0x74, 0xb8, 0x5a]), grassFar2: lit([0x63, 0xab, 0x4b]),
  soil: lit([0x7b, 0x52, 0x30]), soil2: lit([0x8c, 0x5f, 0x38]), soilDark: lit([0x5a, 0x3a, 0x20]),
  wood: lit([0xa9, 0x71, 0x3c]), woodD: lit([0x6f, 0x48, 0x26]),
  roof: lit([0xc1, 0x50, 0x3f]), roofD: lit([0x9b, 0x3c, 0x2d]),
  wall: lit([0xe8, 0xd3, 0xa8]), wallD: lit([0xcd, 0xb4, 0x89]),
  leaf: lit([0x3f, 0x8f, 0x36]), leafD: lit([0x2f, 0x6f, 0x28]), leafL: lit([0x55, 0xad, 0x46]),
  trunk: lit([0x7a, 0x4f, 0x2a]), trunkD: lit([0x5b, 0x3a, 0x1e]),
  stone: lit([0x9a, 0xa0, 0xa8]), stoneD: lit([0x76, 0x7c, 0x85]),
  hill1: lit([0x6a, 0xa8, 0x72]), hill2: lit([0x53, 0x8f, 0x5e]), hill3: lit([0x41, 0x74, 0x4c]),
  mount: lit([0x7a, 0x86, 0x9c]), mountSnow: lit([0xe8, 0xf0, 0xf8]),
  water: lit([0x4a, 0xa3, 0xd8]),
  glowWin: [0xff, 0xd7, 0x6a],
  cream: lit([0xff, 0xf3, 0xd6]),
};

/* ═══════════════════════════════════════════════════════════════
   1. SKY — vertical gradient + stars + sun/moon + clouds
   ═══════════════════════════════════════════════════════════════ */

const HORIZON = Math.round(H * 0.56);

for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  const c = t < 0.5
    ? mix(P.skyTop, P.skyMid, t / 0.5)
    : mix(P.skyMid, P.skyBot, (t - 0.5) / 0.5);
  // 2-step dithered banding for a retro look
  for (let x = 0; x < W; x++) {
    const dither = ((x + y) % 2) === 0 ? 3 : -3;
    px(x, y, [c[0] + dither, c[1] + dither, c[2] + dither]);
  }
}

if (P.stars > 0) {
  const n = Math.round(P.stars * (W * H) / 900);
  for (let i = 0; i < n; i++) {
    const x = ri(W), y = ri(Math.round(HORIZON * 0.8));
    const b = 0.35 + rnd() * 0.65;
    px(x, y, [255, 255, 240], b * P.stars);
    if (rnd() < 0.12) {
      px(x + 1, y, [255, 255, 240], b * 0.4 * P.stars);
      px(x, y + 1, [255, 255, 240], b * 0.4 * P.stars);
    }
  }
}

// sun / moon with layered glow
{
  const sx = Math.round(W * P.sunX), sy = Math.round(HORIZON * P.sunY);
  const r = Math.max(6, Math.round(W / 34));
  for (let g = 5; g >= 1; g--) disc(sx, sy, r + g * 3, P.sunGlow, 0.055 * g);
  disc(sx, sy, r, P.sun);
  if (TIME === "night") {
    // crescent bite
    disc(sx + Math.round(r * 0.55), sy - Math.round(r * 0.25), Math.round(r * 0.85), mix(P.skyTop, P.skyMid, 0.4));
  }
}

// pixel clouds (rounded blobs, flat-bottomed)
function cloud(cx, cy, w, alpha) {
  const body = TIME === "night" ? [0x6b, 0x78, 0xa0] : TIME === "day" ? [0xff, 0xff, 0xff] : [0xff, 0xd8, 0xc0];
  const shade = mix(body, [0x8c, 0x9c, 0xb8], 0.35);
  const lumps = 3 + ri(3);
  for (let i = 0; i < lumps; i++) {
    const lx = cx + Math.round((i - lumps / 2) * (w / lumps));
    const lr = Math.round((w / lumps) * (0.6 + rnd() * 0.5));
    disc(lx, cy, lr, body, alpha);
    disc(lx, cy + Math.round(lr * 0.45), lr, shade, alpha * 0.5);
  }
  rect(cx - Math.round(w / 2), cy + Math.round(w / 8), w, 2, shade, alpha * 0.6);
}
for (let i = 0; i < 5; i++) {
  cloud(ri(W), 8 + ri(Math.round(HORIZON * 0.5)), 22 + ri(40), 0.55 + rnd() * 0.4);
}

// flock of birds
{
  const bx = Math.round(W * 0.18), by = Math.round(HORIZON * 0.3);
  const ink = TIME === "night" ? [0x30, 0x3a, 0x5a] : [0x3a, 0x2e, 0x22];
  for (let i = 0; i < 5; i++) {
    const x = bx + i * 9 + ri(4), y = by + (i % 3) * 5;
    px(x, y, ink); px(x + 1, y - 1, ink); px(x + 2, y, ink);
    px(x - 1, y - 1, ink); px(x + 3, y - 1, ink);
  }
}

/* ═══════════════════════════════════════════════════════════════
   2. DISTANT LAYERS — mountains → hills → treeline
   ═══════════════════════════════════════════════════════════════ */

// mountains
{
  const base = HORIZON + 2;
  let x = -10;
  while (x < W + 10) {
    const w = 34 + ri(40);
    const h = 18 + ri(26);
    for (let i = 0; i < w; i++) {
      const t = i / w;
      const col = Math.round(h * (1 - Math.abs(t - 0.5) * 2));
      for (let j = 0; j < col; j++) px(x + i, base - j, C.mount);
      // snow cap
      if (col > h * 0.72) for (let j = col; j > col - 3; j--) px(x + i, base - j, C.mountSnow, 0.9);
    }
    x += w - 12;
  }
}

// rolling hill bands
function hillBand(baseY, amp, period, colour, phase) {
  for (let x = 0; x < W; x++) {
    const y = baseY - Math.round(
      Math.sin((x / period) * Math.PI * 2 + phase) * amp +
      Math.sin((x / (period * 0.37)) * Math.PI * 2 + phase * 1.7) * (amp * 0.35)
    );
    for (let j = y; j < H; j++) px(x, j, colour);
    // rim light along the crest
    px(x, y, mix(colour, C.cream, 0.22));
  }
}
hillBand(HORIZON + 10, 7, 90, C.hill3, 0.4);
hillBand(HORIZON + 20, 6, 64, C.hill2, 2.1);
hillBand(HORIZON + 30, 5, 48, C.hill1, 4.3);

// distant treeline silhouettes on the hills
for (let i = 0; i < Math.round(W / 9); i++) {
  const x = ri(W), y = HORIZON + 14 + ri(10);
  const h = 4 + ri(5);
  for (let j = 0; j < h; j++) {
    const w = Math.max(1, Math.round((h - j) * 0.8));
    rect(x - w, y - j, w * 2 + 1, 1, C.leafD, 0.85);
  }
  px(x, y + 1, C.trunkD, 0.8);
}

/* ═══════════════════════════════════════════════════════════════
   3. FOREGROUND FARM — grass, tilled field, fence, buildings, props
   ═══════════════════════════════════════════════════════════════ */

const GROUND = HORIZON + 34;

// grass with checker + tufts
for (let y = GROUND; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const depth = (y - GROUND) / Math.max(1, H - GROUND);
    const base = ((x >> 3) + (y >> 3)) % 2 ? C.grass1 : C.grass2;
    px(x, y, mix(C.grassFar, base, Math.min(1, 0.35 + depth * 1.1)));
  }
}
for (let i = 0; i < (W * (H - GROUND)) / 26; i++) {
  const x = ri(W), y = GROUND + ri(H - GROUND);
  px(x, y, C.grass3); px(x, y - 1, C.grass3, 0.7);
}

/* ── tilled field with crop rows (right side) ── */
{
  const fx = Math.round(W * 0.44), fy = GROUND + 6;
  const fw = Math.round(W * 0.44), fh = H - fy - 4;
  for (let j = 0; j < fh; j++) {
    const persp = 1 + j / fh * 0.25;         // rows widen toward the viewer
    const rowH = Math.max(3, Math.round(4 * persp));
    const shade = (Math.floor(j / rowH) % 2) ? C.soil : C.soil2;
    for (let i = 0; i < fw; i++) {
      const x = fx - Math.round((j / fh) * 8) + i + Math.round((j / fh) * 4);
      px(x, fy + j, shade);
    }
  }
  // furrow shadow lines
  for (let j = 0; j < fh; j += 4) rect(fx - 8, fy + j, fw + 12, 1, C.soilDark, 0.45);

  // crops in rows
  const cropCols = [
    lit([0xe0, 0x48, 0x3c]), lit([0xff, 0xd2, 0x3d]),
    lit([0x8f, 0xd0, 0x54]), lit([0xe8, 0x35, 0x4f]),
  ];
  for (let j = 2; j < fh - 2; j += 5) {
    const cc = cropCols[(j / 5 | 0) % cropCols.length];
    for (let i = 4; i < fw - 4; i += 6) {
      const x = fx - Math.round((j / fh) * 8) + i, y = fy + j;
      const hh = 3 + ((i + j) % 3);
      rect(x, y - hh, 1, hh, C.leaf);
      px(x - 1, y - hh, C.leafL); px(x + 1, y - hh + 1, C.leafL);
      px(x, y - hh - 1, cc); px(x + 1, y - hh - 1, cc, 0.8);
    }
  }
}

/* ── wooden fence across the middle ── */
{
  const fy = GROUND + 2;
  for (let x = 2; x < W; x += 14) {
    rect(x, fy - 11, 2, 13, C.woodD);
    px(x + 2, fy - 11, C.wood, 0.6);
  }
  rect(0, fy - 9, W, 2, C.wood);
  rect(0, fy - 5, W, 2, C.woodD);
  rect(0, fy - 9, W, 1, mix(C.wood, C.cream, 0.25));
}

/* ── farmhouse (left) ── */
function house(x, y, w) {
  const wallH = Math.round(w * 0.42);
  rect(x, y - wallH, w, wallH, C.wallD);
  rect(x + 1, y - wallH + 1, w - 2, wallH - 1, C.wall);
  for (let i = 0; i < wallH; i += 3) rect(x + 1, y - wallH + i, w - 2, 1, C.wallD, 0.35);
  // gable roof
  const rh = Math.round(w * 0.34);
  for (let i = 0; i < rh; i++) {
    const inset = Math.round((i / rh) * (w / 2));
    rect(x + inset - 2, y - wallH - i, w - inset * 2 + 4, 1, i < 2 ? C.roofD : C.roof);
  }
  // door + windows
  const dw = Math.max(4, Math.round(w * 0.16));
  rect(x + Math.round(w / 2 - dw / 2), y - Math.round(wallH * 0.62), dw, Math.round(wallH * 0.62), C.woodD);
  const lightWin = P.amb < 0.8;
  for (const wx of [Math.round(w * 0.16), Math.round(w * 0.68)]) {
    const s = Math.max(4, Math.round(w * 0.14));
    rect(x + wx, y - wallH + 3, s, s, C.woodD);
    rect(x + wx + 1, y - wallH + 4, s - 2, s - 2, lightWin ? C.glowWin : lit([0x8f, 0xd0, 0xef]));
    if (lightWin) disc(x + wx + (s >> 1), y - wallH + 3 + (s >> 1), s, C.glowWin, 0.07);
  }
  // chimney + smoke
  rect(x + Math.round(w * 0.72), y - wallH - rh - 6, 4, 8, C.stoneD);
  let sx2 = x + Math.round(w * 0.72) + 1, sy2 = y - wallH - rh - 8;
  for (let i = 0; i < 7; i++) {
    disc(sx2 + Math.round(Math.sin(i * 0.9) * 3), sy2 - i * 3, 1 + Math.round(i * 0.4),
      TIME === "night" ? [0x8c, 0x96, 0xb0] : [0xf0, 0xf0, 0xf0], 0.30 - i * 0.03);
  }
}
house(Math.round(W * 0.06), H - 6, Math.round(W * 0.2));

/* ── red barn (mid-left) ── */
function barn(x, y, w) {
  const wallH = Math.round(w * 0.46);
  rect(x, y - wallH, w, wallH, C.roofD);
  rect(x + 1, y - wallH + 1, w - 2, wallH - 1, C.roof);
  rect(x + 1, y - wallH + 1, w - 2, 1, C.cream);
  rect(x + 2, y - wallH, 2, wallH, C.cream, 0.9);
  rect(x + w - 4, y - wallH, 2, wallH, C.cream, 0.9);
  // gambrel roof (two slopes)
  const rh = Math.round(w * 0.3);
  for (let i = 0; i < rh; i++) {
    const t = i / rh;
    const inset = Math.round((t < 0.5 ? t * 0.7 : 0.35 + (t - 0.5) * 1.3) * w);
    rect(x + inset - 2, y - wallH - i, w - inset * 2 + 4, 1, i < 2 ? C.trunkD : C.trunk);
  }
  // big doors
  const dw = Math.round(w * 0.34);
  const dx = x + Math.round(w / 2 - dw / 2);
  rect(dx, y - Math.round(wallH * 0.66), dw, Math.round(wallH * 0.66), C.woodD);
  rect(dx + 1, y - Math.round(wallH * 0.66) + 1, dw - 2, Math.round(wallH * 0.66) - 1, C.wood);
  for (let i = 0; i < dw; i += 2) px(dx + i, y - Math.round(wallH * 0.66) + i, C.cream, 0.8);
  rect(dx + (dw >> 1), y - Math.round(wallH * 0.66), 1, Math.round(wallH * 0.66), C.woodD);
  // hayloft window
  rect(x + Math.round(w / 2) - 3, y - wallH - Math.round(rh * 0.55), 6, 5, C.woodD);
  rect(x + Math.round(w / 2) - 2, y - wallH - Math.round(rh * 0.55) + 1, 4, 3, P.amb < 0.8 ? C.glowWin : C.trunkD);
}
barn(Math.round(W * 0.28), H - 8, Math.round(W * 0.16));

/* ── silo next to the barn ── */
{
  const x = Math.round(W * 0.4), y = H - 8, w = Math.round(W * 0.045), h = Math.round(H * 0.22);
  rect(x, y - h, w, h, C.stoneD);
  rect(x + 1, y - h, Math.max(1, w - 3), h, C.stone);
  for (let i = 0; i < h; i += 4) rect(x, y - h + i, w, 1, C.stoneD, 0.5);
  for (let i = 0; i < w; i++) {
    const cap = Math.round((1 - Math.abs(i / w - 0.5) * 2) * (w * 0.7));
    for (let j = 0; j < cap; j++) px(x + i, y - h - j, C.trunk);
  }
}

/* ── windmill on the right horizon ── */
{
  const x = Math.round(W * 0.9), y = GROUND + 4;
  const h = Math.round(H * 0.2);
  for (let j = 0; j < h; j++) {
    const w = Math.round(3 + (j / h) * 5);
    rect(x - (w >> 1), y - j, w, 1, j % 4 === 0 ? C.wallD : C.wall);
  }
  const cx = x, cy = y - h;
  rect(cx - 4, cy - 4, 8, 6, C.roofD);
  // 4 sails
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    for (let i = 2; i < 13; i++) {
      px(cx + dx * i, cy + dy * i, C.woodD);
      px(cx + dx * i - dy, cy + dy * i - dx, C.cream, 0.85);
      px(cx + dx * i + dy * 2, cy + dy * i + dx * 2, C.cream, 0.5);
    }
  }
}

/* ── trees along the field edge ── */
function tree(x, y, s) {
  const th = Math.round(6 * s);
  rect(x - 1, y - th, 3, th, C.trunkD);
  px(x, y - th, C.trunk);
  const r = Math.round(5 * s);
  disc(x, y - th - r + 2, r, C.leafD);
  disc(x - 1, y - th - r, r - 1, C.leaf);
  disc(x - 2, y - th - r - 1, Math.max(1, r - 3), C.leafL);
  // a few fruit dots
  for (let i = 0; i < 3; i++) px(x - 3 + ri(7), y - th - r + ri(5), lit([0xe0, 0x48, 0x3c]), 0.9);
}
tree(Math.round(W * 0.5), GROUND + 8, 1.5);
tree(Math.round(W * 0.62), GROUND + 4, 1.1);
tree(Math.round(W * 0.03), GROUND + 12, 1.8);

/* ── haystacks, bushes, flowers, scarecrow ── */
function haystack(x, y, s) {
  const c = lit([0xe0, 0xb8, 0x54]), d = lit([0xba, 0x92, 0x36]);
  for (let j = 0; j < 6 * s; j++) {
    const w = Math.round((6 * s - j) * 1.6 + 3);
    rect(x - (w >> 1), y - j, w, 1, j % 2 ? c : d);
  }
}
haystack(Math.round(W * 0.2), H - 4, 1.2);
haystack(Math.round(W * 0.24), H - 3, 0.9);

for (let i = 0; i < 26; i++) {
  const x = ri(W), y = GROUND + 4 + ri(H - GROUND - 6);
  if (rnd() < 0.4) { disc(x, y - 2, 2, C.leafD); disc(x - 1, y - 3, 1, C.leaf); }
  else {
    const cols = [[0xf2, 0x7a, 0x9d], [0xff, 0xd9, 0x3d], [0xc9, 0x8c, 0xf0], [0xff, 0x8b, 0x5a]];
    px(x, y - 1, C.leafD); px(x, y - 2, C.leafD);
    px(x, y - 3, lit(cols[ri(cols.length)]));
  }
}

{ // scarecrow guarding the field
  const x = Math.round(W * 0.56), y = H - 12;
  rect(x, y - 16, 2, 16, C.woodD);
  rect(x - 5, y - 12, 12, 2, C.wood);
  rect(x - 3, y - 14, 8, 7, lit([0x4a, 0x8f, 0xdc]));
  rect(x - 2, y - 20, 6, 6, lit([0xe8, 0xc0, 0x60]));
  px(x - 1, y - 18, [0x2a, 0x1e, 0x14]); px(x + 2, y - 18, [0x2a, 0x1e, 0x14]);
  rect(x - 3, y - 21, 8, 2, lit([0xc4, 0x9a, 0x30]));
}

/* ── fireflies at night / dust motes by day ── */
{
  const n = P.amb < 0.8 ? 26 : 14;
  for (let i = 0; i < n; i++) {
    const x = ri(W), y = GROUND - 10 + ri(H - GROUND + 8);
    const c = P.amb < 0.8 ? [0xff, 0xf0, 0x8a] : [0xff, 0xff, 0xe0];
    px(x, y, c, 0.9);
    disc(x, y, 2, c, 0.12);
  }
}

/* ── bottom vignette so UI text on top stays readable ── */
for (let y = 0; y < H; y++) {
  const t = y / H;
  const v = t > 0.7 ? (t - 0.7) / 0.3 * 0.32 : 0;
  const topV = t < 0.18 ? (0.18 - t) / 0.18 * 0.18 : 0;
  for (let x = 0; x < W; x++) {
    if (v > 0) px(x, y, [0, 0, 0], v);
    if (topV > 0) px(x, y, [0, 0, 0], topV);
  }
}

/* ═══════════════════════════════════════════════════════════════
   4. ENCODE PNG (zero deps: zlib + manual CRC)
   ═══════════════════════════════════════════════════════════════ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// optional integer upscale baked into the file
const OW = W * SCALE, OH = H * SCALE;
const raw = Buffer.alloc((OW * 3 + 1) * OH);
let o = 0;
for (let y = 0; y < OH; y++) {
  raw[o++] = 0; // filter: none
  const sy = (y / SCALE) | 0;
  for (let x = 0; x < OW; x++) {
    const sx = (x / SCALE) | 0;
    const i = (sy * W + sx) * 3;
    raw[o++] = buf[i]; raw[o++] = buf[i + 1]; raw[o++] = buf[i + 2];
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 2;   // colour type: truecolour RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);

console.log(`✓ ${OUT}`);
console.log(`  time=${TIME}  seed=${SEED0}  art=${W}x${H}  file=${OW}x${OH}  ${(png.length / 1024).toFixed(1)} KB`);
