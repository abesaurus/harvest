import { useEffect, useState } from "react";
import { connectWallet, useGame, disconnect } from "./store";
import PixelIcon from "./PixelIcon";
import type { HoldInfo } from "./wallet";
import { PHRVT_TOKEN, RH_EXPLORER, GATE_LIVE, roundInfo, fmtCountdown } from "./wallet";
import CopyCA from "./CopyCA";

/* ═══════════════════════════════════════════════════════════
   Landing "/" — FarmTown-class marketing gate.
   Sticky navbar · split hero (art + mascot) · numbered harvest
   loop · feature cards · footer. Connect wallet opens /farm.
   Icons = inline SVG (never emoji). Motion respects reduced-motion.
   Regenerate the hero art:  npm run bg -- --time=dusk --seed=11
   ═══════════════════════════════════════════════════════════ */

/* — PonsHarvest logo mark: a bold "P" whose counter becomes a
     green sprout growing out of it (concept #1). Scales cleanly
     from favicon to hero. currentColor drives the P; the leaves
     use their own greens. — */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden>
      <defs>
        <linearGradient id="ph-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b6ff7a" />
          <stop offset="1" stopColor="#35c14a" />
        </linearGradient>
        <linearGradient id="ph-stem" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#3f8f36" />
          <stop offset="1" stopColor="#67c257" />
        </linearGradient>
      </defs>
      {/* the P — thick stroke, drawn shorter so the sprout crowns it clearly */}
      <path
        d="M15 42 V14 H27 a8.5 8.5 0 0 1 0 17 H15"
        stroke="currentColor" strokeWidth="6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* sprout stem rising out of the top of the P's stem */}
      <path d="M15 14 C15 9 15 7 15 6" stroke="url(#ph-stem)" strokeWidth="2.6" strokeLinecap="round" />
      {/* right leaf */}
      <path d="M15 8 C18 4 24 4 24 4 C24 4 24 10 20.5 12.5 C18 14 15 12.5 15 12.5 Z" fill="url(#ph-leaf)" />
      {/* left leaf */}
      <path d="M15 10 C12 7 7 8 7 8 C7 8 7.5 13 10.5 14.5 C13 15.8 15 14 15 14 Z" fill="url(#ph-stem)" />
    </svg>
  );
}

/* — inline SVG icon set (stroke, currentColor) — */
const Icon = {
  seed: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22c0-6 0-9 4-13" /><path d="M16 5c2-2 5-2 5-2s0 3-2 5-5 2-5 2 0-3 2-5Z" />
      <path d="M12 22c0-5 0-7-3-10" /><path d="M9 9C7 7 4 7 4 7s0 3 2 5 3 1 3 1" />
    </svg>
  ),
  drop: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2.7s6 6.4 6 10.3a6 6 0 1 1-12 0C6 9.1 12 2.7 12 2.7Z" /><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" />
    </svg>
  ),
  hoe: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 21 14 10" /><path d="M13 5h6v6" /><path d="M19 5l-5 5" />
    </svg>
  ),
  scythe: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20 14 10" /><path d="M20 8a8 8 0 0 0-8-4c0 0 2 6 8 4Z" />
    </svg>
  ),
  trophy: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 3h8v5a4 4 0 0 1-8 0Z" /><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 12v4M9 21h6M10 21c0-2 .5-3 2-3s2 1 2 3" />
    </svg>
  ),
  coins: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3" /><path d="M3 12v0" />
      <ellipse cx="15" cy="14" rx="6" ry="3" /><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3" />
    </svg>
  ),
  wallet: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" /><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M16 12h2" />
    </svg>
  ),
  arrow: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  shield: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
};

const LOOP = [
  { kind: "till" as const, title: "Till & Plant", body: "Work the soil, sow one of six crops, and start your farm." },
  { kind: "water" as const, title: "Water", body: "Crops only grow while the soil is wet — tend them to ripen." },
  { kind: "harvest" as const, title: "Harvest", body: "Reap ripe crops into your barn before they wither away." },
  { kind: "sell" as const, title: "Sell & Order", body: "Sell produce or fill townsfolk orders for bonus gold + XP." },
  { kind: "earn" as const, title: "Earn PONS", body: "Level up, stake Pool Power, and claim your cut of the 10,000 PONS round pool." },
];

const FEATURES = [
  { kind: "plant" as const, title: "Plant & grow", body: "Till soil, sow seeds, keep them watered. Six unique crops across 30 levels.", stat: "6 crops" },
  { kind: "living" as const, title: "A living farm", body: "Crops grow only while watered — real chores, not idle taps. Animals roam.", stat: "Real-time" },
  { kind: "pool" as const, title: "Farmer's Pool", body: "Hold 100k $PHRVT to enter, stake Pool Power, and claim your cut of 10,000 PONS each round.", stat: "10k PONS / round" },
];

type LandingProps = {
  onEnter: () => void;
  hold?: HoldInfo | null;
  checking?: boolean;
  walletAvailable?: boolean;
  minHold?: bigint;
};

const fmt = (n: bigint | number) => n.toLocaleString("en-US");

export default function Landing({ onEnter, hold, checking, walletAvailable = true, minHold = 100_000n }: LandingProps) {
  const game = useGame();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const roundDays = 2;
  const round = roundInfo(now);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 12);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // tick the round countdown once per second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function connect() {
    setBusy(true); setErr(null);
    try { await connectWallet(); }
    catch (e: any) {
      if (e?.message === "NO_WALLET") setErr("No EVM wallet found. Install MetaMask, Rabby, or OKX Wallet.");
      else if (e?.code === 4001 || /reject/i.test(e?.message || "")) setErr("Connection request rejected.");
      else setErr("Could not connect. Try again.");
    }
    finally { setBusy(false); }
  }

  const short = game.address ? `${game.address.slice(0, 6)}…${game.address.slice(-4)}` : "";

  const Brand = (
    <a className="nav-brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
      <span className="nav-badge" aria-hidden><Logo size={26} /></span>
      <span className="nav-name">PONSHARVEST</span>
    </a>
  );

  return (
    <div className="lp" id="top">
      {/* ── fixed background art the user likes ── */}
      <div className="lp-bg" aria-hidden />
      <div className="lp-veil" aria-hidden />

      {/* ══════ NAVBAR ══════ */}
      <nav className={`nav ${scrolled ? "on" : ""}`}>
        <div className="nav-in">
          {Brand}
          <div className="nav-links">
            <a href="#loop">How it works</a>
            <a href="#features">Features</a>
            <a href="#rewards">Rewards</a>
          </div>
          <div className="nav-cta">
            {!game.address ? (
              <button className="btn sm primary" onClick={connect} disabled={busy}>
                <Icon.wallet className="btn-ic" aria-hidden />
                {busy ? "Connecting…" : "Connect"}
              </button>
            ) : (
              <button className="btn sm go" onClick={onEnter}>
                Play <Icon.arrow className="btn-ic" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <header className="hero">
        <div className="hero-copy">
          <span className="pill"><i className="pip" /> Season 1 — live on Robinhood Chain</span>
          <h1 className="hero-title">
            Grow. <span className="a">Harvest.</span> <span className="b">Earn.</span>
          </h1>
          <p className="hero-sub">
            A cozy on-chain farming game — right in your browser. Work the land, tend six
            crops, complete orders, and climb the farmer rankings. No download. Non-custodial.
          </p>

          <div className="hero-actions">
            {!game.address ? (
              <>
                <button className="btn primary" onClick={connect} disabled={busy}>
                  <Icon.wallet className="btn-ic" aria-hidden />
                  {busy ? "Connecting…" : walletAvailable ? "Connect wallet" : "Get a wallet"}
                </button>
                <a className="btn ghost" href="#loop">See how it works</a>
              </>
            ) : (
              <>
                {checking ? (
                  <button className="btn primary" disabled><span className="spin" aria-hidden /> Checking access…</button>
                ) : hold?.ok ? (
                  <button className="btn go" onClick={onEnter}>
                    Enter your farm <Icon.arrow className="btn-ic" aria-hidden />
                  </button>
                ) : GATE_LIVE ? (
                  <a className="btn go" href={`${RH_EXPLORER}/token/${PHRVT_TOKEN}`} target="_blank" rel="noreferrer">
                    Get $PHRVT to play <Icon.arrow className="btn-ic" aria-hidden />
                  </a>
                ) : (
                  <button className="btn go" onClick={onEnter}>
                    Enter (preview) <Icon.arrow className="btn-ic" aria-hidden />
                  </button>
                )}
                <div className="addr"><span className="dot" aria-hidden /> {short}</div>
                <button className="btn ghost sm" onClick={() => disconnect()}>Disconnect</button>
              </>
            )}
          </div>

          {/* hold-gate status */}
          {game.address && !checking && hold && (
            !GATE_LIVE ? (
              <p className="gate-ok" role="status">
                <Icon.shield className="note-ic" aria-hidden /> $PHRVT not deployed yet — preview access is open. The 100k hold-gate goes live once the token launches.
              </p>
            ) : hold.ok ? (
              <p className="gate-ok" role="status">
                <Icon.shield className="note-ic" aria-hidden /> Access granted · holding {fmt(hold.whole)} $PHRVT
              </p>
            ) : (
              <p className="gate-bad" role="alert">
                Hold at least <b>{fmt(minHold)} $PHRVT</b> to play — you have {fmt(hold.whole)}.
              </p>
            )
          )}

          <p className="hero-note">
            <Icon.shield className="note-ic" aria-hidden /> Non-custodial · hold {fmt(minHold)} $PHRVT to enter · 10,000 PONS pool every {roundDays}-day round
          </p>
          {err && <p className="hero-err" role="alert">{err}</p>}

          <div className="hero-stats">
            <div><b>6</b><span>Crops</span></div>
            <div><b>30</b><span>Levels</span></div>
            <div><b className="grn">10k</b><span>PONS / round</span></div>
            <div><b>100k</b><span>$PHRVT to play</span></div>
          </div>

          {/* live round countdown */}
          <div className="round-strip" role="status">
            <span className="rs-k">ROUND {round.index}</span>
            <span className="rs-c">{fmtCountdown(round.remainingMs)}</span>
            <span className="rs-l">until payout · 10,000 PONS pool</span>
          </div>
        </div>

        {/* art panel — the pixel farm scene the user likes, framed */}
        <div className="hero-art">
          <div className="art-frame">
            <div className="art-img" aria-hidden />
            <span className="art-tag"><i className="pip" /> LIVE</span>
            <div className="art-crop c1" aria-hidden><PixelIcon kind="plant" size={30} /></div>
            <div className="art-crop c2" aria-hidden><PixelIcon kind="water" size={30} /></div>
            <div className="art-crop c3" aria-hidden><PixelIcon kind="earn" size={30} /></div>
          </div>
        </div>
      </header>

      {/* ══════ HARVEST LOOP ══════ */}
      <section className="loop" id="loop">
        <div className="sec-head">
          <span className="kicker">HOW IT WORKS</span>
          <h2>The Harvest Loop</h2>
          <p>Five simple steps, one satisfying cycle. Repeat to grow your farm and your rewards.</p>
        </div>
        <div className="loop-grid">
          {LOOP.map((s, i) => (
            <article className="loop-card" key={s.kind}>
              <span className="loop-n">{`0${i + 1}`}</span>
              <span className="loop-ic" aria-hidden><PixelIcon kind={s.kind} size={64} /></span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section className="features" id="features">
        <div className="sec-head">
          <span className="kicker">WHAT YOU CAN DO</span>
          <h2>Built to feel alive</h2>
        </div>
        <div className="feat-grid">
          {FEATURES.map((f) => (
            <article className="feat" key={f.title}>
              <span className="feat-ic" aria-hidden><PixelIcon kind={f.kind} size={56} /></span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <span className="feat-stat">{f.stat}</span>
            </article>
          ))}
        </div>
      </section>

      {/* ══════ REWARDS BANNER ══════ */}
      <section className="rewards" id="rewards">
        <div className="rew-card">
          <span className="kicker">REWARDS</span>
          <h2>Farmer's Pool</h2>
          <p>
            A fixed <b>10,000 PONS</b> pool — the official launchpad token — is paid out every
            <b> {roundDays}-day round</b>, then settled when the timer hits zero. Hold 100k $PHRVT to play,
            burn eligible progress for Pool Power; your share scales with your power versus everyone
            else in the round. No inflation, no printing.
          </p>
          <div className="round-banner">
            <span className="rb-k">ROUND {round.index} ENDS IN</span>
            <span className="rb-c">{fmtCountdown(round.remainingMs)}</span>
          </div>
          <ul className="rew-list">
            <li><Icon.shield className="li-ic" aria-hidden /> Wallet-verified · 100k $PHRVT to enter</li>
            <li><Icon.coins className="li-ic" aria-hidden /> 10,000 PONS per {roundDays}-day round — settled at round end</li>
            <li><Icon.trophy className="li-ic" aria-hidden /> Pool Power leaderboard</li>
          </ul>
          {!game.address ? (
            <button className="btn primary" onClick={connect} disabled={busy}>
              <Icon.wallet className="btn-ic" aria-hidden /> {busy ? "Connecting…" : "Connect & start"}
            </button>
          ) : hold?.ok ? (
            <button className="btn go" onClick={onEnter}>Enter your farm <Icon.arrow className="btn-ic" aria-hidden /></button>
          ) : GATE_LIVE ? (
            <a className="btn go" href={`${RH_EXPLORER}/token/${PHRVT_TOKEN}`} target="_blank" rel="noreferrer">
              Get $PHRVT to play <Icon.arrow className="btn-ic" aria-hidden />
            </a>
          ) : (
            <button className="btn go" onClick={onEnter}>Enter (preview) <Icon.arrow className="btn-ic" aria-hidden /></button>
          )}
          <div className="rew-tokens">
            <CopyCA full label="PONS" />
            <CopyCA full label="$PHRVT" token={PHRVT_TOKEN} />
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="foot-in">
          {Brand}
          <span className="foot-note">On-chain · Robinhood Chain · the game lives at <code>/farm</code></span>
        </div>
      </footer>
    </div>
  );
}
