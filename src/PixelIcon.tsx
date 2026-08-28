import { useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   PixelIcon — crisp pixel-art scene icons baked to a canvas.
   Uses the SAME visual language as the in-game sprites (soil,
   cans, crops, coins) so the landing page matches the game.
   Each scene is authored on a 24×24 logical grid, then upscaled
   with image smoothing OFF for authentic pixel art.
   ═══════════════════════════════════════════════════════════ */

export type IconKind =
  | "till" | "water" | "harvest" | "sell" | "earn"   // loop steps
  | "plant" | "living" | "pool";                     // feature cards

const U = 24; // logical grid

type P = (x: number, y: number, w: number, h: number, c: string) => void;

const PAINTERS: Record<IconKind, (p: P, g: CanvasRenderingContext2D) => void> = {
  /* ── TILL & PLANT — tilled soil mound with a fresh green sprout ── */
  till: (p) => {
    // soil mound
    p(2, 15, 20, 8, "#8c5f38");
    p(2, 15, 20, 2, "#a56f42");   // sun-lit top
    p(2, 21, 20, 2, "#5a3a20");   // shaded base
    // furrow ridges
    p(6, 16, 1, 6, "#6b4526");
    p(11, 16, 1, 6, "#6b4526");
    p(16, 16, 1, 6, "#6b4526");
    // stem
    p(11, 7, 2, 9, "#3f8f36");
    // leaves
    p(6, 8, 4, 2, "#4fa843");
    p(5, 6, 3, 3, "#67c257");
    p(14, 8, 4, 2, "#4fa843");
    p(16, 6, 3, 3, "#67c257");
    // top bud
    p(10, 4, 4, 4, "#67c257");
    p(11, 2, 2, 3, "#8fe06a");
    p(11, 3, 1, 1, "#c8ffa8");    // highlight
  },

  /* ── WATER — metal watering can tipping, blue stream + droplets ── */
  water: (p) => {
    // can body
    p(5, 10, 10, 8, "#9aa0a8");
    p(5, 10, 10, 2, "#b8bec6");   // top light
    p(5, 16, 10, 2, "#767c85");   // bottom shade
    // handle
    p(7, 6, 6, 2, "#b8bec6");
    p(6, 7, 2, 3, "#9aa0a8");
    p(12, 7, 2, 3, "#9aa0a8");
    // spout
    p(15, 12, 4, 2, "#9aa0a8");
    p(18, 10, 2, 2, "#b8bec6");
    // rose (spout head)
    p(19, 9, 3, 2, "#767c85");
    // water stream + droplets
    p(20, 12, 1, 3, "#7fd4f5");
    p(21, 15, 1, 2, "#bfe6f7");
    p(19, 16, 1, 2, "#7fd4f5");
    p(22, 18, 1, 2, "#4aa3d8");
    p(18, 19, 1, 2, "#bfe6f7");
    // little plant it's watering
    p(8, 20, 1, 3, "#3f8f36");
    p(6, 20, 2, 1, "#4fa843");
    p(9, 19, 2, 1, "#4fa843");
  },

  /* ── HARVEST — woven basket brimming with produce ── */
  harvest: (p) => {
    // ripe crops spilling over
    p(6, 6, 4, 4, "#e0483c");     // tomato
    p(6, 6, 2, 1, "#ff7565");     // shine
    p(14, 6, 4, 4, "#ffd23d");    // squash
    p(14, 6, 2, 1, "#fff08a");
    p(10, 4, 4, 5, "#e8802a");    // pumpkin
    p(10, 4, 2, 1, "#ffab5c");
    p(11, 3, 2, 1, "#4a8f36");    // stalk
    // green leaves peeking
    p(4, 9, 3, 2, "#4fa843");
    p(17, 9, 3, 2, "#4fa843");
    // basket rim
    p(3, 11, 18, 2, "#c99055");
    // basket body (weave)
    p(4, 13, 16, 8, "#a9713c");
    p(4, 13, 16, 2, "#b9814a");
    // weave verticals
    p(7, 13, 1, 8, "#7d5029");
    p(11, 13, 1, 8, "#7d5029");
    p(15, 13, 1, 8, "#7d5029");
    p(4, 16, 16, 1, "#7d5029");
    p(4, 19, 16, 1, "#7d5029");
  },

  /* ── SELL & ORDER — stacked gold coins with a G ── */
  sell: (p) => {
    // stack shadows
    p(5, 18, 14, 3, "#c9930f");
    p(6, 15, 12, 3, "#ffc63d");
    p(6, 15, 12, 1, "#ffe9ae");
    p(7, 12, 10, 3, "#ffd76a");
    p(7, 12, 10, 1, "#fff2c4");
    // front big coin
    p(8, 6, 10, 8, "#ffd76a");
    p(8, 6, 10, 2, "#fff2c4");
    p(8, 12, 10, 2, "#e0aa1c");
    p(7, 8, 1, 4, "#ffc63d");
    p(18, 8, 1, 4, "#ffc63d");
    // "G" mark
    p(11, 8, 4, 1, "#a86f08");
    p(11, 8, 1, 4, "#a86f08");
    p(11, 11, 4, 1, "#a86f08");
    p(14, 10, 1, 2, "#a86f08");
    p(13, 10, 1, 1, "#a86f08");
  },

  /* ── EARN $FARM — glowing green-gold token with an F ── */
  earn: (p, g) => {
    // outer glow ring
    g.fillStyle = "rgba(141,255,106,0.35)";
    g.fillRect(3, 3, 18, 18);
    // coin
    p(5, 4, 14, 16, "#ffd76a");
    p(5, 4, 14, 2, "#fff2c4");
    p(5, 18, 14, 2, "#e0aa1c");
    p(4, 6, 1, 12, "#ffc63d");
    p(19, 6, 1, 12, "#ffc63d");
    // inner ring accent (green)
    p(6, 6, 12, 1, "#8fe06a");
    p(6, 17, 12, 1, "#4fa843");
    // "F" for FARM
    p(9, 8, 6, 1, "#3a6b12");
    p(9, 8, 1, 8, "#3a6b12");
    p(9, 11, 4, 1, "#3a6b12");
    // sparkle
    p(17, 5, 1, 1, "#ffffff");
    p(6, 16, 1, 1, "#ffffff");
  },

  /* ── PLANT & GROW — a row of three distinct crops on soil ── */
  plant: (p) => {
    // soil strip
    p(1, 18, 22, 5, "#8c5f38");
    p(1, 18, 22, 1, "#a56f42");
    p(1, 22, 22, 1, "#5a3a20");
    // crop 1: leafy turnip (left)
    p(4, 15, 4, 4, "#f0f4e8");     // bulb
    p(4, 12, 1, 3, "#4fa843");
    p(6, 12, 1, 3, "#4fa843");
    p(3, 11, 2, 1, "#67c257");
    p(7, 11, 2, 1, "#67c257");
    // crop 2: corn (middle, tall)
    p(11, 6, 2, 13, "#4a9a3c");
    p(9, 9, 2, 1, "#63bd52");
    p(13, 11, 2, 1, "#63bd52");
    p(13, 8, 2, 5, "#ffd23d");     // cob
    p(13, 8, 1, 5, "#fff08a");
    // crop 3: strawberry (right)
    p(17, 13, 5, 3, "#4fa843");    // leaves
    p(18, 16, 2, 3, "#e8354f");    // berry
    p(20, 17, 2, 2, "#e8354f");
    p(18, 16, 1, 1, "#ff7088");
  },

  /* ── A LIVING FARM — a plump chicken ── */
  living: (p) => {
    // ground shadow
    p(5, 20, 12, 1, "rgba(0,0,0,0.2)");
    // body
    p(4, 10, 11, 8, "#ffffff");
    p(4, 14, 11, 4, "#e8e2d2");    // belly shade
    p(4, 10, 11, 2, "#ffffff");
    // wing
    p(6, 12, 5, 3, "#e0dccb");
    // head
    p(12, 6, 6, 6, "#ffffff");
    p(12, 6, 6, 2, "#ffffff");
    // comb
    p(13, 4, 2, 2, "#e05646");
    p(15, 3, 2, 2, "#e05646");
    // beak
    p(18, 8, 2, 2, "#ffc63d");
    p(18, 10, 2, 1, "#e0aa1c");
    // eye
    p(15, 8, 1, 2, "#2a1e14");
    // wattle
    p(16, 11, 1, 2, "#e05646");
    // legs
    p(7, 18, 1, 3, "#e0aa1c");
    p(11, 18, 1, 3, "#e0aa1c");
    p(6, 21, 3, 1, "#e0aa1c");
    p(10, 21, 3, 1, "#e0aa1c");
  },

  /* ── FARMER'S POOL — a gold trophy cup ── */
  pool: (p, g) => {
    // glow
    g.fillStyle = "rgba(255,209,92,0.3)";
    g.fillRect(4, 2, 16, 14);
    // cup bowl
    p(7, 4, 10, 7, "#ffd76a");
    p(7, 4, 10, 2, "#fff2c4");
    p(8, 11, 8, 2, "#e0aa1c");
    // handles
    p(4, 5, 3, 2, "#ffc63d");
    p(5, 7, 2, 2, "#ffc63d");
    p(17, 5, 3, 2, "#ffc63d");
    p(17, 7, 2, 2, "#ffc63d");
    // star on cup
    p(11, 6, 2, 1, "#a86f08");
    p(11, 6, 1, 3, "#a86f08");
    // stem + base
    p(11, 13, 2, 3, "#c9930f");
    p(7, 16, 10, 2, "#a9713c");
    p(6, 18, 12, 2, "#7d5029");
    p(7, 18, 10, 1, "#8b5a2f");
    // shine
    p(9, 5, 1, 3, "#ffffff");
  },
};

export default function PixelIcon({ kind, size = 72 }: { kind: IconKind; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const scale = Math.max(2, Math.floor(size / U));
    c.width = U * scale;
    c.height = U * scale;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.scale(scale, scale);
    const p: P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    PAINTERS[kind](p, g);
    g.restore();
  }, [kind, size]);

  return <canvas ref={ref} className="pixicon" style={{ width: size, height: size }} aria-hidden />;
}
