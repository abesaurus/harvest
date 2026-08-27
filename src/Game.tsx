import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGame, disconnect, plant, harvestPlot, harvestAll, claim, convertToBoost,
  buySeed, poolShare, onToast,
} from "./store";
import {
  MAX_LEVEL, MIN_POOL_LEVEL, MAX_PLOTS, SEED_COST, POOL_BPS, GROW_MS,
  xpForNext, unlockedPlots, CROPS, CROP_ORDER, RIVALS, type CropKind,
} from "./harvest";

const SEED_PRICES: Record<CropKind, number> = {
  turnip: 10, potato: 14, tomato: 20, corn: 26, strawberry: 34,
};

export default function Game({ onLogout }: { onLogout: () => void }) {
  const game = useGame();
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState<CropKind>("turnip");
  const [tab, setTab] = useState<"farm" | "shop" | "pool" | "board">("farm");
  const [toast, setToast] = useState<string | null>(null);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() =>
    onToast((msg) => {
      setToast(msg);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => setToast(null), 2200);
    }), []);

  const open = unlockedPlots(game.level);
  const eligible = game.level >= MIN_POOL_LEVEL;
  const share = poolShare();
  const xpNeed = xpForNext(game.level);
  const xpPct = xpNeed === Infinity ? 100 : Math.min(100, (game.xp / xpNeed) * 100);

  const board = useMemo(() => {
    const me = { name: "You", level: game.level, boost: game.boost, me: true };
    return [...RIVALS, me]
      .map((f) => ({ ...f, score: f.level + f.boost }))
      .sort((a, b) => b.score - a.score);
  }, [game.level, game.boost]);

  const readyCount = game.plots.filter(
    (p) => p.plantedAt && now - p.plantedAt >= GROW_MS
  ).length;

  return (
    <div className="game">
      {/* ── top HUD ── */}
      <header className="hud">
        <div className="hud-brand"><span>🌾</span> PonsHarvest</div>
        <div className="hud-stats">
          <span className="hud-chip">💰 <b>{game.farm.toFixed(0)}</b> FARM</span>
          <span className="hud-chip">⚡ <b>{game.boost}</b></span>
          <span className="hud-chip lvl">LVL <b>{game.level}</b>/{MAX_LEVEL}</span>
          <span className="hud-addr">{game.address?.slice(0, 6)}…{game.address?.slice(-4)}</span>
          <button className="hud-out" onClick={() => { disconnect(); onLogout(); }}>Exit</button>
        </div>
      </header>

      {/* ── XP strip ── */}
      <div className="xpstrip">
        <div className="xp-fill" style={{ width: `${xpPct}%` }} />
        <span className="xp-txt">
          {xpNeed === Infinity ? "MAX LEVEL 👑" : `${game.xp}/${xpNeed} XP → L${game.level + 1}`}
          {eligible ? "  ·  ✅ pool member" : `  ·  ${MIN_POOL_LEVEL - game.level} to pool`}
        </span>
      </div>

      <div className="game-body">
        {/* ══════════ MAIN STAGE ══════════ */}
        <main className="stage">
          {tab === "farm" && (
            <>
              <div className="stage-head">
                <h2>🌻 Your Farm</h2>
                <div className="stage-actions">
                  <span className="muted">{open}/{MAX_PLOTS} plots</span>
                  <button className="btn-harvest" onClick={harvestAll} disabled={readyCount === 0}>
                    Harvest all {readyCount > 0 && `(${readyCount})`} 🌾
                  </button>
                </div>
              </div>

              {/* seed selector */}
              <div className="seedbar">
                <span className="seedbar-lbl">Planting:</span>
                {CROP_ORDER.map((c) => (
                  <button
                    key={c}
                    className={`seedpick ${sel === c ? "on" : ""}`}
                    onClick={() => setSel(c)}
                    title={CROPS[c].name}
                  >
                    <span>{CROPS[c].stages[2]}</span>
                    <b>{game.seedInventory[c]}</b>
                  </button>
                ))}
                <button className="seed-shop" onClick={() => setTab("shop")}>+ Buy seeds</button>
              </div>

              {/* isometric-ish field */}
              <div className="farm-grid">
                {game.plots.map((p, i) => {
                  const locked = i >= open;
                  const growing = !!p.plantedAt;
                  const prog = growing ? Math.min(1, (now - p.plantedAt!) / GROW_MS) : 0;
                  const mature = growing && prog >= 1;
                  const crop = p.crop ? CROPS[p.crop] : null;
                  const stage = !growing ? -1 : prog < 0.4 ? 0 : prog < 1 ? 1 : 2;
                  return (
                    <div key={i} className={`tile-wrap`}>
                      <button
                        className={`tile ${locked ? "locked" : ""} ${mature ? "mature" : ""} ${growing ? "planted" : ""}`}
                        onClick={() => (locked ? null : growing ? (mature ? harvestPlot(i) : null) : plant(i, sel))}
                      >
                        <div className="soil" />
                        {locked ? (
                          <span className="t-lock">🔒</span>
                        ) : growing ? (
                          <>
                            <span className={`t-crop ${mature ? "pop" : ""}`}>{crop!.stages[stage]}</span>
                            {!mature ? (
                              <span className="t-prog"><span style={{ width: `${prog * 100}%` }} /></span>
                            ) : (
                              <span className="t-ready">READY</span>
                            )}
                          </>
                        ) : (
                          <span className="t-plus">＋</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="farm-hint">
                Pick a seed, click a soil plot to plant. Wait for it to grow, then click to harvest for XP.
                Locked plots open as you level up.
              </div>
            </>
          )}

          {tab === "shop" && (
            <>
              <div className="stage-head"><h2>🏪 Seed Shop</h2><span className="muted">💰 {game.farm.toFixed(0)} FARM</span></div>
              <div className="shop-grid">
                {CROP_ORDER.map((c) => (
                  <div className="shop-card" key={c}>
                    <div className="shop-emoji">{CROPS[c].stages[2]}</div>
                    <div className="shop-name">{CROPS[c].name}</div>
                    <div className="shop-have">Owned: {game.seedInventory[c]}</div>
                    <button className="btn-buy" onClick={() => buySeed(c, SEED_PRICES[c])} disabled={game.farm < SEED_PRICES[c]}>
                      Buy · {SEED_PRICES[c]} FARM
                    </button>
                  </div>
                ))}
              </div>
              <div className="farm-hint">Every seed purchase feeds {POOL_BPS / 100}% of its cost into the reward pool.</div>
            </>
          )}

          {tab === "pool" && (
            <>
              <div className="stage-head"><h2>💰 Reward Pool</h2><span className="muted">live</span></div>
              <div className="pool-big">{game.poolFund.toFixed(0)} <span>FARM</span></div>
              <p className="pool-desc">
                Fed by <b>{POOL_BPS / 100}%</b> of every seed planted. Split across all level-{MIN_POOL_LEVEL}+
                farmers, weighted by level. Your share = your level ÷ total eligible levels.
              </p>
              <div className="pool-cards">
                <div><span>Eligible levels</span><b>{share.totalLevels}</b></div>
                <div><span>Your level</span><b>{eligible ? game.level : "—"}</b></div>
                <div><span>Your share</span><b className="grn">{share.pct.toFixed(1)}%</b></div>
                <div><span>Est. cut</span><b className="grn">{share.share.toFixed(1)}</b></div>
              </div>
              <button className="btn-claim" onClick={claim} disabled={!eligible || share.share <= 0}>
                {eligible ? `Claim ${share.share.toFixed(1)} FARM` : `Reach level ${MIN_POOL_LEVEL} to claim`}
              </button>

              <div className="boost-box">
                <h3>Trade level → Boost ⚡</h3>
                <p>Convert levels into Boost to climb the leaderboard. <b>Your level drops</b>, so your pool share shrinks. Pure trade-off.</p>
                <div className="boost-row">
                  <button onClick={() => convertToBoost(1)} disabled={game.level <= 1}>−1 lvl → 1⚡</button>
                  <button onClick={() => convertToBoost(5)} disabled={game.level <= 5}>−5 lvl → 5⚡</button>
                </div>
              </div>
            </>
          )}

          {tab === "board" && (
            <>
              <div className="stage-head"><h2>🏆 Leaderboard</h2><span className="muted">score = level + boost</span></div>
              <div className="board2">
                {board.map((f, i) => (
                  <div className={`brow ${(f as any).me ? "me" : ""}`} key={f.name + i}>
                    <span className="brank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                    <span className="bwho">{f.name}</span>
                    <span className="blv">L{f.level}</span>
                    <span className="bbo">{f.boost}⚡</span>
                    <span className="bsc">{(f as any).score}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* ══════════ SIDEBAR NAV ══════════ */}
        <nav className="dock">
          <button className={tab === "farm" ? "on" : ""} onClick={() => setTab("farm")}><span>🌻</span>Farm</button>
          <button className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}><span>🏪</span>Shop</button>
          <button className={tab === "pool" ? "on" : ""} onClick={() => setTab("pool")}><span>💰</span>Pool</button>
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}><span>🏆</span>Ranks</button>
        </nav>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
