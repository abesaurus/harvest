import { useEffect, useRef } from "react";
import { drawCropSprite } from "./px";
import { CROPS, type CropKind } from "./harvest";

/* ═══════════════════════════════════════════════════════════
   CropIcon — bakes each crop's REAL mature sprite (from px.ts) to
   a crisp upscaled canvas, so the shop/belt/barn show six visually
   distinct crops instead of generic emoji. Same art as in-world.
   ═══════════════════════════════════════════════════════════ */

export default function CropIcon({ crop, size = 30 }: { crop: CropKind; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const cell = 16;                       // px.ts draws in a 16px tile
    const scale = Math.max(2, Math.floor(size / cell));
    c.width = cell * scale;
    c.height = cell * scale;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.scale(scale, scale);
    // draw the ripe (stage 3) sprite centered in the cell
    drawCropSprite(g, 0, 0, CROPS[crop].art, 3, false, 0);
    g.restore();
  }, [crop, size]);

  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} aria-hidden />;
}
