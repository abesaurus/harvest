import { useSyncExternalStore } from "react";
import {
  MAX_LEVEL, MIN_POOL_LEVEL, MAX_PLOTS, YIELD_XP, SEED_COST, POOL_BPS,
  BOOST_PER_LEVEL, xpForNext, unlockedPlots, GROW_MS, type CropKind,
} from "./harvest";

/* ───────────────────────────────────────────────
   Simple external store (no deps) with localStorage
   persistence + a mock wallet session.
   Mirrors HarvestGame.sol math for the prototype.
   ─────────────────────────────────────────────── */

export type Plot = { plantedAt: number | null; crop: CropKind | null };

export type GameState = {
  // session
  address: string | null;
  ens: string | null;
  // player
  level: number;
  xp: number;
  boost: number;
  farm: number;      // FARM balance
  earned: number;    // lifetime claimed
  plots: Plot[];
  poolFund: number;  // current reward pool (FARM)
  seedInventory: Record<CropKind, number>;
};

const LS_KEY = "ponsharvest.v1";

function freshState(): GameState {
  return {
    address: null,
    ens: null,
    level: 1,
    xp: 0,
    boost: 0,
    farm: 1000,
    earned: 0,
    plots: Array.from({ length: MAX_PLOTS }, () => ({ plantedAt: null, crop: null })),
    poolFund: 4200,
    seedInventory: { turnip: 5, potato: 0, tomato: 0, corn: 0, strawberry: 0 },
  };
}

let state: GameState = load();
const listeners = new Set<() => void>();

function load(): GameState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch {}
  return freshState();
}
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}
function emit() { persist(); listeners.forEach((l) => l()); }
function set(patch: Partial<GameState>) { state = { ...state, ...patch }; emit(); }

export function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
export function getState() { return state; }
export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/* ─────────────── session / wallet (mock) ─────────────── */

function randHex(n: number) {
  const c = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * 16)];
  return s;
}

export function connectWallet(): Promise<string> {
  // Mock connect. Swap with wagmi/ethers on deploy.
  return new Promise((resolve) => {
    setTimeout(() => {
      const addr = "0x" + randHex(40);
      set({ address: addr });
      resolve(addr);
    }, 650);
  });
}

export function disconnect() {
  set({ address: null });
}

export function isConnected() { return !!state.address; }

/* ─────────────── game actions ─────────────── */

const toastListeners = new Set<(msg: string) => void>();
export function onToast(cb: (msg: string) => void) { toastListeners.add(cb); return () => { toastListeners.delete(cb); }; }
export function toast(msg: string) { toastListeners.forEach((l) => l(msg)); }

export function buySeed(crop: CropKind, price: number) {
  if (state.farm < price) return toast("Not enough FARM");
  set({
    farm: state.farm - price,
    seedInventory: { ...state.seedInventory, [crop]: state.seedInventory[crop] + 1 },
  });
  toast(`Bought 1 ${crop} seed 🌱`);
}

export function plant(i: number, crop: CropKind) {
  const open = unlockedPlots(state.level);
  if (i >= open) return toast("🔒 Plot locked — level up");
  if (state.plots[i].plantedAt) return;
  if (state.seedInventory[crop] <= 0) return toast(`No ${crop} seeds — buy from shop`);
  const plots = state.plots.slice();
  plots[i] = { plantedAt: Date.now(), crop };
  set({
    plots,
    seedInventory: { ...state.seedInventory, [crop]: state.seedInventory[crop] - 1 },
    // planting a seed feeds the pool with SEED_COST worth (already "paid" at shop)
    poolFund: state.poolFund + (SEED_COST * POOL_BPS) / 10000,
  });
}

export function harvestPlot(i: number) {
  const p = state.plots[i];
  if (!p.plantedAt) return;
  if (Date.now() - p.plantedAt < GROW_MS) return;
  const plots = state.plots.slice();
  plots[i] = { plantedAt: null, crop: null };
  set({ plots });
  addXp(YIELD_XP);
  toast(`Harvested +${YIELD_XP} XP 🌾`);
}

export function harvestAll() {
  let gained = 0;
  const now = Date.now();
  const plots = state.plots.map((p) => {
    if (p.plantedAt && now - p.plantedAt >= GROW_MS) { gained += YIELD_XP; return { plantedAt: null, crop: null }; }
    return p;
  });
  if (gained === 0) return toast("Nothing ready yet");
  set({ plots });
  addXp(gained);
  toast(`Harvested +${gained} XP 🌾`);
}

function addXp(amount: number) {
  let lvl = state.level;
  let x = state.xp + amount;
  let leveled = false;
  const wasEligible = lvl >= MIN_POOL_LEVEL;
  while (lvl < MAX_LEVEL && x >= xpForNext(lvl)) { x -= xpForNext(lvl); lvl += 1; leveled = true; }
  if (lvl >= MAX_LEVEL) { lvl = MAX_LEVEL; x = 0; }
  set({ level: lvl, xp: x });
  if (leveled) {
    if (!wasEligible && lvl >= MIN_POOL_LEVEL) toast("🎉 Level 10! Reward pool unlocked");
    else toast(`⬆️ Level ${lvl}!`);
  }
}

export function poolShare() {
  const eligible = state.level >= MIN_POOL_LEVEL;
  const totalLevels =
    (eligible ? state.level : 0) +
    [30, 24, 19, 14, 11, 8].filter((l) => l >= MIN_POOL_LEVEL).reduce((s, l) => s + l, 0);
  const pct = totalLevels > 0 && eligible ? (state.level / totalLevels) * 100 : 0;
  return { eligible, totalLevels, pct, share: (pct / 100) * state.poolFund };
}

export function claim() {
  const { share, eligible } = poolShare();
  if (!eligible || share <= 0) return toast("No rewards yet (reach level 10)");
  const amt = Math.floor(share * 100) / 100;
  set({ farm: state.farm + amt, earned: state.earned + amt, poolFund: Math.max(0, state.poolFund - amt) });
  toast(`Claimed ${amt} FARM 💰`);
}

export function convertToBoost(levels: number) {
  if (state.level - levels < 1) return toast("Must keep at least level 1");
  set({ level: state.level - levels, xp: 0, boost: state.boost + levels * BOOST_PER_LEVEL });
  toast(`Traded ${levels} lvl → ${levels * BOOST_PER_LEVEL}⚡ (pool share drops)`);
}
