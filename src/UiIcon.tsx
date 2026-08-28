/* ═══════════════════════════════════════════════════════════
   UiIcon — crisp inline-SVG icon set for the in-game HUD & menus.
   Stroke icons on currentColor (chips, side buttons, help), plus a
   few filled "token/coin" marks. Replaces the low-fidelity emoji so
   the /farm UI reads as a polished product, not a chat sticker sheet.
   Every icon is a 24×24 viewBox and scales crisply at any size.
   ═══════════════════════════════════════════════════════════ */

type IP = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round",
  strokeLinejoin: "round", "aria-hidden": true as any,
});

/* filled gold coin with a G (for the gold chip) */
export function CoinGold({ size = 16, ...p }: IP) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
      <circle cx="12" cy="12" r="9" fill="#ffcf4d" stroke="#c9930f" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#e0aa1c" strokeWidth="1.2" />
      <path d="M14.6 9.6a3.4 3.4 0 1 0 .3 4.2h-2.4" fill="none" stroke="#a86f08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* filled token — the $PONSFARM reward coin: green sprout on gold */
export function TokenLeaf({ size = 16, ...p }: IP) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
      <circle cx="12" cy="12" r="9" fill="#ffcf4d" stroke="#3f8f36" strokeWidth="1.6" />
      <path d="M12 16.5c0-3 0-4.5 2-6.5" stroke="#2f6f28" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M14 10c1.4-1.4 3.4-1.2 3.4-1.2S17.6 10.8 16 12s-3 0-3 0 .4-1.6 1-2z" fill="#5cb04d" />
      <path d="M11.9 12.4C10.6 11 8.5 11.2 8.5 11.2s.2 2 1.8 3.1c1 .7 2 .1 2 .1z" fill="#3f8f36" />
    </svg>
  );
}

export const UI = {
  shop: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M4 9h16l-1-4H5L4 9Z" /><path d="M5 9v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 19v-4h4v4" />
    </svg>
  ),
  barn: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M3 10 12 4l9 6" /><path d="M5 10v9h14v-9" /><path d="M9 19v-6h6v6" /><path d="M9 13h6" />
    </svg>
  ),
  orders: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5V6h6V3.5" />
      <path d="M8.5 11l1.6 1.6L13 9.5" /><path d="M8.5 16h7" />
    </svg>
  ),
  pool: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <ellipse cx="9" cy="6.5" rx="5.5" ry="2.6" /><path d="M3.5 6.5v5c0 1.4 2.5 2.6 5.5 2.6" />
      <ellipse cx="15" cy="14" rx="5.5" ry="2.6" /><path d="M9.5 14v3.5c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V14" />
    </svg>
  ),
  ranks: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0Z" /><path d="M8 6H5v1.5a3 3 0 0 0 3 3M16 6h3v1.5a3 3 0 0 1-3 3" />
      <path d="M12 12v3M9.5 20h5M10 20c0-2 .5-3 2-3s2 1 2 3" />
    </svg>
  ),
  help: ({ size = 20, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.6-2 2-2 3" /><path d="M12 17h.01" />
    </svg>
  ),
  power: ({ size = 20, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M12 3v8" /><path d="M7 6a8 8 0 1 0 10 0" />
    </svg>
  ),
  arrow: ({ size = 18, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  field: ({ size = 16, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <rect x="3" y="7" width="18" height="12" rx="1.5" /><path d="M3 11h18M3 15h18M9 7v12M15 7v12" />
    </svg>
  ),
  bolt: ({ size = 16, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" />
    </svg>
  ),
  copy: ({ size = 15, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: ({ size = 15, ...p }: IP) => (
    <svg {...base(size)} {...p}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
  ),
  exit: ({ size = 18, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12H3" /><path d="M6 8l-4 4 4 4" />
    </svg>
  ),
  sound: ({ size = 18, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 9a3 3 0 0 1 0 6" /><path d="M18.5 7a6 6 0 0 1 0 10" />
    </svg>
  ),
  muted: ({ size = 18, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 10l5 4M21 10l-5 4" />
    </svg>
  ),
};

/* ── tool-belt marks (crisp mini pixel/stroke icons, per tool) ── */
export const ToolIcon = {
  hoe: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}><path d="M4 20 13 11" /><path d="M12 5h7v7" /><path d="M19 5l-6 6" /></svg>
  ),
  seed: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M12 21c0-5 0-7 3-10" /><path d="M15 8c2-2 5-2 5-2s0 3-2 5-5 2-5 2 0-3 2-5Z" />
      <path d="M12 21c0-3 0-5-2-7" /><path d="M10 12C8 10 5 11 5 11s.5 3 3 4 2-1 2-1" />
    </svg>
  ),
  can: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M6 11h8v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" /><path d="M8 11V8a2 2 0 0 1 4 0" />
      <path d="M14 13l5-3" /><path d="M20 9l-1.5 3" /><path d="M20 15v2M22 16v2" />
    </svg>
  ),
  scythe: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}><path d="M4 20 15 9" /><path d="M20 8c-2-4-8-4-8-4s0 6 4 7 4-3 4-3Z" /></svg>
  ),
  hand: ({ size = 22, ...p }: IP) => (
    <svg {...base(size)} {...p}>
      <path d="M8 12V6a1.5 1.5 0 0 1 3 0v5" /><path d="M11 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2.5-3.2a1.4 1.4 0 0 1 2-2L8 15" />
    </svg>
  ),
};
