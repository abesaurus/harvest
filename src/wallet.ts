/* ═══════════════════════════════════════════════════════════
   wallet.ts — real EVM wallet connection on Robinhood Chain.
   No external deps: talks to the injected provider (MetaMask /
   Rabby / OKX …) via EIP-1193 and reads the gate token balance
   with a raw eth_call to balanceOf. Falls back gracefully when
   no wallet is present.
   ═══════════════════════════════════════════════════════════ */

export const RH_CHAIN_ID = 4663;
export const RH_CHAIN_HEX = "0x1237"; // 4663
export const RH_RPC = "https://rpc.mainnet.chain.robinhood.com";
export const RH_EXPLORER = "https://rh-scan.com";

/* ── Pons launchpad — where players buy the $PONSFARM gate token ── */
export const PONS_BUY_URL = "https://www.ponsfamily.com/launchpad/0xb3d3991221d53A28FCA8f52998b48b50188C8EAC?utm_source=tokenpocket";

/* ── Two separate tokens ──────────────────────────────────────
   PONS      = the official launchpad token that funds the reward pool
               (10,000 PONS per round). Already live on-chain.
   PONSFARM  = the game's own gate token the team will deploy later
               on the Pons launchpad. Hold MIN_HOLD of it to enter the
               farm. CA is unknown until launch, so it stays empty
               ("TBA") for now and the hold-gate runs in "preview"
               mode until it's set.
   ──────────────────────────────────────────────────────────── */

/** Official PONS launchpad token — funds the reward pool. */
export const PONS_TOKEN = "0x39dBED3a2bd333467115dE45665cC57F813C4571";

/** $PONSFARM game gate token — the key to enter the farm.
 *  Hold-gate enforced on-chain via balanceOf. */
export const PONSFARM_TOKEN = "0xb3d3991221d53a28fca8f52998b48b50188c8eac";

/** True once the $PONSFARM gate token has a real address. */
export const GATE_LIVE = /^0x[0-9a-fA-F]{40}$/.test(PONSFARM_TOKEN);

/** Minimum $PONSFARM a wallet must hold to enter the farm (at launch). */
export const MIN_HOLD = 100_000n;          // whole tokens

/** Reward pool paid out each round (in PONS). */
export const POOL_REWARD = 10_000;         // PONS per round

/* ── Round timing: a round runs 2 days, then payouts are settled ── */
/** Length of one pool round. */
export const ROUND_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
/** Fixed anchor so every client agrees on round boundaries. 14:00 UTC = 21:00 WIB (9 PM). */
export const ROUND_EPOCH = Date.UTC(2026, 7, 28, 14, 0, 0); // 2026-08-28 14:00 UTC = 21:00 WIB

export type RoundInfo = { index: number; startsAt: number; endsAt: number; remainingMs: number };

/** Which round we're in and how long until it settles. */
export function roundInfo(now: number = Date.now()): RoundInfo {
  const elapsed = Math.max(0, now - ROUND_EPOCH);
  const index = Math.floor(elapsed / ROUND_MS);
  const startsAt = ROUND_EPOCH + index * ROUND_MS;
  const endsAt = startsAt + ROUND_MS;
  return { index: index + 1, startsAt, endsAt, remainingMs: Math.max(0, endsAt - now) };
}

/** Format a remaining-ms span as "1d 03h 22m" / "03h 22m 10s". */
export function fmtCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

type Eth = {
  request: (a: { method: string; params?: any[] }) => Promise<any>;
  on?: (e: string, cb: (...a: any[]) => void) => void;
  removeListener?: (e: string, cb: (...a: any[]) => void) => void;
};

export function getEthereum(): Eth | null {
  return (typeof window !== "undefined" && (window as any).ethereum) || null;
}
export function hasWallet(): boolean {
  return !!getEthereum();
}

/** Ensure the wallet is on Robinhood Chain, adding it if unknown. */
export async function ensureChain(eth: Eth): Promise<void> {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: RH_CHAIN_HEX }] });
  } catch (e: any) {
    // 4902 = chain not added yet
    if (e?.code === 4902 || /Unrecognized chain/i.test(e?.message || "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: RH_CHAIN_HEX,
          chainName: "Robinhood Chain",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [RH_RPC],
          blockExplorerUrls: [RH_EXPLORER],
        }],
      });
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: RH_CHAIN_HEX }] });
    } else if (e?.code !== 4001) {
      // ignore non-user-rejection quirks; balance read still works via RPC
    } else {
      throw e;
    }
  }
}

/** Prompt the wallet to connect; returns the selected address (lowercased). */
export async function connectInjected(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("NO_WALLET");
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("NO_ACCOUNT");
  await ensureChain(eth);
  return accounts[0].toLowerCase();
}

/** Silent reconnect (no popup) if the wallet already authorised us. */
export async function reconnectSilently(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const accounts: string[] = await eth.request({ method: "eth_accounts" });
    return accounts?.length ? accounts[0].toLowerCase() : null;
  } catch { return null; }
}

/** Pad a hex string to 32 bytes for ABI encoding. */
function pad32(hex: string) { return hex.replace(/^0x/, "").padStart(64, "0"); }

async function ethCall(eth: Eth | null, to: string, data: string): Promise<string> {
  // Prefer the wallet provider (already on RH); fall back to public RPC.
  if (eth) {
    try { return await eth.request({ method: "eth_call", params: [{ to, data }, "latest"] }); }
    catch { /* fall through to public RPC */ }
  }
  const res = await fetch(RH_RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "eth_call failed");
  return j.result;
}

let cachedDecimals: number | null = null;

async function tokenDecimals(eth: Eth | null): Promise<number> {
  if (cachedDecimals != null) return cachedDecimals;
  try {
    const r = await ethCall(eth, PONSFARM_TOKEN, "0x313ce567"); // decimals()
    cachedDecimals = parseInt(r, 16) || 18;
  } catch { cachedDecimals = 18; }
  return cachedDecimals;
}

export type HoldInfo = { raw: bigint; whole: bigint; decimals: number; ok: boolean; gateLive: boolean };

/** Read the wallet's $PONSFARM balance and whether it meets MIN_HOLD.
 *  The hold-gate is always enforced on-chain via balanceOf. */
export async function checkHold(_address: string): Promise<HoldInfo> {
  const eth = getEthereum();
  const dec = await tokenDecimals(eth);
  // balanceOf(address)
  const data = "0x70a08231" + pad32(_address);
  const r = await ethCall(eth, PONSFARM_TOKEN, data);
  const raw = BigInt(r && r !== "0x" ? r : "0x0");
  const whole = raw / (10n ** BigInt(dec));
  return { raw, whole, decimals: dec, ok: whole >= MIN_HOLD, gateLive: true };
}

export function onAccountsChanged(cb: (addr: string | null) => void): () => void {
  const eth = getEthereum();
  if (!eth?.on) return () => {};
  const handler = (accounts: string[]) => cb(accounts?.length ? accounts[0].toLowerCase() : null);
  eth.on("accountsChanged", handler);
  return () => eth.removeListener?.("accountsChanged", handler);
}
