import { useSyncExternalStore } from "react";
import {
  CROPS, CROP_ORDER, MAX_LEVEL, MIN_POOL_LEVEL, MAP_W, MAP_H,
  FARM_X0, FARM_Y0, WATER_DECAY_MS, DAILY_POOL, RIVALS,
  tillableTiles, xpForNext, rollOrder,
  type CropKind, type ToolId, type Order,
} from "./harvest";

/* ═══════════════════════════════════════════════════════════
   store.ts — authoritative game state (no deps, localStorage)
   Tile-based farm: every tile has a state, crops need water.
   ═══════════════════════════════════════════════════════════ */

export type TileKind = "grass" | "soil" | "path" | "water" | "blocked";

export type Tile = {
  kind: TileKind;
  tilled: boolean;
  wateredAt: number | null;
  crop: CropKind | null;
  plantedAt: number | null;
  /** ms of watered growth accumulated */
  grown: number;
  lastTick: number | null;
  weeds: boolean;
};

export type GameState = {
  address: string | null;
  nickname: string | null;   // player's chosen farm name (new-player onboarding)
  level: number;
  xp: number;
  gold: number;
  farmToken: number;      // $PONSFARM claimed
  poolPower: number;      // sacrificed progress
  tool: ToolId;
  sel: CropKind;
  seeds: Record<CropKind, number>;
  barn: Record<CropKind, number>;   // harvested produce
  orders: Order[];
  orderSeq: number;
  tiles: Tile[];          // MAP_W * MAP_H
  stats: { planted: number; harvested: number; watered: number; tilled: number };
  tutorialDone: boolean;  // has the player finished the first-time tutorial
};

const LS_KEY = "ponsharvest.v3";

/* ───────── map generation ───────── */

function idx(x: number, y: number) { return y * MAP_W + x; }
export { idx };

function blankTile(kind: TileKind = "grass"): Tile {
  return { kind, tilled: false, wateredAt: null, crop: null, plantedAt: null, grown: 0, lastTick: null, weeds: false };
}

function buildMap(): Tile[] {
  const t: Tile[] = Array.from({ length: MAP_W * MAP_H }, () => blankTile());

  // border blocked (fence ring)
  for (let x = 0; x < MAP_W; x++) { t[idx(x, 0)].kind = "blocked"; t[idx(x, MAP_H - 1)].kind = "blocked"; }
  for (let y = 0; y < MAP_H; y++) { t[idx(0, y)].kind = "blocked"; t[idx(MAP_W - 1, y)].kind = "blocked"; }

  // pond bottom-right
  for (let y = 22; y < 28; y++)
    for (let x = 30; x < 38; x++) {
      const dx = (x - 34) / 4, dy = (y - 25) / 3;
      if (dx * dx + dy * dy < 1) t[idx(x, y)].kind = "water";
    }

  // dirt paths: horizontal spine + vertical to farm
  for (let x = 2; x < 38; x++) t[idx(x, 9)].kind = "path";
  for (let y = 3; y < 10; y++) t[idx(20, y)].kind = "path";
  for (let y = 9; y < 21; y++) { t[idx(8, y)].kind = "path"; }
  for (let x = 8; x < 24; x++) t[idx(x, 20)].kind = "path";

  // house occupies 5x3 tiles at (3,4); barn 4x3 at (24,4); shop 3x2 at (14,6); silo 2x4 (30,3)
  block(t, 3, 4, 5, 3);
  block(t, 24, 4, 4, 3);
  block(t, 14, 6, 3, 2);
  block(t, 30, 3, 2, 4);
  block(t, 11, 3, 2, 2);   // well

  // scattered weeds on grass
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 90; i++) {
    const x = 1 + Math.floor(rnd() * (MAP_W - 2));
    const y = 1 + Math.floor(rnd() * (MAP_H - 2));
    const tl = t[idx(x, y)];
    if (tl.kind === "grass" && !inFarm(x, y)) tl.weeds = true;
  }
  return t;
}

function block(t: Tile[], x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) t[idx(x, y)].kind = "blocked";
}

function inFarm(x: number, y: number) {
  return x >= FARM_X0 && x < FARM_X0 + 12 && y >= FARM_Y0 && y < FARM_Y0 + 8;
}

/** Is the tile inside the currently unlocked farm rectangle? */
export function isUnlockedFarm(x: number, y: number, level: number) {
  const { cols, rows } = tillableTiles(level);
  return x >= FARM_X0 && x < FARM_X0 + cols && y >= FARM_Y0 && y < FARM_Y0 + rows;
}
/** Inside the farm fence but still locked (shows as wild land). */
export function isLockedFarm(x: number, y: number, level: number) {
  return inFarm(x, y) && !isUnlockedFarm(x, y, level);
}

/* ───────── state ───────── */

function freshState(): GameState {
  const zero = () => CROP_ORDER.reduce((a, c) => ({ ...a, [c]: 0 }), {} as Record<CropKind, number>);
  return {
    address: null,
    nickname: null,
    level: 1, xp: 0,
    gold: 120,
    farmToken: 0,
    poolPower: 0,
    tool: "hoe",
    sel: "turnip",
    seeds: { ...zero(), turnip: 6 },
    barn: zero(),
    orders: [rollOrder(1, 1), rollOrder(1, 2)],
    orderSeq: 3,
    tiles: buildMap(),
    stats: { planted: 0, harvested: 0, watered: 0, tilled: 0 },
    tutorialDone: false,
  };
}

let state: GameState = load();
const listeners = new Set<() => void>();

function load(): GameState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as GameState;
      const f = freshState();
      // tiles must match current map size
      if (Array.isArray(p.tiles) && p.tiles.length === MAP_W * MAP_H) f.tiles = p.tiles;
      return {
        ...f, ...p, tiles: f.tiles,
        seeds: { ...f.seeds, ...(p.seeds || {}) },
        barn: { ...f.barn, ...(p.barn || {}) },
        stats: { ...f.stats, ...(p.stats || {}) },
      };
    }
  } catch { /* corrupt save → fresh */ }
  return freshState();
}
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* quota */ } }
function emit() { persist(); listeners.forEach((l) => l()); }
function set(patch: Partial<GameState>) { state = { ...state, ...patch }; emit(); }

export function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function getState() { return state; }
export function useGame(): GameState { return useSyncExternalStore(subscribe, getState, getState); }

/** Mutate tiles in place then notify (used by the render loop for growth ticks). */
export function commitTiles() { state = { ...state, tiles: state.tiles.slice() }; emit(); }

/* ───────── toasts / floating text ───────── */

const toastListeners = new Set<(msg: string, kind?: string) => void>();
export function onToast(cb: (msg: string, kind?: string) => void) {
  toastListeners.add(cb); return () => { toastListeners.delete(cb); };
}
export function toast(msg: string, kind = "info") { toastListeners.forEach((l) => l(msg, kind)); }

const floatListeners = new Set<(x: number, y: number, text: string, color: string) => void>();
export function onFloat(cb: (x: number, y: number, text: string, color: string) => void) {
  floatListeners.add(cb); return () => { floatListeners.delete(cb); };
}
export function emitFloat(x: number, y: number, text: string, color: string) {
  floatListeners.forEach((l) => l(x, y, text, color));
}

/* ───────── wallet (real, injected EVM on Robinhood Chain) ───────── */

import { connectInjected, reconnectSilently, GATE_LIVE } from "./wallet";

/** Connect the real browser wallet. Sets the address on success. */
export async function connectWallet(): Promise<string> {
  const a = await connectInjected();
  set({ address: a });
  return a;
}
/** Restore a session silently if the wallet already authorised us. */
export async function restoreWallet(): Promise<string | null> {
  const a = await reconnectSilently();
  if (a) set({ address: a });
  return a;
}
export function setAddress(a: string | null) { set({ address: a }); }
export function disconnect() { set({ address: null }); }

/* ───────── selection ───────── */

export function setTool(t: ToolId) { set({ tool: t }); }
export function setSeed(c: CropKind) { set({ sel: c, tool: "seed" }); }
export function finishTutorial() { if (!state.tutorialDone) set({ tutorialDone: true }); }
/** Set the player's farm nickname (new-player onboarding). */
export function setNickname(name: string) {
  const clean = name.trim().slice(0, 20);
  if (clean) set({ nickname: clean });
}

/* ───────── crop growth model ─────────
   One watering is enough: a crop keeps growing to maturity after a single
   watering — you don't have to re-water. Growth still takes the full growMs. */

export function cropProgress(t: Tile, _now: number): number {
  if (!t.crop || !t.plantedAt) return 0;
  const total = CROPS[t.crop].growMs;
  return Math.min(1, t.grown / total);
}
export function isWatered(t: Tile, now: number) {
  if (!t.wateredAt) return false;
  // A planted crop stays "watered" for its whole growth after one watering.
  if (t.crop && t.plantedAt != null) return t.wateredAt >= t.plantedAt;
  // Empty tilled soil dries out normally.
  return now - t.wateredAt < WATER_DECAY_MS;
}
export function isMature(t: Tile, now: number) { return cropProgress(t, now) >= 1; }
export function isWithered(t: Tile, now: number) {
  if (!t.crop || !t.plantedAt) return false;
  if (!isMature(t, now)) return false;
  const matAt = t.lastTick ?? now;
  return now - matAt > CROPS[t.crop].witherMs;
}

/** Advance growth for all planted tiles. Called from the game loop. */
export function tickGrowth(now: number) {
  let dirty = false;
  for (const t of state.tiles) {
    if (!t.crop || !t.plantedAt) continue;
    const prev = t.lastTick ?? t.plantedAt;
    const dt = now - prev;
    if (dt <= 0) continue;
    const total = CROPS[t.crop].growMs;
    if (t.grown < total) {
      if (isWatered(t, now)) { t.grown = Math.min(total, t.grown + dt); dirty = true; }
      t.lastTick = now;
    } else {
      // hold the maturity timestamp for wither maths
      if (t.lastTick == null) { t.lastTick = now; dirty = true; }
    }
  }
  if (dirty) commitTiles();
}

/* ───────── actions on tiles ───────── */

export function useToolAt(x: number, y: number): boolean {
  const i = idx(x, y);
  const t = state.tiles[i];
  if (!t) return false;
  const now = Date.now();
  const px = x * 16 + 8, py = y * 16;

  // weeds first — hand clears them anywhere
  if (t.weeds) {
    if (state.tool === "hand" || state.tool === "scythe") {
      t.weeds = false;
      const g = 2;
      set({ gold: state.gold + g, stats: { ...state.stats, } });
      emitFloat(px, py, `+${g}G`, "#ffd93d");
      commitTiles();
      return true;
    }
    toast("Weeds — use ✋ Hand or 🌾 Scythe", "warn");
    return false;
  }

  if (t.kind === "water") {
    if (state.tool === "can") { toast("Watering can refilled 💧", "ok"); return true; }
    return false;
  }
  if (t.kind === "blocked" || t.kind === "path") return false;

  switch (state.tool) {
    case "hoe": {
      if (!isUnlockedFarm(x, y, state.level)) {
        toast(isLockedFarm(x, y, state.level) ? "🔒 Wild land — level up to clear it" : "You can only till inside the field", "warn");
        return false;
      }
      if (t.tilled) { toast("Already tilled", "warn"); return false; }
      t.tilled = true; t.kind = "soil";
      set({ stats: { ...state.stats, tilled: state.stats.tilled + 1 } });
      addXp(2, px, py);
      commitTiles();
      return true;
    }
    case "seed": {
      if (!t.tilled) { toast("Till the soil first (⛏️ Hoe)", "warn"); return false; }
      if (t.crop) { toast("Something is already growing here", "warn"); return false; }
      const c = state.sel;
      if (CROPS[c].minLevel > state.level) { toast(`${CROPS[c].name} unlocks at level ${CROPS[c].minLevel}`, "warn"); return false; }
      if (state.seeds[c] <= 0) { toast(`No ${CROPS[c].name} seeds — buy at the shop 🏪`, "warn"); return false; }
      t.crop = c; t.plantedAt = now; t.grown = 0; t.lastTick = now;
      set({
        seeds: { ...state.seeds, [c]: state.seeds[c] - 1 },
        stats: { ...state.stats, planted: state.stats.planted + 1 },
      });
      emitFloat(px, py, "+1", CROPS[c].art.fruit);
      commitTiles();
      return true;
    }
    case "can": {
      if (!t.tilled) return false;
      if (isWatered(t, now)) { toast("Already watered 💧", "warn"); return false; }
      t.wateredAt = now;
      if (t.crop) t.lastTick = now;
      set({ stats: { ...state.stats, watered: state.stats.watered + 1 } });
      emitFloat(px, py, "+1", "#7fd4f5");
      addXp(1, px, py - 6);
      commitTiles();
      return true;
    }
    case "scythe": {
      if (!t.crop) { toast("Nothing to harvest here", "warn"); return false; }
      if (isWithered(t, now)) {
        t.crop = null; t.plantedAt = null; t.grown = 0; t.lastTick = null;
        toast("Cleared withered crop 🥀", "warn");
        commitTiles();
        return true;
      }
      if (!isMature(t, now)) { toast("Not ripe yet — keep it watered 💧", "warn"); return false; }
      const c = t.crop;
      const def = CROPS[c];
      t.crop = null; t.plantedAt = null; t.grown = 0; t.lastTick = null; t.wateredAt = null;
      set({
        barn: { ...state.barn, [c]: state.barn[c] + 1 },
        stats: { ...state.stats, harvested: state.stats.harvested + 1 },
      });
      emitFloat(px, py, `+1`, def.art.fruit);
      addXp(def.xp, px, py - 8);
      commitTiles();
      return true;
    }
    case "hand": {
      if (t.crop && isMature(t, now)) return useToolWith("scythe", x, y);
      return false;
    }
  }
  return false;
}

function useToolWith(tool: ToolId, x: number, y: number) {
  const prev = state.tool;
  state.tool = tool;
  const r = useToolAt(x, y);
  state.tool = prev;
  return r;
}

/* ───────── economy ───────── */

export function buySeed(c: CropKind, qty = 1) {
  const def = CROPS[c];
  if (def.minLevel > state.level) return toast(`${def.name} unlocks at level ${def.minLevel}`, "warn");
  const cost = def.seedCost * qty;
  if (state.gold < cost) return toast("Not enough gold", "warn");
  set({ gold: state.gold - cost, seeds: { ...state.seeds, [c]: state.seeds[c] + qty } });
  toast(`Bought ${qty} × ${def.name} seed`, "ok");
}

export function sellCrop(c: CropKind, qty = 1) {
  if (state.barn[c] < qty) return toast("Nothing to sell", "warn");
  const g = CROPS[c].sell * qty;
  set({ gold: state.gold + g, barn: { ...state.barn, [c]: state.barn[c] - qty } });
  toast(`Sold ${qty} × ${CROPS[c].name} for ${g}G`, "ok");
}

export function sellAll() {
  let g = 0;
  const barn = { ...state.barn };
  for (const c of CROP_ORDER) { g += CROPS[c].sell * barn[c]; barn[c] = 0; }
  if (g === 0) return toast("Barn is empty", "warn");
  set({ gold: state.gold + g, barn });
  toast(`Sold everything for ${g}G 💰`, "ok");
}

export function deliverOrder(id: string) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  if (state.barn[o.crop] < o.qty) return toast(`Need ${o.qty} × ${CROPS[o.crop].name}`, "warn");
  const orders = state.orders.filter((x) => x.id !== id);
  orders.push(rollOrder(state.level, state.orderSeq));
  set({
    barn: { ...state.barn, [o.crop]: state.barn[o.crop] - o.qty },
    gold: state.gold + o.gold,
    orders, orderSeq: state.orderSeq + 1,
  });
  addXp(o.xp);
  toast(`Order complete! +${o.gold}G +${o.xp}XP 📦`, "ok");
}

function addXp(amount: number, fx?: number, fy?: number) {
  let lvl = state.level;
  let x = state.xp + amount;
  let leveled = false;
  const wasEligible = lvl >= MIN_POOL_LEVEL;
  while (lvl < MAX_LEVEL && x >= xpForNext(lvl)) { x -= xpForNext(lvl); lvl += 1; leveled = true; }
  if (lvl >= MAX_LEVEL) { lvl = MAX_LEVEL; x = 0; }
  set({ level: lvl, xp: x });
  if (fx != null && fy != null && amount > 0) emitFloat(fx, fy, `+${amount}XP`, "#b6f36b");
  if (leveled) {
    if (!wasEligible && lvl >= MIN_POOL_LEVEL) toast(`🎉 Level ${lvl}! Farmer's Pool unlocked`, "ok");
    else toast(`⬆️ Level ${lvl} — more land cleared`, "ok");
  }
}

/* ───────── Farmer's Pool ───────── */

export function poolStats() {
  const rivalPower = RIVALS.reduce((s, r) => s + r.power, 0);
  const total = rivalPower + state.poolPower;
  const pct = total > 0 ? (state.poolPower / total) * 100 : 0;
  // basis rate: PONS distributed per 1 Pool Power across the whole board
  const ratePerPower = total > 0 ? DAILY_POOL / total : 0;
  const estimate = state.poolPower * ratePerPower;
  return {
    rivalPower, total, pct, ratePerPower, estimate,
    eligible: state.level >= MIN_POOL_LEVEL,
  };
}

export function sacrificeGold(amount: number) {
  if (state.level < MIN_POOL_LEVEL) return toast(`Reach level ${MIN_POOL_LEVEL} to enter the pool`, "warn");
  if (state.gold < amount) return toast("Not enough gold", "warn");
  set({ gold: state.gold - amount, poolPower: state.poolPower + Math.floor(amount / 10) });
  toast(`Burned ${amount}G → +${Math.floor(amount / 10)} Pool Power`, "ok");
}

export function sacrificeLevel(levels: number) {
  if (state.level - levels < MIN_POOL_LEVEL) return toast(`Cannot drop below level ${MIN_POOL_LEVEL}`, "warn");
  set({ level: state.level - levels, xp: 0, poolPower: state.poolPower + levels * 120 });
  toast(`Burned ${levels} level(s) → +${levels * 120} Pool Power`, "ok");
}

export function claimPool() {
  const { estimate, eligible } = poolStats();
  if (!GATE_LIVE) return toast("Pool goes live once $PONSFARM is deployed", "warn");
  if (!eligible) return toast(`Reach level ${MIN_POOL_LEVEL} first`, "warn");
  if (state.poolPower <= 0) return toast("Add Pool Power first", "warn");
  const amt = Math.floor(estimate * 100) / 100;
  set({ farmToken: state.farmToken + amt, poolPower: 0 });
  toast(`Claimed ${amt} PONS 🌾`, "ok");
}

export function resetFarm() {
  state = freshState();
  emit();
  toast("Farm reset", "ok");
}
