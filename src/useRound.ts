import { useEffect, useState } from "react";
import { roundInfo, fmtCountdown, type RoundInfo } from "./wallet";

/* ═══════════════════════════════════════════════════════════
   useRound.ts — live round countdown.

   One shared hook so the landing, enter-flow and in-game pool
   panel all tick from the same anchored schedule (ROUND_EPOCH,
   21:00 WIB, every 2 days) instead of each holding its own
   timer. Ticks once per second; stops while the tab is hidden.
   ═══════════════════════════════════════════════════════════ */

export type LiveRound = RoundInfo & {
  /** "1d 20h 52m" / "03h 22m 10s" / "05m 12s" */
  label: string;
  /** true when the round has actually started (epoch reached) */
  live: boolean;
  /** true in the final hour — callers can style it as urgent */
  ending: boolean;
};

export function useRound(): LiveRound {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id) return;
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (id) { clearInterval(id); id = null; }
    };

    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const info = roundInfo(now);
  return {
    ...info,
    label: fmtCountdown(info.remainingMs),
    live: now >= info.startsAt,
    ending: info.remainingMs > 0 && info.remainingMs <= 3600_000,
  };
}
