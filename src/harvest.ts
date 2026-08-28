/* ═══════════════════════════════════════════════════════════
   game data — crops, tiles, levels, orders, tools
   ═══════════════════════════════════════════════════════════ */

import type { CropArt } from "./px";

export const TILE = 16;          // art pixels per tile
export const MAP_W = 40;         // tiles
export const MAP_H = 30;

export const MAX_LEVEL = 30;
export const MIN_POOL_LEVEL = 10;
export const XP_BASE = 100;

/* ───────── crops ───────── */

export type CropKind = "turnip" | "potato" | "tomato" | "corn" | "strawberry" | "pumpkin";

export type CropDef = {
  name: string;
  seedCost: number;      // gold per seed
  sell: number;          // gold per harvested unit
  xp: number;
  growMs: number;        // total grow time (needs watering to progress)
  witherMs: number;      // time after mature before it withers
  minLevel: number;
  art: CropArt;
  icon: string;          // emoji only used in HTML UI panels
};

export const CROPS: Record<CropKind, CropDef> = {
  turnip: {
    name: "Turnip", seedCost: 8, sell: 18, xp: 12, growMs: 20_000, witherMs: 180_000, minLevel: 1,
    icon: "🥬",
    art: { stem: "#4fa843", leaf: "#67c257", fruit: "#f0f4e8", fruitHi: "#ffffff", shape: "turnip" },
  },
  potato: {
    name: "Potato", seedCost: 14, sell: 34, xp: 20, growMs: 35_000, witherMs: 240_000, minLevel: 2,
    icon: "🥔",
    art: { stem: "#43903a", leaf: "#5cb04d", fruit: "#c79a5b", fruitHi: "#e0bb84", shape: "potato" },
  },
  tomato: {
    name: "Tomato", seedCost: 22, sell: 58, xp: 32, growMs: 55_000, witherMs: 240_000, minLevel: 4,
    icon: "🍅",
    art: { stem: "#3f8f36", leaf: "#57b84a", fruit: "#e0483c", fruitHi: "#ff7565", shape: "tomato" },
  },
  corn: {
    name: "Corn", seedCost: 34, sell: 92, xp: 48, growMs: 80_000, witherMs: 300_000, minLevel: 7,
    icon: "🌽",
    art: { stem: "#4a9a3c", leaf: "#63bd52", fruit: "#ffd23d", fruitHi: "#fff08a", shape: "corn" },
  },
  strawberry: {
    name: "Strawberry", seedCost: 48, sell: 138, xp: 66, growMs: 110_000, witherMs: 300_000, minLevel: 11,
    icon: "🍓",
    art: { stem: "#3f8f36", leaf: "#57b84a", fruit: "#e8354f", fruitHi: "#ff7088", shape: "strawberry" },
  },
  pumpkin: {
    name: "Pumpkin", seedCost: 70, sell: 215, xp: 95, growMs: 150_000, witherMs: 360_000, minLevel: 16,
    icon: "🎃",
    art: { stem: "#4a8f36", leaf: "#63b84a", fruit: "#e8802a", fruitHi: "#ffab5c", shape: "pumpkin" },
  },
};

export const CROP_ORDER: CropKind[] = ["turnip", "potato", "tomato", "corn", "strawberry", "pumpkin"];

/* ───────── tools ───────── */

export type ToolId = "hoe" | "can" | "seed" | "scythe" | "hand";

export const TOOLS: { id: ToolId; name: string; icon: string; hint: string }[] = [
  { id: "hoe", name: "Hoe", icon: "⛏️", hint: "Till grass into soil" },
  { id: "seed", name: "Seeds", icon: "🌱", hint: "Sow the selected seed" },
  { id: "can", name: "Can", icon: "🪣", hint: "Water soil so crops grow" },
  { id: "scythe", name: "Scythe", icon: "🌾", hint: "Harvest ripe crops / clear withered" },
  { id: "hand", name: "Hand", icon: "✋", hint: "Clear weeds, pick things up" },
];

/* ───────── land / plots ───────── */

// farm land is a rectangle of tillable tiles; more unlock with level
export const FARM_X0 = 10, FARM_Y0 = 11, FARM_W = 12, FARM_H = 8; // 96 tillable tiles max

export function tillableTiles(level: number) {
  // start with 3 rows x 5 cols, grow with level up to full plot
  const cols = Math.min(FARM_W, 5 + Math.floor(level / 2));
  const rows = Math.min(FARM_H, 3 + Math.floor(level / 4));
  return { cols, rows };
}

export function xpForNext(level: number) {
  if (level >= MAX_LEVEL) return Infinity;
  return XP_BASE * level;
}

export const WATER_DECAY_MS = 45_000; // soil dries out

/* ───────── orders (deliver crops for gold + xp) ───────── */

export type Order = { id: string; crop: CropKind; qty: number; gold: number; xp: number };

export function rollOrder(level: number, seq: number): Order {
  const pool = CROP_ORDER.filter((c) => CROPS[c].minLevel <= level);
  const crop = pool[Math.floor(Math.random() * pool.length)] ?? "turnip";
  const qty = 3 + Math.floor(Math.random() * 4);
  const base = CROPS[crop].sell * qty;
  return {
    id: `o${seq}`,
    crop,
    qty,
    gold: Math.round(base * 1.45),
    xp: Math.round(CROPS[crop].xp * qty * 0.8),
  };
}

/* ───────── rival farmers (leaderboard + pool) ───────── */

export type Farmer = { name: string; level: number; power: number };

export const RIVALS: Farmer[] = [
  { name: "0xBEE…farm", level: 30, power: 1840 },
  { name: "sunnyacres", level: 26, power: 1210 },
  { name: "0xSoy…4a2", level: 24, power: 980 },
  { name: "hayfever", level: 21, power: 740 },
  { name: "0xHus…k9", level: 19, power: 610 },
  { name: "cropgoblin", level: 15, power: 380 },
  { name: "0xTom…c1", level: 14, power: 310 },
  { name: "0xPea…77", level: 11, power: 190 },
];

export const DAILY_POOL = 10_000; // PONS paid out each 2-day round

export function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
