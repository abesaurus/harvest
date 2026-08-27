/* ═══════════════════════════════════════════════════════════
   px.ts — pixel-art sprite bakery
   Everything is drawn at 1 logical pixel = 1 art pixel, then the
   whole scene is upscaled with image smoothing OFF, so the result
   is authentic crisp pixel art (no blurry emoji).
   ═══════════════════════════════════════════════════════════ */

export const PAL = {
  // world
  grass1: "#5fa845", grass2: "#69b44c", grass3: "#54993c",
  grassDark: "#3f7c30",
  path1: "#c9a86b", path2: "#bb9a5d", pathEdge: "#a8874c",
  water1: "#4aa3d8", water2: "#3d8fc4", waterFoam: "#bfe6f7",
  soil1: "#7b5230", soil2: "#8c5f38", soilDry: "#6b4526",
  soilWet1: "#5a3a20", soilWet2: "#6b4728",
  // wood / structures
  wood: "#a9713c", woodDark: "#7d5029", woodLight: "#c99055",
  roof: "#c1503f", roofDark: "#9b3c2d", roofLight: "#d96a55",
  wall: "#e8d3a8", wallDark: "#cdb489",
  stone: "#9aa0a8", stoneDark: "#767c85", stoneLight: "#b8bec6",
  // nature
  leaf1: "#3f8f36", leaf2: "#4fa843", leaf3: "#2f6f28",
  trunk: "#7a4f2a", trunkDark: "#5b3a1e",
  // ink
  ink: "#2a1e14", inkSoft: "#43301f",
  white: "#ffffff", cream: "#fff3d6",
  gold: "#ffc63d", goldDark: "#d69a1c",
} as const;

/* ───────── sprite baking from string art ───────── */

export type Palette = Record<string, string>;

/** Bake string-art rows into an offscreen canvas (1 char = 1 px). */
export function bake(rows: string[], pal: Palette): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Horizontally mirrored copy of a baked sprite. */
export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.translate(src.width, 0); g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/* ═══════════════════════════════════════════════════════════
   FARMER SPRITES  (14 x 22, feet on last row)
   Palette keys:
     K outline   S skin   s skin-shade   H hat   h hat-shade
     B shirt     b shirt-dark   O denim  o denim-dark
     E eye       R bandana  G boot  g boot-dark  W white
   ═══════════════════════════════════════════════════════════ */

const FARMER_PAL: Palette = {
  K: PAL.ink, S: "#f4cb9c", s: "#dca87a",
  H: "#f0c85c", h: "#c49a30",
  B: "#4a8fdc", b: "#2f6cb0",
  O: "#3a55a8", o: "#283d80",
  E: "#22160e", R: "#e05646",
  G: "#8a5a2e", g: "#5f3c1c", W: "#ffffff",
};

// facing DOWN (toward camera)
const F_DOWN = [
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
];
// facing UP (away)
const F_UP = [
  "..............",
  "...hhhhhhhh...",
  "..hHHHHHHHHh..",
  ".hhHHHHHHHHhh.",
  "hhhhhhhhhhhhhh",
  "..KsssssssK...",
  "..KssssssssK..",
  "..KssssssssK..",
  "..KssssssssK..",
  "...KssssssK...",
  "....KKKKKK....",
  "...RRRRRRRR...",
  "..bBBBBBBBBb..",
  ".sBBBBBBBBBBs.",
  ".SBBBBBBBBBBS.",
  ".SBBOOOOOOBBS.",
  ".sKOOOOOOOOKs.",
  "..OOOOOOOOOO..",
  "..OOOOOOOOOO..",
];
// facing RIGHT
const F_SIDE = [
  "..............",
  "....hhhhhhh...",
  "...hHHHHHHHh..",
  "..hhHHHHHHHhh.",
  ".hhhhhhhhhhhhh",
  "...KSSSSSSK...",
  "...KSSSSSSSK..",
  "...KSSSSEWSK..",
  "...KSSSSSSSK..",
  "....KSSSSSK...",
  ".....KKKKK....",
  "....RRRRRRR...",
  "...bBBBBBBBb..",
  "...sBBBBBBBs..",
  "...SBBOOOBBS..",
  "...SBOOOOOBS..",
  "....KOOOOOK...",
  "....OOOOOOO...",
  "....OOOOOOO...",
];

export type Dir = "down" | "up" | "left" | "right";

export type FarmerArt = {
  body: Record<Dir, HTMLCanvasElement>;
};

export function bakeFarmer(): FarmerArt {
  const down = bake(F_DOWN, FARMER_PAL);
  const up = bake(F_UP, FARMER_PAL);
  const right = bake(F_SIDE, FARMER_PAL);
  return { body: { down, up, right, left: mirror(right) } };
}

/* ───────── legs + tool drawn procedurally per frame ───────── */

/** Draw farmer legs. frame 0..3 walk cycle; moving=false → idle stance. */
export function drawLegs(
  g: CanvasRenderingContext2D, x: number, y: number, dir: Dir,
  frame: number, moving: boolean,
) {
  // x,y = sprite top-left; legs occupy rows 19..21
  const denim = "#3a55a8", dDark = "#283d80", boot = "#8a5a2e", bDark = "#5f3c1c";
  const swing = moving ? [0, 1, 0, -1][frame] : 0;
  const lx = x + 3, rx = x + 8;
  const top = y + 19;
  if (dir === "left" || dir === "right") {
    // side view: one leg forward one back
    g.fillStyle = dDark; g.fillRect(x + 4, top, 3, 2 + Math.max(0, swing));
    g.fillStyle = denim; g.fillRect(x + 6, top, 3, 2 - Math.min(0, swing));
    g.fillStyle = bDark; g.fillRect(x + 3, top + 2 + Math.max(0, swing), 4, 1);
    g.fillStyle = boot; g.fillRect(x + 6, top + 2 - Math.min(0, swing), 4, 1);
  } else {
    g.fillStyle = denim;
    g.fillRect(lx, top, 3, 2 + Math.max(0, swing));
    g.fillRect(rx, top, 3, 2 - Math.min(0, swing));
    g.fillStyle = boot;
    g.fillRect(lx, top + 2 + Math.max(0, swing), 3, 1);
    g.fillRect(rx, top + 2 - Math.min(0, swing), 3, 1);
    g.fillStyle = bDark;
    g.fillRect(lx, top + 2 + Math.max(0, swing), 3, 1);
    g.fillRect(rx, top + 2 - Math.min(0, swing), 3, 1);
  }
}

export type ToolKind = "hoe" | "can" | "scythe" | "hand" | "seed";

/** Draw a tool in the farmer's hands, with a swing offset 0..1. */
export function drawTool(
  g: CanvasRenderingContext2D, x: number, y: number, dir: Dir,
  tool: ToolKind, swing: number,
) {
  if (tool === "hand" || tool === "seed") return;
  const flip = dir === "left" ? -1 : 1;
  const hx = dir === "up" ? x + 3 : x + (dir === "left" ? 1 : 10);
  const hy = y + 12;
  const arc = Math.sin(swing * Math.PI); // 0..1..0
  const drop = Math.round(arc * 5);

  if (tool === "hoe") {
    g.fillStyle = "#a9713c";
    for (let i = 0; i < 8; i++) {
      g.fillRect(hx + flip * Math.round(i * 0.35), hy - 6 + i + drop, 1, 1);
    }
    g.fillStyle = "#b8bec6";
    g.fillRect(hx + flip * 2, hy + 2 + drop, 3, 2);
  } else if (tool === "can") {
    g.fillStyle = "#8a97a4";
    g.fillRect(hx - 1, hy - 2 + drop, 5, 4);
    g.fillStyle = "#6e7a86";
    g.fillRect(hx + flip * 4, hy - 3 + drop, 2, 2);
    if (arc > 0.4) {
      g.fillStyle = "#7fd4f5";
      for (let i = 0; i < 4; i++) g.fillRect(hx + flip * (5 + i), hy - 1 + i + drop, 1, 1);
    }
  } else if (tool === "scythe") {
    g.fillStyle = "#a9713c";
    for (let i = 0; i < 9; i++) g.fillRect(hx, hy - 7 + i + drop, 1, 1);
    g.fillStyle = "#d7dde5";
    for (let i = 0; i < 5; i++) g.fillRect(hx + flip * (1 + i), hy - 7 + Math.round(i * i * 0.3) + drop, 1, 1);
  }
}

/* ═══════════════════════════════════════════════════════════
   CROP RENDERING (procedural, per-crop colours, 16px cell)
   ═══════════════════════════════════════════════════════════ */

export type CropArt = {
  stem: string; leaf: string; fruit: string; fruitHi: string;
  shape: "berry" | "cob" | "root" | "leafy" | "vine";
};

export function drawCropSprite(
  g: CanvasRenderingContext2D, x: number, y: number,
  art: CropArt, stage: 0 | 1 | 2 | 3, wither: boolean, sway: number,
) {
  // x,y = tile top-left (16x16). Plant grows from bottom-centre.
  const cx = x + 8, base = y + 13;
  const s = wither ? "#8a7a56" : art.stem;
  const l = wither ? "#9c8c60" : art.leaf;
  const sw = Math.round(sway); // -1..1 pixel sway

  if (stage === 0) {
    // freshly sown: two seed specks in the furrow
    g.fillStyle = wither ? "#7a6a48" : "#c7a45f";
    g.fillRect(cx - 2, base + 1, 2, 1);
    g.fillRect(cx + 1, base, 2, 1);
    return;
  }
  if (stage === 1) {
    // sprout: short stem + 2 leaves
    g.fillStyle = s;
    g.fillRect(cx, base - 3, 1, 4);
    g.fillStyle = l;
    g.fillRect(cx - 2 + sw, base - 4, 2, 1);
    g.fillRect(cx + 1 + sw, base - 4, 2, 1);
    return;
  }
  // stage 2 / 3: full plant
  const h = stage === 3 ? 9 : 6;
  g.fillStyle = s;
  g.fillRect(cx, base - h, 1, h + 1);
  g.fillStyle = l;
  // leaf pairs up the stem
  for (let i = 2; i < h; i += 3) {
    g.fillRect(cx - 3 + sw, base - i, 3, 1);
    g.fillRect(cx + 1 + sw, base - i - 1, 3, 1);
  }
  if (stage < 3) return;

  const f = wither ? "#8a7a56" : art.fruit;
  const fh = wither ? "#9c8c60" : art.fruitHi;
  g.fillStyle = f;
  switch (art.shape) {
    case "berry":
      g.fillRect(cx - 3 + sw, base - h - 1, 3, 3);
      g.fillRect(cx + 1 + sw, base - h + 1, 3, 3);
      g.fillStyle = fh;
      g.fillRect(cx - 3 + sw, base - h - 1, 1, 1);
      g.fillRect(cx + 1 + sw, base - h + 1, 1, 1);
      break;
    case "cob":
      g.fillRect(cx - 2 + sw, base - h - 2, 4, 7);
      g.fillStyle = fh;
      g.fillRect(cx - 2 + sw, base - h - 2, 1, 7);
      g.fillStyle = art.leaf;
      g.fillRect(cx + 2 + sw, base - h - 1, 1, 6);
      break;
    case "root":
      g.fillRect(cx - 3 + sw, base - 1, 7, 3);
      g.fillStyle = fh;
      g.fillRect(cx - 2 + sw, base - 1, 2, 1);
      g.fillStyle = art.leaf;
      g.fillRect(cx - 2 + sw, base - h - 1, 5, 2);
      break;
    case "leafy":
      g.fillRect(cx - 4 + sw, base - h - 1, 9, 5);
      g.fillStyle = fh;
      g.fillRect(cx - 3 + sw, base - h, 3, 2);
      break;
    case "vine":
      g.fillRect(cx - 4 + sw, base - h + 1, 3, 3);
      g.fillRect(cx + 2 + sw, base - h - 1, 3, 3);
      g.fillRect(cx - 1 + sw, base - h + 3, 3, 3);
      g.fillStyle = fh;
      g.fillRect(cx - 4 + sw, base - h + 1, 1, 1);
      g.fillRect(cx + 2 + sw, base - h - 1, 1, 1);
      break;
  }
}

/* ═══════════════════════════════════════════════════════════
   PROPS & BUILDINGS  (procedural pixel art)
   ═══════════════════════════════════════════════════════════ */

export function drawTree(g: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  // occupies 16 wide x 28 tall, anchored bottom
  const t = y - 28;
  g.fillStyle = PAL.trunkDark; g.fillRect(x + 6, t + 18, 4, 10);
  g.fillStyle = PAL.trunk; g.fillRect(x + 7, t + 18, 2, 10);
  const blobs: [number, number, number][] = [
    [8, 10, 8], [4, 13, 5], [12, 13, 5], [8, 6, 6], [3, 8, 4], [13, 8, 4],
  ];
  g.fillStyle = PAL.leaf3;
  for (const [bx, by, r] of blobs) circleFill(g, x + bx, t + by + 1, r);
  g.fillStyle = PAL.leaf1;
  for (const [bx, by, r] of blobs) circleFill(g, x + bx, t + by, r - 1);
  g.fillStyle = PAL.leaf2;
  circleFill(g, x + 6 + (seed % 2), t + 8, 3);
}

export function drawBush(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.leaf3; circleFill(g, x + 8, y - 5, 6);
  g.fillStyle = PAL.leaf1; circleFill(g, x + 7, y - 6, 5);
  g.fillStyle = PAL.leaf2; circleFill(g, x + 6, y - 7, 2);
}

export function drawRock(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.stoneDark;
  g.fillRect(x + 3, y - 6, 10, 6);
  g.fillStyle = PAL.stone;
  g.fillRect(x + 4, y - 8, 8, 5);
  g.fillStyle = PAL.stoneLight;
  g.fillRect(x + 5, y - 8, 3, 2);
}

export function drawFlower(g: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  const cols = ["#f27a9d", "#ffd93d", "#c98cf0", "#ff8b5a"];
  g.fillStyle = PAL.leaf3; g.fillRect(x + 8, y - 4, 1, 4);
  g.fillStyle = cols[seed % cols.length];
  g.fillRect(x + 7, y - 6, 3, 2);
  g.fillStyle = PAL.cream; g.fillRect(x + 8, y - 5, 1, 1);
}

export function drawWeeds(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.grassDark;
  for (let i = 0; i < 5; i++) g.fillRect(x + 2 + i * 3, y - 4 - (i % 3), 1, 4 + (i % 3));
  g.fillStyle = "#8a7a3a";
  g.fillRect(x + 5, y - 2, 2, 2); g.fillRect(x + 10, y - 3, 2, 3);
}

export function drawStump(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.trunkDark; g.fillRect(x + 4, y - 6, 8, 6);
  g.fillStyle = "#96632f"; g.fillRect(x + 5, y - 7, 6, 2);
}

export function drawFencePost(g: CanvasRenderingContext2D, x: number, y: number, horiz: boolean) {
  g.fillStyle = PAL.woodDark;
  if (horiz) {
    g.fillRect(x, y - 7, 16, 2);
    g.fillRect(x, y - 3, 16, 2);
    g.fillStyle = PAL.wood;
    g.fillRect(x + 2, y - 10, 3, 10);
    g.fillRect(x + 11, y - 10, 3, 10);
  } else {
    g.fillStyle = PAL.wood;
    g.fillRect(x + 6, y - 12, 3, 14);
    g.fillStyle = PAL.woodDark;
    g.fillRect(x + 3, y - 9, 9, 2);
  }
}

export function drawWell(g: CanvasRenderingContext2D, x: number, y: number) {
  // 2 tiles wide (32), anchored bottom
  g.fillStyle = PAL.stoneDark; g.fillRect(x + 4, y - 12, 24, 12);
  g.fillStyle = PAL.stone; g.fillRect(x + 5, y - 11, 22, 10);
  g.fillStyle = "#2f6f9c"; g.fillRect(x + 8, y - 10, 16, 5);
  g.fillStyle = PAL.water1; g.fillRect(x + 9, y - 9, 14, 3);
  g.fillStyle = PAL.woodDark; g.fillRect(x + 6, y - 26, 3, 15); g.fillRect(x + 23, y - 26, 3, 15);
  g.fillStyle = PAL.roofDark; g.fillRect(x + 2, y - 30, 28, 5);
  g.fillStyle = PAL.roof; g.fillRect(x + 4, y - 32, 24, 3);
}

export function drawHouse(g: CanvasRenderingContext2D, x: number, y: number) {
  // 5 tiles wide (80) x 64 tall, anchored bottom-left
  const W = 80;
  g.fillStyle = PAL.wallDark; g.fillRect(x, y - 34, W, 34);
  g.fillStyle = PAL.wall; g.fillRect(x + 2, y - 32, W - 4, 32);
  // plank lines
  g.fillStyle = "rgba(0,0,0,0.07)";
  for (let i = 0; i < 8; i++) g.fillRect(x + 2, y - 32 + i * 4, W - 4, 1);
  // roof
  g.fillStyle = PAL.roofDark;
  for (let i = 0; i < 18; i++) g.fillRect(x + i * 2, y - 34 - i, W - i * 4, 2);
  g.fillStyle = PAL.roof;
  for (let i = 0; i < 16; i++) g.fillRect(x + 3 + i * 2, y - 35 - i, W - 6 - i * 4, 1);
  // door
  g.fillStyle = PAL.woodDark; g.fillRect(x + 33, y - 22, 14, 22);
  g.fillStyle = PAL.wood; g.fillRect(x + 34, y - 21, 12, 21);
  g.fillStyle = PAL.gold; g.fillRect(x + 43, y - 12, 2, 2);
  // windows
  for (const wx of [12, 58]) {
    g.fillStyle = PAL.woodDark; g.fillRect(x + wx, y - 26, 12, 12);
    g.fillStyle = "#8fd0ef"; g.fillRect(x + wx + 1, y - 25, 10, 10);
    g.fillStyle = "#c9ebfa"; g.fillRect(x + wx + 1, y - 25, 4, 4);
    g.fillStyle = PAL.woodDark; g.fillRect(x + wx + 5, y - 25, 1, 10); g.fillRect(x + wx + 1, y - 20, 10, 1);
  }
  // chimney
  g.fillStyle = PAL.stoneDark; g.fillRect(x + 62, y - 56, 10, 14);
  g.fillStyle = PAL.stone; g.fillRect(x + 63, y - 55, 8, 13);
}

export function drawBarn(g: CanvasRenderingContext2D, x: number, y: number) {
  const W = 64;
  g.fillStyle = "#9b3c2d"; g.fillRect(x, y - 30, W, 30);
  g.fillStyle = "#c1503f"; g.fillRect(x + 2, y - 28, W - 4, 28);
  g.fillStyle = PAL.cream;
  g.fillRect(x + 2, y - 28, W - 4, 2);
  g.fillRect(x + 6, y - 26, 3, 26); g.fillRect(x + W - 9, y - 26, 3, 26);
  // gambrel roof
  g.fillStyle = "#7d4a2a";
  for (let i = 0; i < 8; i++) g.fillRect(x + i * 2, y - 30 - i * 2, W - i * 4, 2);
  g.fillStyle = "#a1633a";
  for (let i = 0; i < 7; i++) g.fillRect(x + 3 + i * 2, y - 31 - i * 2, W - 6 - i * 4, 1);
  // big doors
  g.fillStyle = PAL.woodDark; g.fillRect(x + 22, y - 22, 20, 22);
  g.fillStyle = PAL.wood; g.fillRect(x + 23, y - 21, 18, 21);
  g.fillStyle = PAL.cream;
  for (let i = 0; i < 10; i++) g.fillRect(x + 23 + i * 2, y - 21 + i * 2, 2, 1);
  g.fillStyle = PAL.woodDark; g.fillRect(x + 31, y - 21, 2, 21);
  // hay loft window
  g.fillStyle = PAL.ink; g.fillRect(x + 27, y - 40, 10, 8);
  g.fillStyle = PAL.gold; g.fillRect(x + 29, y - 37, 6, 4);
}

export function drawShopStall(g: CanvasRenderingContext2D, x: number, y: number) {
  const W = 48;
  g.fillStyle = PAL.woodDark; g.fillRect(x + 2, y - 20, W - 4, 20);
  g.fillStyle = PAL.wood; g.fillRect(x + 3, y - 19, W - 6, 19);
  // counter top
  g.fillStyle = PAL.woodLight; g.fillRect(x, y - 22, W, 3);
  // striped awning
  for (let i = 0; i < W / 6; i++) {
    g.fillStyle = i % 2 ? "#e8564a" : PAL.cream;
    g.fillRect(x + i * 6, y - 34, 6, 8);
  }
  g.fillStyle = PAL.woodDark;
  g.fillRect(x + 1, y - 34, 2, 12); g.fillRect(x + W - 3, y - 34, 2, 12);
  // produce crates on counter
  g.fillStyle = "#b07840"; g.fillRect(x + 6, y - 28, 10, 6);
  g.fillStyle = "#e0483c"; g.fillRect(x + 7, y - 29, 3, 2); g.fillRect(x + 11, y - 30, 3, 3);
  g.fillStyle = "#b07840"; g.fillRect(x + 30, y - 28, 10, 6);
  g.fillStyle = "#ffd93d"; g.fillRect(x + 32, y - 30, 3, 3); g.fillRect(x + 36, y - 29, 3, 2);
}

export function drawSilo(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.stoneDark; g.fillRect(x + 2, y - 52, 22, 52);
  g.fillStyle = PAL.stone; g.fillRect(x + 4, y - 50, 18, 50);
  g.fillStyle = PAL.stoneLight; g.fillRect(x + 5, y - 50, 4, 50);
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 9; i++) g.fillRect(x + 4, y - 48 + i * 6, 18, 1);
  g.fillStyle = PAL.roofDark;
  for (let i = 0; i < 6; i++) g.fillRect(x + 3 + i * 2, y - 52 - i * 2, 20 - i * 4, 2);
}

export function drawChicken(g: CanvasRenderingContext2D, x: number, y: number, f: number) {
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(x + 2, y, 8, 1);
  g.fillStyle = PAL.white; g.fillRect(x + 2, y - 7, 8, 6);
  g.fillStyle = "#e8e2d2"; g.fillRect(x + 2, y - 4, 8, 3);
  g.fillStyle = PAL.white; g.fillRect(x + 7, y - 10, 4, 4);
  g.fillStyle = "#e05646"; g.fillRect(x + 8, y - 12, 3, 2);
  g.fillStyle = PAL.gold; g.fillRect(x + 11, y - 9, 2, 1);
  g.fillStyle = PAL.ink; g.fillRect(x + 9, y - 9, 1, 1);
  g.fillStyle = PAL.goldDark;
  g.fillRect(x + 3, y - 1, 1, 1 + (f % 2));
  g.fillRect(x + 7, y - 1, 1, 1 + ((f + 1) % 2));
}

export function drawCow(g: CanvasRenderingContext2D, x: number, y: number, f: number) {
  g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x + 1, y, 18, 1);
  g.fillStyle = PAL.white; g.fillRect(x + 2, y - 11, 16, 9);
  g.fillStyle = PAL.ink;
  g.fillRect(x + 4, y - 10, 4, 3); g.fillRect(x + 11, y - 8, 5, 4);
  g.fillStyle = PAL.white; g.fillRect(x + 15, y - 15, 6, 6);
  g.fillStyle = PAL.ink; g.fillRect(x + 16, y - 14, 4, 2);
  g.fillStyle = "#f2a0a8"; g.fillRect(x + 18, y - 11, 3, 2);
  g.fillStyle = PAL.ink;
  g.fillRect(x + 3, y - 2, 2, 2 + (f % 2));
  g.fillRect(x + 8, y - 2, 2, 2);
  g.fillRect(x + 14, y - 2, 2, 2 + ((f + 1) % 2));
}

export function drawScarecrow(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.woodDark; g.fillRect(x + 7, y - 22, 2, 22);
  g.fillStyle = PAL.wood; g.fillRect(x + 1, y - 16, 14, 2);
  g.fillStyle = "#4a8fdc"; g.fillRect(x + 4, y - 18, 8, 9);
  g.fillStyle = "#e8c060"; g.fillRect(x + 5, y - 25, 6, 6);
  g.fillStyle = PAL.ink; g.fillRect(x + 6, y - 23, 1, 1); g.fillRect(x + 9, y - 23, 1, 1);
  g.fillStyle = "#c49a30"; g.fillRect(x + 3, y - 26, 10, 2);
}

/* ───────── small helpers ───────── */

/** Pixel-perfect filled circle (Bresenham-ish, integer only). */
export function circleFill(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

/** Tiny 5x6 bitmap font for in-world labels (crisp at pixel scale). */
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  "+": ["000", "010", "111", "010", "000"], "-": ["000", "000", "111", "000", "000"],
  X: ["101", "101", "010", "101", "101"], P: ["111", "101", "111", "100", "100"],
  G: ["111", "100", "101", "101", "111"], "!": ["010", "010", "010", "000", "010"],
  " ": ["000", "000", "000", "000", "000"],
};

export function drawPixelText(
  g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string,
) {
  g.fillStyle = color;
  let cx = x;
  for (const chRaw of text.toUpperCase()) {
    const rows = GLYPHS[chRaw];
    if (!rows) { cx += 4; continue; }
    for (let ry = 0; ry < rows.length; ry++)
      for (let rx = 0; rx < rows[ry].length; rx++)
        if (rows[ry][rx] === "1") g.fillRect(cx + rx, y + ry, 1, 1);
    cx += 4;
  }
}

export function pixelTextWidth(text: string) { return text.length * 4 - 1; }
