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

/** $PHRVT token that gates play + funds the reward pool. */
export const PHRVT_TOKEN = "0x39dBED3a2bd333467115dE45665cC57F813C4571";
/** Minimum $PHRVT a wallet must hold to enter the farm. */
export const MIN_HOLD = 100_000n;          // whole tokens
/** Fixed daily reward pool. */
export const POOL_REWARD = 10_000;         // $PHRVT

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
    const r = await ethCall(eth, PHRVT_TOKEN, "0x313ce567"); // decimals()
    cachedDecimals = parseInt(r, 16) || 18;
  } catch { cachedDecimals = 18; }
  return cachedDecimals;
}

export type HoldInfo = { raw: bigint; whole: bigint; decimals: number; ok: boolean };

/** Read the wallet's $PHRVT balance and whether it meets MIN_HOLD. */
export async function checkHold(address: string): Promise<HoldInfo> {
  const eth = getEthereum();
  const dec = await tokenDecimals(eth);
  // balanceOf(address)
  const data = "0x70a08231" + pad32(address);
  const r = await ethCall(eth, PHRVT_TOKEN, data);
  const raw = BigInt(r && r !== "0x" ? r : "0x0");
  const whole = raw / (10n ** BigInt(dec));
  return { raw, whole, decimals: dec, ok: whole >= MIN_HOLD };
}

export function onAccountsChanged(cb: (addr: string | null) => void): () => void {
  const eth = getEthereum();
  if (!eth?.on) return () => {};
  const handler = (accounts: string[]) => cb(accounts?.length ? accounts[0].toLowerCase() : null);
  eth.on("accountsChanged", handler);
  return () => eth.removeListener?.("accountsChanged", handler);
}
