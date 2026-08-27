// Pure game constants + helpers — mirrors HarvestGame.sol exactly.
export const MAX_LEVEL = 30;
export const MIN_POOL_LEVEL = 10;
export const MAX_PLOTS = 12;
export const XP_BASE = 100; // xp L->L+1 = XP_BASE * L
export const GROW_MS = 8000; // prototype grow time (on-chain configurable)
export const YIELD_XP = 100;
export const SEED_COST = 10; // FARM per seed
export const POOL_BPS = 8000; // 80% of seed -> pool
export const BOOST_PER_LEVEL = 1;

export function xpForNext(level: number) {
  if (level >= MAX_LEVEL) return Infinity;
  return XP_BASE * level;
}
export function unlockedPlots(level: number) {
  return Math.min(2 + level, MAX_PLOTS);
}

// Crop kinds — Harvest Moon style, each with grow stages
export type CropKind = "turnip" | "potato" | "tomato" | "corn" | "strawberry";

export const CROPS: Record<
  CropKind,
  { name: string; stages: string[]; color: string }
> = {
  turnip: { name: "Turnip", stages: ["🌱", "🌿", "🥬"], color: "#8fe36b" },
  potato: { name: "Potato", stages: ["🌱", "🌿", "🥔"], color: "#c9a25a" },
  tomato: { name: "Tomato", stages: ["🌱", "🌿", "🍅"], color: "#ff5a4d" },
  corn: { name: "Corn", stages: ["🌱", "🌿", "🌽"], color: "#ffd93d" },
  strawberry: { name: "Strawberry", stages: ["🌱", "🌿", "🍓"], color: "#ff4f79" },
};

export const CROP_ORDER: CropKind[] = ["turnip", "potato", "tomato", "corn", "strawberry"];

export type Farmer = { name: string; level: number; boost: number };

// simulated rival farmers for the leaderboard/pool
export const RIVALS: Farmer[] = [
  { name: "0xBEE…farm", level: 30, boost: 14 },
  { name: "0xSoy…4a2", level: 24, boost: 3 },
  { name: "0xHus…k9", level: 19, boost: 0 },
  { name: "0xTom…c1", level: 14, boost: 8 },
  { name: "0xPea…77", level: 11, boost: 1 },
  { name: "0xRad…e0", level: 8, boost: 0 },
];

export function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
