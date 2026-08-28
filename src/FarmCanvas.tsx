import { useEffect, useRef } from "react";
import {
  getState, useToolAt, tickGrowth, idx, isUnlockedFarm,
  isWatered, isWithered, cropProgress, onFloat, setTool,
} from "./store";
import {
  CROPS, MAP_W, MAP_H, TILE, FARM_X0, FARM_Y0, tillableTiles,
} from "./harvest";
import {
  PAL, bakeFarmer, drawLegs, drawTool, drawCropSprite, drawTree, drawBush,
  drawRock, drawFlower, drawWeeds, drawStump, drawWell, drawHouse, drawBarn,
  drawShopStall, drawSilo, drawChicken, drawCow, drawScarecrow,
  drawPixelText, pixelTextWidth, circleFill,
  type Dir, type ToolKind,
} from "./px";

/* ═══════════════════════════════════════════════════════════
   FarmCanvas — pixel-art top-down farm, camera follows farmer
   • WASD / arrows / on-screen dpad to walk
   • Space or click a tile to use the equipped tool
   • 1..5 hotkeys swap tools
   ═══════════════════════════════════════════════════════════ */

const BASE_W = 300;   // reference art-pixel viewport (used to pick a scale)
const BASE_H = 190;
const SPEED = 62;     // art px / second
const REACH = 26;     // interaction reach in art px

// dynamic viewport (recomputed on resize so the canvas fills its container)
let VIEW_W = BASE_W;
let VIEW_H = BASE_H;

type Float = { x: number; y: number; text: string; color: string; born: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

export default function FarmCanvas({ onOpenPanel }: { onOpenPanel?: (p: string) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef(onOpenPanel);
  panelRef.current = onOpenPanel;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const art = bakeFarmer();

    /* ── static world layer (baked once, redrawn on level change) ── */
    const worldPx = { w: MAP_W * TILE, h: MAP_H * TILE };
    const bg = document.createElement("canvas");
    bg.width = worldPx.w; bg.height = worldPx.h;
    const bgx = bg.getContext("2d")!;
    let bakedLevel = -1;

    // deterministic decoration list
    let seed = 20260827;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    type Deco = { x: number; y: number; kind: string; s: number };
    const decos: Deco[] = [];
    {
      const st = getState();
      for (let i = 0; i < 220; i++) {
        const tx = 1 + Math.floor(rnd() * (MAP_W - 2));
        const ty = 1 + Math.floor(rnd() * (MAP_H - 2));
        const t = st.tiles[idx(tx, ty)];
        if (!t || t.kind !== "grass") continue;
        const inField = tx >= FARM_X0 - 1 && tx <= FARM_X0 + 12 && ty >= FARM_Y0 - 1 && ty <= FARM_Y0 + 8;
        if (inField) continue;
        const r = rnd();
        const kind = r < 0.16 ? "tree" : r < 0.3 ? "bush" : r < 0.42 ? "rock" : r < 0.72 ? "flower" : "stump";
        decos.push({ x: tx * TILE, y: ty * TILE + TILE, kind, s: Math.floor(rnd() * 4) });
      }
    }

    function bakeGround(level: number) {
      const st = getState();
      bgx.imageSmoothingEnabled = false;
      // grass base with subtle noise
      for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
          const t = st.tiles[idx(tx, ty)];
          const X = tx * TILE, Y = ty * TILE;
          // base grass
          bgx.fillStyle = (tx + ty) % 2 ? PAL.grass1 : PAL.grass2;
          bgx.fillRect(X, Y, TILE, TILE);
          // grass texture tufts
          bgx.fillStyle = PAL.grass3;
          const h1 = ((tx * 7 + ty * 13) % 5);
          bgx.fillRect(X + 2 + h1, Y + 3 + ((tx + ty) % 6), 1, 2);
          bgx.fillRect(X + 9 - h1, Y + 10 - ((tx * 3 + ty) % 5), 1, 2);

          if (t.kind === "path") {
            bgx.fillStyle = PAL.path1; bgx.fillRect(X, Y, TILE, TILE);
            bgx.fillStyle = PAL.path2;
            for (let i = 0; i < 6; i++) {
              const px = X + ((tx * 5 + i * 3 + ty) % TILE);
              const py = Y + ((ty * 7 + i * 5 + tx) % TILE);
              bgx.fillRect(px, py, 2, 1);
            }
            // edge shading against grass
            bgx.fillStyle = PAL.pathEdge;
            if (st.tiles[idx(tx, ty - 1)]?.kind !== "path") bgx.fillRect(X, Y, TILE, 1);
            if (st.tiles[idx(tx, ty + 1)]?.kind !== "path") bgx.fillRect(X, Y + TILE - 1, TILE, 1);
            if (st.tiles[idx(tx - 1, ty)]?.kind !== "path") bgx.fillRect(X, Y, 1, TILE);
            if (st.tiles[idx(tx + 1, ty)]?.kind !== "path") bgx.fillRect(X + TILE - 1, Y, 1, TILE);
          } else if (t.kind === "water") {
            bgx.fillStyle = PAL.water2; bgx.fillRect(X, Y, TILE, TILE);
            bgx.fillStyle = PAL.water1; bgx.fillRect(X, Y + 2, TILE, TILE - 4);
            bgx.fillStyle = PAL.waterFoam;
            bgx.fillRect(X + 3 + ((tx * 3) % 5), Y + 5, 3, 1);
            bgx.fillRect(X + 8 - ((ty * 2) % 4), Y + 10, 2, 1);
            // shoreline
            const around = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
            bgx.fillStyle = "#c9b183";
            for (const [dx, dy] of around) {
              if (st.tiles[idx(tx + dx, ty + dy)]?.kind !== "water") {
                if (dy === -1) bgx.fillRect(X, Y, TILE, 2);
                if (dy === 1) bgx.fillRect(X, Y + TILE - 2, TILE, 2);
                if (dx === -1) bgx.fillRect(X, Y, 2, TILE);
                if (dx === 1) bgx.fillRect(X + TILE - 2, Y, 2, TILE);
              }
            }
          }
        }
      }

      // wild (locked) farmland: darker grass + scrub so the field reads as expandable
      for (let ty = FARM_Y0; ty < FARM_Y0 + 8; ty++)
        for (let tx = FARM_X0; tx < FARM_X0 + 12; tx++) {
          if (isUnlockedFarm(tx, ty, level)) continue;
          const X = tx * TILE, Y = ty * TILE;
          bgx.fillStyle = "#4a7f36"; bgx.fillRect(X, Y, TILE, TILE);
          bgx.fillStyle = "#3d6d2c";
          bgx.fillRect(X + 2, Y + 4, 2, 5); bgx.fillRect(X + 9, Y + 8, 2, 5);
          bgx.fillStyle = "#5c6b3a"; bgx.fillRect(X + 6, Y + 2, 1, 4);
        }

      // fence around the whole unlocked field
      const { cols, rows } = tillableTiles(level);
      bgx.fillStyle = PAL.woodDark;
      const fx = FARM_X0 * TILE - 3, fy = FARM_Y0 * TILE - 3;
      const fw = cols * TILE + 6, fh = rows * TILE + 6;
      bgx.fillRect(fx, fy, fw, 2); bgx.fillRect(fx, fy + fh - 2, fw, 2);
      bgx.fillRect(fx, fy, 2, fh); bgx.fillRect(fx + fw - 2, fy, 2, fh);
      bgx.fillStyle = PAL.wood;
      for (let x = fx; x < fx + fw; x += 12) { bgx.fillRect(x, fy - 3, 2, 7); bgx.fillRect(x, fy + fh - 4, 2, 7); }
      for (let y = fy; y < fy + fh; y += 12) { bgx.fillRect(fx - 2, y, 6, 2); bgx.fillRect(fx + fw - 4, y, 6, 2); }

      // outer world border fence
      bgx.fillStyle = PAL.woodDark;
      bgx.fillRect(0, TILE - 4, worldPx.w, 4);
      bgx.fillRect(0, worldPx.h - TILE, worldPx.w, 4);
      bgx.fillRect(TILE - 4, 0, 4, worldPx.h);
      bgx.fillRect(worldPx.w - TILE, 0, 4, worldPx.h);
      bgx.fillStyle = PAL.wood;
      for (let x = 0; x < worldPx.w; x += 16) {
        bgx.fillRect(x, TILE - 8, 3, 12);
        bgx.fillRect(x, worldPx.h - TILE - 4, 3, 12);
      }
      for (let y = 0; y < worldPx.h; y += 16) {
        bgx.fillRect(TILE - 8, y, 12, 3);
        bgx.fillRect(worldPx.w - TILE - 4, y, 12, 3);
      }

      bakedLevel = level;
    }

    /* ── canvas sizing: fill the container, integer upscale, crisp pixels ── */
    let scale = 3;
    function resize() {
      const parent = canvas.parentElement!;
      const availW = Math.max(240, parent.clientWidth);
      const availH = Math.max(240, parent.clientHeight);
      // pick the largest integer scale that keeps the reference viewport visible
      scale = Math.max(2, Math.min(Math.floor(availW / BASE_W), Math.floor(availH / BASE_H)));
      // derive the actual art-pixel viewport from the real container so the
      // canvas fills all available space (no letterboxing / fixed frame)
      VIEW_W = Math.ceil(availW / scale);
      VIEW_H = Math.ceil(availH / scale);
      // clamp so we never show more world than exists
      VIEW_W = Math.min(VIEW_W, worldPx.w);
      VIEW_H = Math.min(VIEW_H, worldPx.h);
      // keep the viewport EVEN so the player (locked at VIEW/2) sits on a whole
      // pixel — an odd viewport parks the sprite on a half-pixel and softens it.
      VIEW_W -= VIEW_W % 2;
      VIEW_H -= VIEW_H % 2;
      canvas.width = VIEW_W * scale;
      canvas.height = VIEW_H * scale;
      canvas.style.width = `${VIEW_W * scale}px`;
      canvas.style.height = `${VIEW_H * scale}px`;
      ctx.imageSmoothingEnabled = false;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    window.addEventListener("resize", resize);

    /* ── player ── */
    const player = {
      x: 20 * TILE + 8, y: 10 * TILE + 8,
      px: 20 * TILE + 8, py: 10 * TILE + 8,   // previous sim position (for interpolation)
      dir: "down" as Dir, moving: false, step: 0,
      swing: 0,       // 0 = idle, >0 tool animation running
    };
    const keys = new Set<string>();
    let walkTarget: { x: number; y: number } | null = null;
    let queuedTile: { x: number; y: number } | null = null;

    const floats: Float[] = [];
    const parts: Particle[] = [];
    const offFloat = onFloat((x, y, text, color) => {
      floats.push({ x, y, text, color, born: performance.now() });
      const col = color;
      for (let i = 0; i < 8; i++)
        parts.push({
          x, y: y + 6, vx: (Math.random() - 0.5) * 26, vy: -18 - Math.random() * 22,
          life: 0.5 + Math.random() * 0.35, color: col, size: Math.random() < 0.5 ? 1 : 2,
        });
    });

    /* ── input ── */
    const MOVE_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.includes(k)) { keys.add(k); walkTarget = null; queuedTile = null; e.preventDefault(); }
      if (k === " " || k === "e") { act(); e.preventDefault(); }
      const tools = ["hoe", "seed", "can", "scythe", "hand"] as const;
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 5) { setTool(tools[n - 1]); e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // expose dpad control for the on-screen buttons
    (window as any).__farmDpad = (dir: Dir | null, down: boolean) => {
      const map: Record<Dir, string> = { up: "w", down: "s", left: "a", right: "d" };
      if (!dir) { keys.clear(); return; }
      if (down) { keys.add(map[dir]); walkTarget = null; } else keys.delete(map[dir]);
    };
    (window as any).__farmAct = () => act();

    /* camera */
    const cam = { x: player.x - VIEW_W / 2, y: player.y - VIEW_H / 2 };

    function screenToWorld(ev: PointerEvent) {
      const r = canvas.getBoundingClientRect();
      const sx = (ev.clientX - r.left) / r.width * VIEW_W;
      const sy = (ev.clientY - r.top) / r.height * VIEW_H;
      return { x: sx + cam.x, y: sy + cam.y };
    }

    const onPointerDown = (ev: PointerEvent) => {
      const w = screenToWorld(ev);
      const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
      const dist = Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y);
      if (dist <= REACH) {
        useToolAt(tx, ty);
        player.swing = 1;
      } else {
        // walk toward it, then act
        walkTarget = { x: tx * TILE + 8, y: ty * TILE + 14 };
        queuedTile = { x: tx, y: ty };
      }
    };
    canvas.addEventListener("pointerdown", onPointerDown);

    /** tile the farmer is standing on */
    function underTile() {
      return { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
    }
    /** tile directly in front of the farmer */
    function facingTile() {
      const off: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = off[player.dir];
      const u = underTile();
      return { tx: u.tx + dx, ty: u.ty + dy };
    }

    function act() {
      // 1) the tile under the feet (what the highlight shows)
      const u = underTile();
      if (useToolAt(u.tx, u.ty)) { player.swing = 1; return; }
      // 2) fall back to the tile in front, so fences/edges still work
      const f = facingTile();
      useToolAt(f.tx, f.ty);
      player.swing = 1;
    }

    /* ── collision ── */
    function solid(px: number, py: number) {
      const st = getState();
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return true;
      const t = st.tiles[idx(tx, ty)];
      if (!t) return true;
      if (t.kind === "blocked" || t.kind === "water") return true;
      return false;
    }
    function tryMove(nx: number, ny: number) {
      // feet-based box collision (player is 14 wide, feet at y)
      const fx = 4, fy = 2;
      if (!solid(nx - fx, player.y + fy) && !solid(nx + fx, player.y + fy)) player.x = nx;
      if (!solid(player.x - fx, ny + fy) && !solid(player.x + fx, ny + fy)) player.y = ny;
    }

    /* ── loop: fixed-timestep sim + interpolated render (kills jitter) ── */
    let raf = 0, last = performance.now(), acc = 0, tGrow = 0;
    const STEP = 1 / 60;               // simulate at a rock-steady 60 Hz
    function frame(now: number) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;        // clamp after tab-switch to avoid spiral
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) { update(STEP); acc -= STEP; steps++; }
      // fractional progress toward the next sim step — used to interpolate the
      // player + camera so motion is buttery on any refresh rate (60/120/144Hz).
      const alpha = acc / STEP;
      render(now, alpha);
      raf = requestAnimationFrame(frame);
    }

    function update(dt: number) {
      const st = getState();
      if (bakedLevel !== st.level) bakeGround(st.level);

      // remember where we were so render() can interpolate between sim steps
      player.px = player.x; player.py = player.y;

      tGrow += dt;
      if (tGrow > 0.4) { tickGrowth(Date.now()); tGrow = 0; }

      let dx = 0, dy = 0;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;

      if (dx === 0 && dy === 0 && walkTarget) {
        const tx = walkTarget.x - player.x, ty = walkTarget.y - player.y;
        const d = Math.hypot(tx, ty);
        if (d < 3) {
          walkTarget = null;
          if (queuedTile) { useToolAt(queuedTile.x, queuedTile.y); player.swing = 1; queuedTile = null; }
        } else { dx = tx / d; dy = ty / d; }
      }

      player.moving = dx !== 0 || dy !== 0;
      if (player.moving) {
        const l = Math.hypot(dx, dy) || 1;
        tryMove(player.x + (dx / l) * SPEED * dt, player.y + (dy / l) * SPEED * dt);
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? "right" : "left";
        else if (dy !== 0) player.dir = dy > 0 ? "down" : "up";
        player.step += dt * 7.5;
      }

      if (player.swing > 0) player.swing = Math.max(0, player.swing - dt * 3.2);

      // camera target locks to the player; the actual smoothing/interp happens
      // at render time (see the alpha-blended cam below) so there's zero jitter.
      cam.x = Math.max(0, Math.min(worldPx.w - VIEW_W, player.x - VIEW_W / 2));
      cam.y = Math.max(0, Math.min(worldPx.h - VIEW_H, player.y - VIEW_H / 2));

      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      // floats expire
      const nowMs2 = performance.now();
      for (let i = floats.length - 1; i >= 0; i--)
        if (nowMs2 - floats[i].born > 1100) floats.splice(i, 1);
    }

    function render(now: number, alpha = 1) {
      const st = getState();
      const nowMs = Date.now();

      // interpolate the player between the last two sim steps so motion is
      // perfectly smooth regardless of the display's refresh rate.
      const ipx = player.px + (player.x - player.px) * alpha;
      const ipy = player.py + (player.y - player.py) * alpha;

      // camera follows the interpolated player, clamped to the world bounds.
      const camWorldX = Math.max(0, Math.min(worldPx.w - VIEW_W, ipx - VIEW_W / 2));
      const camWorldY = Math.max(0, Math.min(worldPx.h - VIEW_H, ipy - VIEW_H / 2));

      // pixel-perfect smooth scroll: integer camera for world math, fractional
      // remainder applied as a sub-pixel translate so scrolling is buttery.
      const camX = Math.floor(camWorldX), camY = Math.floor(camWorldY);
      const fracX = camWorldX - camX, fracY = camWorldY - camY;

      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-fracX, -fracY);
      ctx.imageSmoothingEnabled = false;

      // ground layer
      ctx.drawImage(bg, -camX, -camY);

      const sway = Math.sin(now / 620) * 1.2;

      // ── tilled soil + crops (only visible tiles; +1 margin for sub-pixel scroll) ──
      const tx0 = Math.max(0, Math.floor(camX / TILE)), tx1 = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W + 1) / TILE));
      const ty0 = Math.max(0, Math.floor(camY / TILE)), ty1 = Math.min(MAP_H - 1, Math.ceil((camY + VIEW_H + 1) / TILE));

      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = st.tiles[idx(tx, ty)];
          if (!t) continue;
          const X = tx * TILE - camX, Y = ty * TILE - camY;

          if (t.tilled) {
            const wet = isWatered(t, nowMs);
            ctx.fillStyle = wet ? PAL.soilWet1 : PAL.soilDry;
            ctx.fillRect(X, Y, TILE, TILE);
            ctx.fillStyle = wet ? PAL.soilWet2 : PAL.soil2;
            ctx.fillRect(X, Y + 1, TILE, TILE - 2);
            // furrow rows
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            ctx.fillRect(X, Y + 4, TILE, 1);
            ctx.fillRect(X, Y + 9, TILE, 1);
            ctx.fillRect(X, Y + 14, TILE, 1);
            // clod highlights
            ctx.fillStyle = wet ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.09)";
            ctx.fillRect(X + 2 + ((tx * 3) % 4), Y + 2, 2, 1);
            ctx.fillRect(X + 9 - ((ty * 2) % 3), Y + 11, 2, 1);
            if (wet) {
              ctx.fillStyle = "rgba(90,180,235,0.20)";
              ctx.fillRect(X, Y, TILE, TILE);
            }
          }

          if (t.weeds) drawWeeds(ctx, X, Y + TILE);

          if (t.crop) {
            const prog = cropProgress(t, nowMs);
            const withered = isWithered(t, nowMs);
            const stage: 0 | 1 | 2 | 3 = prog >= 1 ? 3 : prog > 0.6 ? 2 : prog > 0.22 ? 1 : 0;
            drawCropSprite(ctx, X, Y, CROPS[t.crop].art, stage, withered, sway);
            if (prog >= 1 && !withered) {
              // ready sparkle
              const b = Math.sin(now / 200) > 0 ? 1 : 0;
              ctx.fillStyle = b ? "#fff8b0" : "#ffe45c";
              ctx.fillRect(X + 12, Y + 1, 1, 1);
              ctx.fillRect(X + 3, Y + 3, 1, 1);
            } else if (!isWatered(t, nowMs) && !withered) {
              // thirsty marker
              ctx.fillStyle = "rgba(0,0,0,0.35)";
              ctx.fillRect(X + 6, Y - 5, 5, 5);
              ctx.fillStyle = "#7fd4f5";
              ctx.fillRect(X + 8, Y - 4, 1, 2);
              ctx.fillRect(X + 7, Y - 2, 3, 1);
            }
          }
        }
      }

      /* ── buildings & props (y-sorted with the player) ── */
      type Drawable = { y: number; fn: () => void };
      const q: Drawable[] = [];

      const push = (y: number, fn: () => void) => q.push({ y, fn });

      // decorations
      for (const d of decos) {
        const X = d.x - camX, Y = d.y - camY;
        if (X < -40 || X > VIEW_W + 40 || Y < -50 || Y > VIEW_H + 50) continue;
        if (d.kind === "tree") push(d.y, () => drawTree(ctx, X, Y, d.s));
        else if (d.kind === "bush") push(d.y, () => drawBush(ctx, X, Y));
        else if (d.kind === "rock") push(d.y, () => drawRock(ctx, X, Y));
        else if (d.kind === "flower") push(d.y, () => drawFlower(ctx, X, Y, d.s));
        else push(d.y, () => drawStump(ctx, X, Y));
      }

      // structures (world coords → bottom anchored)
      push((4 + 3) * TILE, () => drawHouse(ctx, 3 * TILE - camX, (4 + 3) * TILE - camY));
      push((4 + 3) * TILE + 1, () => drawBarn(ctx, 24 * TILE - camX, (4 + 3) * TILE - camY));
      push((6 + 2) * TILE, () => drawShopStall(ctx, 14 * TILE - camX, (6 + 2) * TILE - camY));
      push((3 + 4) * TILE, () => drawSilo(ctx, 30 * TILE - camX, (3 + 4) * TILE - camY));
      push((3 + 2) * TILE, () => drawWell(ctx, 11 * TILE - camX, (3 + 2) * TILE - camY));
      push((FARM_Y0 - 1) * TILE, () => drawScarecrow(ctx, (FARM_X0 + 13) * TILE - camX, (FARM_Y0 + 1) * TILE - camY));

      // animals wandering (deterministic loops)
      const af = Math.floor(now / 300);
      const chick = (bx: number, by: number, ph: number) => {
        const t = now / 1000 + ph;
        const ox = Math.sin(t * 0.6) * 14, oy = Math.cos(t * 0.45) * 8;
        const wx = bx * TILE + ox, wy = by * TILE + oy;
        push(wy, () => drawChicken(ctx, wx - camX, wy - camY, af));
      };
      chick(28, 12, 0); chick(30, 14, 2.1); chick(27, 15, 4.2);
      const cowT = now / 1000;
      const cwx = 5 * TILE + Math.sin(cowT * 0.25) * 22, cwy = 22 * TILE + Math.cos(cowT * 0.2) * 10;
      push(cwy, () => drawCow(ctx, cwx - camX, cwy - camY, Math.floor(now / 420)));
      const cwx2 = 8 * TILE + Math.sin(cowT * 0.19 + 2) * 18, cwy2 = 25 * TILE;
      push(cwy2, () => drawCow(ctx, cwx2 - camX, cwy2 - camY, Math.floor(now / 500)));

      // the farmer (draw at the interpolated position for silky movement)
      push(ipy, () => drawPlayer(ipx, ipy, camX, camY));

      q.sort((a, b) => a.y - b.y);
      for (const d of q) d.fn();

      /* ── target highlight on the tile under the farmer ── */
      const { tx, ty } = underTile();
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) {
        const t = st.tiles[idx(tx, ty)];
        const X = tx * TILE - camX, Y = ty * TILE - camY;
        const canAct = t && t.kind !== "blocked";
        ctx.strokeStyle = canAct ? "rgba(255,248,176,0.9)" : "rgba(255,90,80,0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(X + 0.5, Y + 0.5, TILE - 1, TILE - 1);
      }

      /* ── particles ── */
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* ── floating text ── */
      for (const f of floats) {
        const age = (now - f.born) / 1100;
        const y = f.y - camY - 8 - age * 14;
        const x = Math.round(f.x - camX - pixelTextWidth(f.text) / 2);
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = "rgba(20,14,8,0.55)";
        ctx.fillRect(x - 1, Math.round(y) - 1, pixelTextWidth(f.text) + 2, 7);
        drawPixelText(ctx, f.text, x, Math.round(y), f.color);
        ctx.globalAlpha = 1;
      }

      /* ── vignette for depth (oversized by 2px to hide the sub-pixel scroll edge) ── */
      const grd = ctx.createLinearGradient(0, -1, 0, VIEW_H + 1);
      grd.addColorStop(0, "rgba(0,0,0,0.10)");
      grd.addColorStop(0.35, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.13)");
      ctx.fillStyle = grd;
      ctx.fillRect(-2, -2, VIEW_W + 4, VIEW_H + 4);

      /* ── mini compass hint on locked land ── */
      ctx.restore();
    }

    function drawPlayer(ipx: number, ipy: number, camX: number, camY: number) {
      // use the interpolated world position + the SAME floored camera as render()
      // so the sub-pixel translate keeps everything aligned and jitter-free.
      const sx = Math.round((ipx - camX) - 7);
      const sy = Math.round((ipy - camY) - 19);
      const frame = Math.floor(player.step) % 4;
      const bob = player.moving && (frame === 1 || frame === 3) ? 1 : 0;

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      circleFill(ctx, sx + 7, sy + 21, 5);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      circleFill(ctx, sx + 7, sy + 21, 6);

      drawLegs(ctx, sx, sy - bob, player.dir, frame, player.moving);
      const spr = art.body[player.dir];
      ctx.drawImage(spr, sx, sy - bob);

      const st = getState();
      const tool = st.tool as ToolKind;
      const swingPhase = player.swing > 0 ? 1 - player.swing : 0;
      drawTool(ctx, sx, sy - bob, player.dir, tool, swingPhase);

      // seed held: show the crop colour in hand
      if (st.tool === "seed") {
        const c = CROPS[st.sel].art.fruit;
        ctx.fillStyle = c;
        const hx = player.dir === "left" ? sx + 1 : player.dir === "right" ? sx + 11 : sx + 10;
        ctx.fillRect(hx, sy + 12 - bob, 2, 2);
      }
    }

    bakeGround(getState().level);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      offFloat();
      delete (window as any).__farmDpad;
      delete (window as any).__farmAct;
    };
  }, []);

  return <canvas ref={ref} className="farm-canvas" />;
}
