import { useEffect, useRef, useState } from "react";
import { useGame, setNickname } from "./store";
import { Logo } from "./Landing";
import { UI, CoinGold, TokenLeaf } from "./UiIcon";
import { MAX_LEVEL } from "./harvest";
import { roundInfo, fmtCountdown, GATE_LIVE } from "./wallet";

/* ═══════════════════════════════════════════════════════════
   EnterFlow — the polished "press Play → enter farm" sequence.

     1. BOOTING   — branded loading bar (assets / on-chain checks)
     2. NAMING    — new players pick a farm nickname (skipped if set)
     3. PROFILE   — player account card + [Go farm] button
     4. WARPING   — second loading bar, then hands off to the game

   Fully self-contained overlay; calls onDone() when the last bar
   finishes so App can mount <Game/>. onCancel() bails back to "/".
   ═══════════════════════════════════════════════════════════ */

type Phase = "booting" | "naming" | "profile" | "warping";

const BOOT_STEPS = [
  "Connecting to Robinhood Chain…",
  "Verifying wallet & hold-gate…",
  "Loading your farm save…",
  "Waking the townsfolk…",
];
const WARP_STEPS = [
  "Tilling the soil…",
  "Planting the world…",
  "Opening the farm gate…",
];

function short(a: string | null) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

/** A branded, self-animating progress bar. Calls onComplete once at 100%. */
function LoadingBar({
  steps, durationMs, onComplete,
}: { steps: string[]; durationMs: number; onComplete: () => void }) {
  const [pct, setPct] = useState(0);
  const done = useRef(false);
  const start = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (!start.current) start.current = t;
      const p = Math.min(1, (t - start.current) / durationMs);
      // ease-out so it decelerates near the end (feels like real loading)
      const eased = 1 - Math.pow(1 - p, 2.2);
      setPct(eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else if (!done.current) { done.current = true; setTimeout(onComplete, 220); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onComplete]);

  const stepIdx = Math.min(steps.length - 1, Math.floor(pct * steps.length));

  return (
    <div className="ld-wrap">
      <div className="ld-logo"><Logo size={54} /></div>
      <div className="ld-title">PONSHARVEST</div>
      <div className="ld-bar"><span style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      <div className="ld-row">
        <span className="ld-step">{steps[stepIdx]}</span>
        <span className="ld-pct">{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

export default function EnterFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const g = useGame();
  const [phase, setPhase] = useState<Phase>("booting");
  const [name, setName] = useState(g.nickname ?? "");
  const [now, setNow] = useState(() => Date.now());
  const round = roundInfo(now);

  // live round countdown on the profile card
  useEffect(() => {
    if (phase !== "profile") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // after the boot bar: new players name their farm, returning players skip ahead
  function afterBoot() {
    setPhase(g.nickname ? "profile" : "naming");
  }

  function confirmName() {
    const clean = name.trim();
    if (clean.length < 2) return;
    setNickname(clean);
    setPhase("profile");
  }

  const isNew = !g.tutorialDone && g.level === 1;
  const displayName = g.nickname || name.trim() || short(g.address);

  return (
    <div className="enter-flow">
      <div className="ef-bg" aria-hidden />
      <div className="ef-veil" aria-hidden />

      {/* close / bail */}
      <button className="ef-x" onClick={onCancel} aria-label="Cancel">
        <UI.exit size={18} />
      </button>

      {phase === "booting" && (
        <LoadingBar steps={BOOT_STEPS} durationMs={2200} onComplete={afterBoot} />
      )}

      {phase === "naming" && (
        <div className="ef-card">
          <div className="ef-badge"><Logo size={40} /></div>
          <h2>Name your farm</h2>
          <p className="ef-sub">Welcome, new farmer! Pick a nickname other players will see on the leaderboard.</p>
          <div className="ef-field">
            <input
              className="ef-input"
              value={name}
              maxLength={20}
              placeholder="e.g. SunnyAcres"
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmName(); }}
            />
            <span className="ef-count">{name.trim().length}/20</span>
          </div>
          <button className="ef-btn go" disabled={name.trim().length < 2} onClick={confirmName}>
            Continue <UI.check size={16} />
          </button>
          <p className="ef-hint">2–20 characters. You can be recognised by this name in the Farmer's Pool.</p>
        </div>
      )}

      {phase === "profile" && (
        <div className="ef-card wide">
          <div className="ef-badge"><Logo size={40} /></div>
          <span className="ef-kicker">{isNew ? "FARM CREATED" : "WELCOME BACK"}</span>
          <h2 className="ef-name">{displayName}</h2>
          <div className="ef-addr"><span className="dot" /> {short(g.address)}</div>

          <div className="ef-stats">
            <div className="ef-stat">
              <span>LEVEL</span>
              <b>{g.level}<i>/{MAX_LEVEL}</i></b>
            </div>
            <div className="ef-stat">
              <span><CoinGold size={13} /> GOLD</span>
              <b>{g.gold.toLocaleString()}</b>
            </div>
            <div className="ef-stat">
              <span><TokenLeaf size={13} /> PONS</span>
              <b>{g.farmToken.toFixed(0)}</b>
            </div>
            <div className="ef-stat">
              <span><UI.power size={13} /> POOL PWR</span>
              <b>{g.poolPower}</b>
            </div>
          </div>

          <div className={`ef-round ${GATE_LIVE ? "" : "paused"}`}>
            {GATE_LIVE ? (
              <>
                <span className="efr-k">ROUND {round.index} · pool ends in</span>
                <span className="efr-c">{fmtCountdown(round.remainingMs)}</span>
              </>
            ) : (
              <>
                <span className="efr-k">POOL PRE-LAUNCH</span>
                <span className="efr-c">starts when $PHRVT deploys</span>
              </>
            )}
          </div>

          <button className="ef-btn go big" onClick={() => setPhase("warping")}>
            Go farm <UI.arrow size={18} />
          </button>
        </div>
      )}

      {phase === "warping" && (
        <LoadingBar steps={WARP_STEPS} durationMs={1600} onComplete={onDone} />
      )}
    </div>
  );
}
