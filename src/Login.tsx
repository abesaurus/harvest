import { connectWallet, useGame } from "./store";
import { useState } from "react";

export default function Login({ onEnter }: { onEnter: () => void }) {
  const game = useGame();
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      await connectWallet();
      onEnter();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      {/* animated sky + parallax hills */}
      <div className="sky" aria-hidden>
        <span className="sun" />
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
      </div>
      <div className="hills" aria-hidden>
        <span className="hill h3" />
        <span className="hill h2" />
        <span className="hill h1" />
        <span className="field-strip" />
      </div>
      {/* little crops bobbing along the ground */}
      <div className="ground-crops" aria-hidden>
        {["🌽", "🍅", "🥕", "🌾", "🥬", "🍓", "🌽", "🥔", "🌾", "🍅"].map((c, i) => (
          <span key={i} className="gc" style={{ left: `${4 + i * 9.4}%`, animationDelay: `${i * 0.2}s` }}>{c}</span>
        ))}
      </div>

      <div className="login-card">
        <div className="logo">
          <span className="logo-mark">🌾</span>
          <span className="logo-word">PonsHarvest</span>
        </div>
        <div className="tagline">A cozy on-chain farm on Robinhood Chain</div>

        <p className="login-copy">
          Grow your farm, level up from <b>1 → 30</b>, and reach <b>level 10</b> to join the reward
          pool. The bigger your level, the bigger your share. Trade levels for <b>Boost ⚡</b> to top
          the leaderboard.
        </p>

        {!game.address ? (
          <button className="btn-connect" onClick={connect} disabled={busy}>
            {busy ? "Connecting…" : "🔗 Connect wallet to play"}
          </button>
        ) : (
          <button className="btn-connect ready" onClick={onEnter}>
            ▶ Enter your farm
          </button>
        )}

        {game.address && (
          <div className="connected">
            Connected: <b>{game.address.slice(0, 6)}…{game.address.slice(-4)}</b>
          </div>
        )}

        <div className="login-foot">
          Non-custodial · your wallet signs every action · nothing is custodied
        </div>
      </div>

      <div className="login-badge">Prototype · mock wallet · contracts 18/18 tests passing</div>
    </div>
  );
}
