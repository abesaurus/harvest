import { useEffect, useRef } from "react";
import {
  getState, plant, harvestPlot, onToast,
} from "./store";
import { CROPS, GROW_MS, unlockedPlots, type CropKind } from "./harvest";

/* ═══════════════════════════════════════════════════════════
   FarmCanvas — top-down walkable farm (FarmTown style)
   • WASD / Arrow keys to walk, or click to walk to a spot
   • Stand next to a plot and press E / Space to plant or harvest
   • Click directly on a plot to auto-walk there and interact
   Renders the 12 store plots as tilled soil tiles on a field.
   ═══════════════════════════════════════════════════════════ */

const TILE = 84;          // plot cell size in px
const COLS = 4;
const ROWS = 3;           // 4 x 3 = 12 plots (== MAX_PLOTS)
const REACH = 78;         // how close the farmer must be to interact
const SPEED = 210;        // px / second

type Dir = "down" | "up" | "left" | "right";

export default function FarmCanvas({ sel }: { sel: CropKind }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selRef = useRef<CropKind>(sel);
  selRef.current = sel;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // world size (field). Plots grid centered with margin for walking around.
    const MARGIN_X = TILE * 0.9;
    const MARGIN_TOP = TILE * 1.15;
    const MARGIN_BOT = TILE * 1.0;
    const W = COLS * TILE + MARGIN_X * 2;
    const H = ROWS * TILE + MARGIN_TOP + MARGIN_BOT;

    function resize() {
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = "100%";
      canvas.style.aspectRatio = `${W} / ${H}`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    // plot i -> world rect (top-left)
    function plotRect(i: number) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      return {
        x: MARGIN_X + c * TILE,
        y: MARGIN_TOP + r * TILE,
        cx: MARGIN_X + c * TILE + TILE / 2,
        cy: MARGIN_TOP + r * TILE + TILE / 2,
      };
    }

    // ── farmer state ──
    const player = {
      x: W / 2,
      y: H - MARGIN_BOT * 0.4,
      dir: "up" as Dir,
      moving: false,
      step: 0, // walk-cycle phase
    };
    const keys = new Set<string>();
    let target: { x: number; y: number } | null = null;
    let pendingPlot: number | null = null;

    // ── input ──
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        keys.add(k);
        target = null; pendingPlot = null; // manual walking cancels click-walk
        e.preventDefault();
      }
      if (k === "e" || k === " ") { interactNearest(); e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // click → walk (and auto-interact if it's a plot)
    function pointerToWorld(ev: PointerEvent) {
      const r = canvas.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    }
    const onPointerDown = (ev: PointerEvent) => {
      const p = pointerToWorld(ev);
      const open = unlockedPlots(getState().level);
      pendingPlot = null;
      for (let i = 0; i < COLS * ROWS; i++) {
        const pr = plotRect(i);
        if (p.x >= pr.x && p.x <= pr.x + TILE && p.y >= pr.y && p.y <= pr.y + TILE) {
          if (i < open) { pendingPlot = i; target = standSpot(i); }
          return;
        }
      }
      target = { x: clamp(p.x, 24, W - 24), y: clamp(p.y, 40, H - 24) };
    };
    canvas.addEventListener("pointerdown", onPointerDown);

    // a spot just below a plot to stand while working it
    function standSpot(i: number) {
      const pr = plotRect(i);
      return { x: pr.cx, y: Math.min(pr.cy + TILE * 0.55, H - 22) };
    }

    function nearestPlot(): number | null {
      const open = unlockedPlots(getState().level);
      let best: number | null = null, bestD = REACH;
      for (let i = 0; i < open; i++) {
        const pr = plotRect(i);
        const d = Math.hypot(pr.cx - player.x, pr.cy - player.y);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    function interactPlot(i: number) {
      const st = getState();
      const p = st.plots[i];
      if (!p.plantedAt) {
        plant(i, selRef.current);
      } else if (Date.now() - p.plantedAt >= GROW_MS) {
        harvestPlot(i);
      }
    }
    function interactNearest() {
      const i = nearestPlot();
      if (i != null) interactPlot(i);
    }

    // ── main loop ──
    let raf = 0;
    let last = performance.now();
    function frame(t: number) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function update(dt: number) {
      let dx = 0, dy = 0;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;

      if (dx === 0 && dy === 0 && target) {
        const tx = target.x - player.x, ty = target.y - player.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 4) {
          target = null;
          if (pendingPlot != null) { interactPlot(pendingPlot); pendingPlot = null; }
        } else { dx = tx / dist; dy = ty / dist; }
      }

      const len = Math.hypot(dx, dy) || 1;
      player.moving = dx !== 0 || dy !== 0;
      if (player.moving) {
        player.x = clamp(player.x + (dx / len) * SPEED * dt, 20, W - 20);
        player.y = clamp(player.y + (dy / len) * SPEED * dt, 34, H - 18);
        if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? "right" : "left";
        else player.dir = dy > 0 ? "down" : "up";
        player.step += dt * 9;
      } else player.step = 0;
    }

    function draw() {
      const now = Date.now();
      const st = getState();
      const open = unlockedPlots(st.level);
      ctx.clearRect(0, 0, W, H);

      // grass base + checker
      ctx.fillStyle = "#6cbf49";
      ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 28)
        for (let x = 0; x < W; x += 28) {
          if (((x / 28) + (y / 28)) % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.045)";
            ctx.fillRect(x, y, 28, 28);
          }
        }

      // wooden fence border
      drawFence(W, H);

      const active = nearestPlot();

      // plots
      for (let i = 0; i < COLS * ROWS; i++) {
        const pr = plotRect(i);
        const locked = i >= open;
        drawPlot(pr.x, pr.y, locked, i === active && !locked);
        if (locked) continue;

        const p = st.plots[i];
        if (p.plantedAt && p.crop) {
          const prog = Math.min(1, (now - p.plantedAt) / GROW_MS);
          const mature = prog >= 1;
          drawCrop(pr.cx, pr.y + TILE * 0.62, p.crop, prog);
          // growth bar
          if (!mature) {
            const bw = TILE * 0.62, bx = pr.cx - bw / 2, by = pr.y + TILE - 12;
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            roundRect(bx, by, bw, 6, 3); ctx.fill();
            ctx.fillStyle = "#ffd93d";
            roundRect(bx, by, bw * prog, 6, 3); ctx.fill();
          } else {
            bubble(pr.cx, pr.y + 6, "READY");
          }
        }
      }

      // interaction prompt above active plot
      if (active != null) {
        const pr = plotRect(active);
        const p = st.plots[active];
        let label = "";
        if (!p.plantedAt) label = `E · plant ${CROPS[selRef.current].name}`;
        else if (now - (p.plantedAt || 0) >= GROW_MS) label = "E · harvest 🌾";
        else label = "growing…";
        if (label) bubble(pr.cx, pr.y - 8, label);
      }

      drawFarmer(player);
    }

    /* ── drawing helpers ── */
    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawFence(w: number, h: number) {
      ctx.fillStyle = "#8a5a2a";
      const t = 10;
      ctx.fillRect(0, 0, w, t);
      ctx.fillRect(0, h - t, w, t);
      ctx.fillRect(0, 0, t, h);
      ctx.fillRect(w - t, 0, t, h);
      ctx.fillStyle = "#a5703a";
      for (let x = 8; x < w - 8; x += 34) { ctx.fillRect(x, 2, 6, 16); ctx.fillRect(x, h - 18, 6, 16); }
      for (let y = 8; y < h - 8; y += 34) { ctx.fillRect(2, y, 16, 6); ctx.fillRect(w - 18, y, 16, 6); }
    }

    function drawPlot(x: number, y: number, locked: boolean, hi: boolean) {
      const pad = 6, s = TILE - pad * 2;
      if (locked) {
        ctx.fillStyle = "#4f8f34";
        roundRect(x + pad, y + pad, s, s, 10); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.font = "30px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🔒", x + TILE / 2, y + TILE / 2);
        return;
      }
      // tilled soil
      ctx.fillStyle = "#6b4423";
      roundRect(x + pad, y + pad, s, s, 10); ctx.fill();
      ctx.fillStyle = "#7d5029";
      roundRect(x + pad + 2, y + pad + 2, s - 4, s - 4, 8); ctx.fill();
      // furrows
      ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 3;
      for (let r = 1; r <= 3; r++) {
        const yy = y + pad + (s / 4) * r;
        ctx.beginPath(); ctx.moveTo(x + pad + 6, yy); ctx.lineTo(x + pad + s - 6, yy); ctx.stroke();
      }
      if (hi) {
        ctx.strokeStyle = "#fff2a8"; ctx.lineWidth = 3;
        roundRect(x + pad - 1, y + pad - 1, s + 2, s + 2, 11); ctx.stroke();
      }
    }

    function drawCrop(cx: number, cy: number, crop: CropKind, prog: number) {
      // stage emoji scaled by growth
      const stages = CROPS[crop].stages;
      const stage = prog < 0.4 ? 0 : prog < 1 ? 1 : 2;
      const size = 22 + prog * 22;
      ctx.font = `${size}px system-ui`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // little shadow
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.42, size * 0.32, size * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(stages[stage], cx, cy);
    }

    function bubble(cx: number, cy: number, text: string) {
      ctx.font = "600 12px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = "rgba(24,18,10,0.85)";
      roundRect(cx - w / 2, cy - 20, w, 18, 9); ctx.fill();
      ctx.fillStyle = "#ffe9a8";
      ctx.fillText(text, cx, cy - 11);
    }

    function drawFarmer(p: typeof player) {
      const x = Math.round(p.x), y = Math.round(p.y);
      const bob = p.moving ? Math.sin(p.step) * 2 : 0;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.ellipse(x, y + 14, 13, 5, 0, 0, Math.PI * 2); ctx.fill();

      const legSwing = p.moving ? Math.sin(p.step) * 3 : 0;
      // legs
      ctx.fillStyle = "#3a5cc4";
      ctx.fillRect(x - 6, y + 4 - bob, 5, 10 + legSwing);
      ctx.fillRect(x + 1, y + 4 - bob, 5, 10 - legSwing);
      // body (overalls)
      ctx.fillStyle = "#2f7ed8";
      roundRect(x - 9, y - 12 - bob, 18, 18, 5); ctx.fill();
      ctx.fillStyle = "#e9552f"; // shirt collar
      ctx.fillRect(x - 9, y - 12 - bob, 18, 5);
      // arms
      ctx.fillStyle = "#f0c39a";
      ctx.fillRect(x - 12, y - 9 - bob, 4, 11);
      ctx.fillRect(x + 8, y - 9 - bob, 4, 11);
      // head
      ctx.fillStyle = "#f6cfa2";
      roundRect(x - 8, y - 26 - bob, 16, 15, 6); ctx.fill();
      // straw hat
      ctx.fillStyle = "#e3b23c";
      ctx.beginPath(); ctx.ellipse(x, y - 24 - bob, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c8971f";
      roundRect(x - 7, y - 33 - bob, 14, 9, 4); ctx.fill();
      // face (eyes) by direction
      ctx.fillStyle = "#3a2a1a";
      if (p.dir !== "up") {
        const off = p.dir === "left" ? -2 : p.dir === "right" ? 2 : 0;
        ctx.fillRect(x - 4 + off, y - 20 - bob, 2, 2);
        ctx.fillRect(x + 3 + off, y - 20 - bob, 2, 2);
      }
    }

    function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

    raf = requestAnimationFrame(frame);
    const offToast = onToast(() => {}); // keep store warm (no-op subscribe)

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      offToast();
    };
  }, []);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} className="farm-canvas" />
      <div className="canvas-help">
        <span><b>WASD</b> / <b>arrows</b> to walk</span>
        <span><b>Click</b> a plot to walk there</span>
        <span><b>E</b> / <b>Space</b> to plant &amp; harvest</span>
      </div>
    </div>
  );
}
