import { useEffect, useState } from "react";
import {
  useGame, disconnect, setTool, setSeed, buySeed, sellCrop, sellAll,
  deliverOrder, poolStats, sacrificeGold, sacrificeLevel, claimPool,
  onToast, finishTutorial,
} from "./store";
import {
  CROPS, CROP_ORDER, TOOLS, MAX_LEVEL, MIN_POOL_LEVEL, RIVALS,
  DAILY_POOL, xpForNext, tillableTiles, type ToolId,
} from "./harvest";
import FarmCanvas from "./FarmCanvas";
import { UI, ToolIcon, CoinGold, TokenLeaf } from "./UiIcon";
import CropIcon from "./CropIcon";
import CopyCA from "./CopyCA";
import { Logo } from "./Landing";

const TOOL_IC: Record<ToolId, (p: { size?: number }) => React.ReactElement> = {
  hoe: ToolIcon.hoe, seed: ToolIcon.seed, can: ToolIcon.can,
  scythe: ToolIcon.scythe, hand: ToolIcon.hand,
} as any;

type PanelId = null | "shop" | "barn" | "orders" | "pool" | "ranks" | "help";

export default function Game({ onLogout }: { onLogout: () => void }) {
  const g = useGame();
  const [panel, setPanel] = useState<PanelId>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [tut, setTut] = useState(!g.tutorialDone);   // show tutorial for new players
  const [tutStep, setTutStep] = useState(0);

  useEffect(() => {
    let n = 0;
    const off = onToast((msg, kind = "info") => {
      const id = ++n;
      setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
    });
    return off;
  }, []);

  // Esc closes panels
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const xpNeed = xpForNext(g.level);
  const xpPct = xpNeed === Infinity ? 100 : Math.min(100, (g.xp / xpNeed) * 100);
  const { cols, rows } = tillableTiles(g.level);
  const barnTotal = CROP_ORDER.reduce((s, c) => s + g.barn[c], 0);
  const barnValue = CROP_ORDER.reduce((s, c) => s + g.barn[c] * CROPS[c].sell, 0);
  const pool = poolStats();

  const TUT_STEPS = [
    { ic: "👋", title: "Welcome to your farm!", body: <>Move with <b>WASD</b> / arrow keys (or the <b>on-screen pad</b> on mobile). Tap a tile to walk there and act. Your progress <b>saves automatically</b> — close the tab and come back anytime.</> },
    { ic: "⛏️", title: "1 · Till the soil", body: <>Pick the <b>Hoe</b> (key <b>1</b>), stand inside the fenced field and press <b>Space</b> (or <b>USE</b>) to turn grass into farmland.</> },
    { ic: "🌱", title: "2 · Sow a seed", body: <>Choose a seed on the belt (you start with <b>Turnips</b>), or press <b>2</b>, then <b>Space</b> on tilled soil to plant it.</> },
    { ic: "🪣", title: "3 · Water it", body: <>Crops <b>only grow while the soil is wet</b>. Grab the <b>Can</b> (key <b>3</b>) and water often — a droplet marker means it's thirsty.</> },
    { ic: "🌾", title: "4 · Harvest & earn", body: <>When the plant <b>sparkles</b>, switch to the <b>Scythe</b> (key <b>4</b>) and reap it. Sell in the <b>Barn</b> or fill <b>Orders</b> for extra gold, then level up to unlock new crops and land.</> },
  ];

  const closeTut = () => { setTut(false); finishTutorial(); };

  return (
    <div className="game">
      {/* ══════ TOP HUD ══════ */}
      <header className="hud">
        <div className="hud-l">
          <span className="hud-logo"><Logo size={20} /> PONSHARVEST</span>
          <span className="chip gold"><CoinGold size={16} /> {g.gold.toLocaleString()}</span>
          <span className="chip farm"><TokenLeaf size={16} /> {g.farmToken.toFixed(0)} $PHRVT</span>
        </div>
        <div className="hud-r">
          <span className="chip lvl">LV {g.level}<i>/{MAX_LEVEL}</i></span>
          <div className="xpbar" title={`${g.xp}/${xpNeed === Infinity ? "MAX" : xpNeed} XP`}>
            <span style={{ width: `${xpPct}%` }} />
            <b>{xpNeed === Infinity ? "MAX" : `${g.xp}/${xpNeed} XP`}</b>
          </div>
          <span className="chip addr">{g.address?.slice(0, 6)}…{g.address?.slice(-4)}</span>
          <button className="ico" title="Help" onClick={() => setPanel("help")}><UI.help size={17} /></button>
          <button className="ico danger" title="Exit" onClick={() => { disconnect(); onLogout(); }}><UI.exit size={16} /></button>
        </div>
      </header>

      {/* ══════ STAGE ══════ */}
      <div className="stage">
        <FarmCanvas />

        {/* left: quick stats */}
        <div className="overlay tl">
          <div className="ov-card">
            <span><UI.field size={13} /> FIELD</span><b>{cols}×{rows}</b>
          </div>
          <div className="ov-card">
            <span><UI.barn size={13} /> BARN</span><b>{barnTotal}</b>
          </div>
          <div className="ov-card">
            <span><UI.power size={13} /> POOL PWR</span><b>{g.poolPower}</b>
          </div>
        </div>

        {/* right: side buttons */}
        <div className="overlay tr">
          <button className="sidebtn" onClick={() => setPanel("shop")}><UI.shop /><i>Shop</i></button>
          <button className="sidebtn" onClick={() => setPanel("barn")}><UI.barn /><i>Barn</i>{barnTotal > 0 && <em>{barnTotal}</em>}</button>
          <button className="sidebtn" onClick={() => setPanel("orders")}><UI.orders /><i>Orders</i><em>{g.orders.length}</em></button>
          <button className="sidebtn" onClick={() => setPanel("pool")}><UI.pool /><i>Pool</i></button>
          <button className="sidebtn" onClick={() => setPanel("ranks")}><UI.ranks /><i>Ranks</i></button>
        </div>

        {/* mobile dpad */}
        <div className="dpad">
          <button className="dp up" onPointerDown={() => dpad("up", true)} onPointerUp={() => dpad("up", false)} onPointerLeave={() => dpad("up", false)}>▲</button>
          <button className="dp left" onPointerDown={() => dpad("left", true)} onPointerUp={() => dpad("left", false)} onPointerLeave={() => dpad("left", false)}>◀</button>
          <button className="dp right" onPointerDown={() => dpad("right", true)} onPointerUp={() => dpad("right", false)} onPointerLeave={() => dpad("right", false)}>▶</button>
          <button className="dp down" onPointerDown={() => dpad("down", true)} onPointerUp={() => dpad("down", false)} onPointerLeave={() => dpad("down", false)}>▼</button>
        </div>
        <button className="actbtn" onPointerDown={() => (window as any).__farmAct?.()}>USE</button>

        {/* toasts */}
        <div className="toasts">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
        </div>
      </div>

      {/* ══════ TOOL BELT ══════ */}
      <footer className="belt">
        <div className="belt-tools">
          {TOOLS.map((t, i) => {
            const TIc = TOOL_IC[t.id as ToolId];
            return (
              <button
                key={t.id}
                className={`slot ${g.tool === t.id ? "on" : ""}`}
                onClick={() => setTool(t.id as ToolId)}
                title={`${t.name} — ${t.hint}`}
              >
                <span className="s-ico"><TIc size={26} /></span>
                <span className="s-key">{i + 1}</span>
                <span className="s-name">{t.name}</span>
              </button>
            );
          })}
        </div>
        <div className="belt-seeds">
          {CROP_ORDER.map((c) => {
            const locked = CROPS[c].minLevel > g.level;
            return (
              <button
                key={c}
                className={`seed ${g.sel === c && g.tool === "seed" ? "on" : ""} ${locked ? "lock" : ""}`}
                onClick={() => (locked ? null : setSeed(c))}
                title={locked ? `${CROPS[c].name} — unlocks at level ${CROPS[c].minLevel}` : `${CROPS[c].name} — ${g.seeds[c]} in bag`}
              >
                <span className="s-ico">{locked ? <span className="s-lock">L{CROPS[c].minLevel}</span> : <CropIcon crop={c} size={28} />}</span>
                <em>{locked ? `L${CROPS[c].minLevel}` : g.seeds[c]}</em>
              </button>
            );
          })}
        </div>
        <div className="belt-hint">
          <b>WASD</b> move · <b>Space</b> use tool · <b>1-5</b> swap tool · click a tile to walk &amp; act
        </div>
      </footer>

      {/* ══════ PANELS ══════ */}
      {panel && (
        <div className="modal" onClick={() => setPanel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button className="sheet-x" onClick={() => setPanel(null)}>✕</button>

            {panel === "shop" && (
              <>
                <h3><UI.shop size={20} /> Seed Shop</h3>
                <p className="sub">Buy seeds, then equip the seed tool and sow on tilled soil. Water them or they won't grow.</p>
                <div className="rows">
                  {CROP_ORDER.map((c) => {
                    const d = CROPS[c];
                    const locked = d.minLevel > g.level;
                    return (
                      <div className={`row ${locked ? "dim" : ""}`} key={c}>
                        <span className="r-ico">{locked ? <span className="s-lock">L{d.minLevel}</span> : <CropIcon crop={c} size={30} />}</span>
                        <div className="r-main">
                          <b>{d.name}</b>
                          <small>
                            {locked ? `Unlocks at level ${d.minLevel}` :
                              `grow ${Math.round(d.growMs / 1000)}s · sells ${d.sell}G · +${d.xp}XP`}
                          </small>
                        </div>
                        <span className="r-own">×{g.seeds[c]}</span>
                        <button className="mini" disabled={locked || g.gold < d.seedCost} onClick={() => buySeed(c, 1)}>
                          {d.seedCost}G
                        </button>
                        <button className="mini alt" disabled={locked || g.gold < d.seedCost * 5} onClick={() => buySeed(c, 5)}>
                          ×5
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {panel === "barn" && (
              <>
                <h3><UI.barn size={20} /> Barn</h3>
                <p className="sub">Harvested produce. Sell for gold, or keep it to fill orders (orders pay ~45% more).</p>
                <div className="rows">
                  {CROP_ORDER.map((c) => (
                    <div className={`row ${g.barn[c] === 0 ? "dim" : ""}`} key={c}>
                      <span className="r-ico"><CropIcon crop={c} size={30} /></span>
                      <div className="r-main"><b>{CROPS[c].name}</b><small>{CROPS[c].sell}G each</small></div>
                      <span className="r-own">×{g.barn[c]}</span>
                      <button className="mini" disabled={g.barn[c] === 0} onClick={() => sellCrop(c, 1)}>Sell 1</button>
                      <button className="mini alt" disabled={g.barn[c] === 0} onClick={() => sellCrop(c, g.barn[c])}>All</button>
                    </div>
                  ))}
                </div>
                <button className="wide" disabled={barnTotal === 0} onClick={sellAll}>
                  Sell everything · {barnValue.toLocaleString()}G
                </button>
              </>
            )}

            {panel === "orders" && (
              <>
                <h3><UI.orders size={20} /> Orders</h3>
                <p className="sub">Townsfolk want produce. Deliver from the barn for bonus gold and XP.</p>
                <div className="rows">
                  {g.orders.map((o) => {
                    const have = g.barn[o.crop];
                    const ok = have >= o.qty;
                    return (
                      <div className={`row ${ok ? "" : "dim"}`} key={o.id}>
                        <span className="r-ico"><CropIcon crop={o.crop} size={30} /></span>
                        <div className="r-main">
                          <b>{o.qty} × {CROPS[o.crop].name}</b>
                          <small>reward {o.gold}G · +{o.xp}XP · you have {have}</small>
                        </div>
                        <button className="mini" disabled={!ok} onClick={() => deliverOrder(o.id)}>Deliver</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {panel === "pool" && (
              <>
                <h3><UI.pool size={20} /> Farmer's Pool</h3>
                <p className="sub">
                  A fixed <b>{DAILY_POOL.toLocaleString()} $PHRVT</b> daily pool. Burn gold or levels for
                  <b> Pool Power</b> — your share is your power vs everyone else's. No inflation, no printing.
                </p>
                <div className="poolgrid">
                  <div><span>Your power</span><b>{g.poolPower}</b></div>
                  <div><span>Total power</span><b>{pool.total.toLocaleString()}</b></div>
                  <div><span>Your share</span><b className="grn">{pool.pct.toFixed(2)}%</b></div>
                  <div><span>Est. payout</span><b className="grn">{pool.estimate.toFixed(1)}</b></div>
                </div>
                {!pool.eligible && <div className="warnbox">Reach level {MIN_POOL_LEVEL} to enter the pool. You are level {g.level}.</div>}
                <div className="btnrow">
                  <button className="mini" disabled={!pool.eligible || g.gold < 100} onClick={() => sacrificeGold(100)}>Burn 100G → +10</button>
                  <button className="mini" disabled={!pool.eligible || g.gold < 500} onClick={() => sacrificeGold(500)}>Burn 500G → +50</button>
                  <button className="mini warn" disabled={g.level - 1 < MIN_POOL_LEVEL} onClick={() => sacrificeLevel(1)}>Burn 1 LV → +120</button>
                </div>
                <button className="wide" disabled={!pool.eligible || g.poolPower <= 0} onClick={claimPool}>
                  Claim {pool.estimate.toFixed(1)} $PHRVT
                </button>
                <CopyCA />
              </>
            )}

            {panel === "ranks" && (
              <>
                <h3><UI.ranks size={20} /> Top Farms</h3>
                <p className="sub">Ranked by Pool Power contributed this round.</p>
                <div className="board">
                  {[...RIVALS, { name: "You", level: g.level, power: g.poolPower }]
                    .sort((a, b) => b.power - a.power)
                    .map((f, i) => (
                      <div className={`brow ${f.name === "You" ? "me" : ""}`} key={f.name + i}>
                        <span className={`bk ${i < 3 ? `medal m${i + 1}` : ""}`}>{i + 1}</span>
                        <span className="bn">{f.name}</span>
                        <span className="bl">LV {f.level}</span>
                        <span className="bp">{f.power.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </>
            )}

            {panel === "help" && (
              <>
                <h3><UI.help size={20} /> How to farm</h3>
                <ol className="steps">
                  <li><b>Till</b> — equip the <b>Hoe</b> (key <b>1</b>), stand on the field and press <b>Space</b>.</li>
                  <li><b>Sow</b> — pick a seed on the belt (or key <b>2</b>), press <b>Space</b> on the tilled soil.</li>
                  <li><b>Water</b> — <b>Can</b> (key <b>3</b>). Crops <i>only grow while the soil is wet</i>, so re-water often.</li>
                  <li><b>Harvest</b> — <b>Scythe</b> (key <b>4</b>) when the plant sparkles. Produce goes to the Barn.</li>
                  <li><b>Sell / Deliver</b> — sell in the Barn, or fill <b>Orders</b> for ~45% more gold.</li>
                  <li><b>Level up</b> — XP clears more wild land and unlocks better crops.</li>
                  <li><b>Farmer's Pool</b> — from level {MIN_POOL_LEVEL}, burn gold/levels for Pool Power and claim $PHRVT.</li>
                </ol>
                <p className="sub">The <b>Hand</b> (key <b>5</b>) clears weeds for a little gold. Your farm auto-saves — close the tab and come back anytime; your progress and hold-gate are checked on-chain.</p>
                <CopyCA />
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════ NEW-PLAYER TUTORIAL ══════ */}
      {tut && (
        <div className="tut-modal">
          <div className="tut-card">
            <div className="tut-dots">
              {TUT_STEPS.map((_, i) => (
                <span key={i} className={i === tutStep ? "on" : ""} />
              ))}
            </div>
            <div className="tut-ic">{TUT_STEPS[tutStep].ic}</div>
            <h3>{TUT_STEPS[tutStep].title}</h3>
            <p className="tut-body">{TUT_STEPS[tutStep].body}</p>
            <div className="tut-actions">
              <button className="tut-skip" onClick={closeTut}>Skip</button>
              {tutStep > 0 && (
                <button className="tut-back" onClick={() => setTutStep((s) => s - 1)}>Back</button>
              )}
              {tutStep < TUT_STEPS.length - 1 ? (
                <button className="tut-next" onClick={() => setTutStep((s) => s + 1)}>Next</button>
              ) : (
                <button className="tut-next go" onClick={closeTut}>Start farming 🌱</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function dpad(dir: "up" | "down" | "left" | "right", down: boolean) {
  (window as any).__farmDpad?.(dir, down);
}
