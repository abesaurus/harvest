import { useEffect, useState } from "react";
import { useGame, restoreWallet, setAddress } from "./store";
import { useRoute, navigate } from "./router";
import { onAccountsChanged, checkHold, hasWallet, MIN_HOLD, type HoldInfo } from "./wallet";
import Landing from "./Landing";
import Game from "./Game";

/* ═══════════════════════════════════════════════════════════
   Routes
     /      → Landing (connect wallet only, nothing else)
     /farm  → Game (requires a connected wallet + 100k $PHRVT hold)
   Any unknown path redirects to "/".
   ═══════════════════════════════════════════════════════════ */

export default function App() {
  const game = useGame();
  const path = useRoute();
  const [hold, setHold] = useState<HoldInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const wantsFarm = path === "/farm";
  const connected = !!game.address;

  // silent reconnect on load + react to wallet account switches
  useEffect(() => {
    restoreWallet();
    const off = onAccountsChanged((addr) => {
      setAddress(addr);
      setHold(null);
      if (!addr) navigate("/", true);
    });
    return off;
  }, []);

  // whenever the connected address changes, verify the $PHRVT hold on-chain
  useEffect(() => {
    let cancelled = false;
    if (!game.address) { setHold(null); return; }
    setChecking(true);
    checkHold(game.address)
      .then((h) => { if (!cancelled) setHold(h); })
      .catch(() => { if (!cancelled) setHold({ raw: 0n, whole: 0n, decimals: 18, ok: false, gateLive: false }); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [game.address]);

  // guard: /farm needs a wallet AND a passing hold check
  useEffect(() => {
    if (wantsFarm && !connected) navigate("/", true);
    if (!wantsFarm && path !== "/") navigate("/", true);
  }, [wantsFarm, connected, path]);

  const allowed = connected && hold?.ok;

  if (wantsFarm && allowed) {
    return <Game onLogout={() => navigate("/")} />;
  }

  // bounce back to landing if they hit /farm without meeting the gate
  if (wantsFarm && connected && hold && !hold.ok) {
    navigate("/", true);
  }

  return (
    <Landing
      onEnter={() => navigate("/farm")}
      hold={hold}
      checking={checking}
      walletAvailable={hasWallet()}
      minHold={MIN_HOLD}
    />
  );
}
