/* ═══════════════════════════════════════════════════════════
   leaderboard.ts — real-time board client (api.ponsfarm.online)

   Flow:
     1) openSession(address)  → server returns a signed session
     2) report({...})          → push farm state every ~20s
     3) fetchBoard(address)    → pull the live board
   All calls fail soft: if the API is down the game keeps working
   and the board simply shows the local player only.
   ═══════════════════════════════════════════════════════════ */

export const LEADERBOARD_API =
  (import.meta as any).env?.VITE_LEADERBOARD_API || "https://api.ponsfarm.online";

export type BoardRow = {
  rank: number;
  nickname: string;
  addr: string | null;
  level: number;
  power: number;
  estimate: number;
  you: boolean;
};

export type BoardData = {
  pool: number;
  totalPower: number;
  ratePerPower: number;
  players: number;
  round: { index: number; startsAt: number; endsAt: number; msLeft: number; live: boolean };
  rows: BoardRow[];
  you: { rank: number; nickname: string; level: number; power: number; estimate: number } | null;
};

type Session = { sessionId: string; startedAt: number; signature: string; address: string };

let session: Session | null = null;
let sessionPromise: Promise<Session | null> | null = null;

const TIMEOUT_MS = 8000;

async function api(path: string, init?: RequestInit): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(LEADERBOARD_API + path, {
      ...init,
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error((body && body.error) || `HTTP ${r.status}`);
    return body;
  } finally {
    clearTimeout(t);
  }
}

/** Open (or reuse) a signed session for this address. */
export async function openSession(address: string): Promise<Session | null> {
  if (session && session.address === address.toLowerCase()) return session;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    try {
      const j = await api("/session", {
        method: "POST",
        body: JSON.stringify({ address: address.toLowerCase() }),
      });
      session = { ...j, address: address.toLowerCase() };
      return session;
    } catch (e) {
      console.warn("[leaderboard] session failed:", (e as Error).message);
      return null;
    } finally {
      sessionPromise = null;
    }
  })();

  return sessionPromise;
}

export function clearSession() {
  session = null;
}

/** Push the current farm state. Returns the server's view or null on failure. */
export async function report(p: {
  address: string;
  nickname: string | null;
  level: number;
  power: number;
  gold: number;
  harvested: number;
}): Promise<{ rank: number; players: number; totalPower: number; ratePerPower: number; estimate: number } | null> {
  const s = await openSession(p.address);
  if (!s) return null;
  try {
    return await api("/report", {
      method: "POST",
      body: JSON.stringify({
        sessionId: s.sessionId,
        signature: s.signature,
        address: p.address.toLowerCase(),
        nickname: p.nickname || undefined,
        level: p.level,
        power: p.power,
        gold: p.gold,
        harvested: p.harvested,
      }),
    });
  } catch (e) {
    const msg = (e as Error).message;
    // expired session → drop it so the next report re-opens one
    if (/session/i.test(msg)) session = null;
    console.warn("[leaderboard] report failed:", msg);
    return null;
  }
}

/** Pull the live board. */
export async function fetchBoard(address?: string | null, limit = 50): Promise<BoardData | null> {
  try {
    const q = new URLSearchParams({ limit: String(limit) });
    if (address) q.set("address", address.toLowerCase());
    return await api("/leaderboard?" + q.toString());
  } catch (e) {
    console.warn("[leaderboard] fetch failed:", (e as Error).message);
    return null;
  }
}

/** Cheap summary poll (no rows). */
export async function fetchStats() {
  try {
    return await api("/stats");
  } catch {
    return null;
  }
}
