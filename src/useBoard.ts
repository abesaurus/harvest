import { useEffect, useRef, useState } from "react";
import { fetchBoard, report, clearSession, type BoardData, type BoardRow } from "./leaderboard";

/* ═══════════════════════════════════════════════════════════
   useBoard.ts — keeps the live leaderboard in sync.

   • reports our farm state every REPORT_MS
   • pulls the board every FETCH_MS (and right after a report)
   • fails soft: `data` stays null when the API is unreachable,
     callers fall back to the local single-player row.
   ═══════════════════════════════════════════════════════════ */

const REPORT_MS = 20000;
const FETCH_MS = 15000;

export type LiveBoard = {
  data: BoardData | null;
  rows: BoardRow[] | null;
  online: boolean;
  refresh: () => void;
};

export function useBoard(p: {
  address: string | null;
  nickname: string | null;
  level: number;
  power: number;
  gold: number;
  harvested: number;
}): LiveBoard {
  const [data, setData] = useState<BoardData | null>(null);
  const [online, setOnline] = useState(false);
  const latest = useRef(p);
  latest.current = p;

  const pull = useRef(async () => {
    const cur = latest.current;
    const b = await fetchBoard(cur.address, 50);
    if (b) { setData(b); setOnline(true); } else setOnline(false);
  });

  const push = useRef(async () => {
    const cur = latest.current;
    if (!cur.address) return;
    const r = await report({
      address: cur.address,
      nickname: cur.nickname,
      level: cur.level,
      power: cur.power,
      gold: cur.gold,
      harvested: cur.harvested,
    });
    if (r) await pull.current();
  });

  // reset the signed session when the wallet changes
  useEffect(() => { clearSession(); }, [p.address]);

  useEffect(() => {
    let alive = true;
    const kick = async () => { if (alive) { await push.current(); await pull.current(); } };
    kick();

    const rep = setInterval(() => { void push.current(); }, REPORT_MS);
    const get = setInterval(() => { void pull.current(); }, FETCH_MS);
    const vis = () => { if (document.visibilityState === "visible") void kick(); };
    document.addEventListener("visibilitychange", vis);

    return () => {
      alive = false;
      clearInterval(rep);
      clearInterval(get);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [p.address]);

  return {
    data,
    rows: data ? data.rows : null,
    online,
    refresh: () => { void push.current(); },
  };
}
