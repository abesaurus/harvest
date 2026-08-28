/* ═══════════════════════════════════════════════════════════
   audio.ts — procedural farm ambience via the Web Audio API.

   No audio files: everything is synthesised live, so the bundle
   stays tiny and there are zero hosting/licensing concerns.

     • WIND      — brown-ish noise through a slow-drifting low-pass,
                   gently swelling in and out.
     • BIRDS     — short frequency-swept sine "chirps" (2–4 notes),
                   fired at random intervals, panned across the field.
     • CRICKETS  — faint high shimmer that fades up after dusk feel.

   Browsers block audio until a user gesture, so start() must be
   called from a click/tap (we trigger it from the "Go farm" button
   and lazily on the first canvas interaction as a fallback).
   ═══════════════════════════════════════════════════════════ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let started = false;
let muted = false;
let birdTimer: number | null = null;
let windLFO: number | null = null;
const nodes: { stop?: () => void }[] = [];

const LS_KEY = "ponsharvest.muted";

function makeNoiseBuffer(ac: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  // brown-ish noise (integrated white) → softer, wind-like
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buf;
}

/* ── WIND: looping noise → lowpass, with a slow gain swell ── */
function startWind(ac: AudioContext, out: GainNode) {
  const src = ac.createBufferSource();
  src.buffer = makeNoiseBuffer(ac, 3);
  src.loop = true;

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 480;
  lp.Q.value = 0.6;

  const g = ac.createGain();
  g.gain.value = 0.0;

  src.connect(lp).connect(g).connect(out);
  src.start();

  // slow swell: modulate gain + cutoff over time
  const swell = () => {
    if (!ctx) return;
    const t = ac.currentTime;
    const target = 0.10 + Math.random() * 0.10;      // 0.10–0.20
    const cut = 380 + Math.random() * 360;           // 380–740 Hz
    g.gain.cancelScheduledValues(t);
    g.gain.linearRampToValueAtTime(target, t + 3 + Math.random() * 3);
    lp.frequency.linearRampToValueAtTime(cut, t + 4 + Math.random() * 4);
  };
  swell();
  windLFO = window.setInterval(swell, 4000);

  nodes.push({ stop: () => { try { src.stop(); } catch { /* */ } } });
}

/* ── BIRD: a short chirp = a few quick pitch-swept sine blips ── */
function chirp(ac: AudioContext, out: GainNode) {
  const notes = 2 + Math.floor(Math.random() * 3);   // 2–4 blips
  const base = 1900 + Math.random() * 1600;          // 1.9–3.5 kHz
  const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
  if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
  const bus = pan ?? out;
  if (pan) pan.connect(out);

  let t = ac.currentTime + 0.02;
  for (let i = 0; i < notes; i++) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    const f0 = base * (0.9 + Math.random() * 0.3);
    const f1 = f0 * (1.25 + Math.random() * 0.4);
    const dur = 0.06 + Math.random() * 0.05;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.92, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur + 0.03 + Math.random() * 0.05;
  }
}

function scheduleBirds(ac: AudioContext, out: GainNode) {
  const loop = () => {
    if (!ctx) return;
    if (!muted && Math.random() > 0.25) chirp(ac, out);
    // next chirp in 2.5–8s
    birdTimer = window.setTimeout(loop, 2500 + Math.random() * 5500);
  };
  birdTimer = window.setTimeout(loop, 1200);
}

/* ── CRICKETS: faint high tremolo shimmer under everything ── */
function startCrickets(ac: AudioContext, out: GainNode) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const trem = ac.createOscillator();
  const tremG = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = 4300;
  g.gain.value = 0.0;
  // tremolo modulates the gain fast for a "chirr" texture
  trem.frequency.value = 18;
  tremG.gain.value = 0.012;
  trem.connect(tremG).connect(g.gain);
  osc.connect(g).connect(out);
  osc.start(); trem.start();
  // fade the base level in a touch
  g.gain.setValueAtTime(0.0, ac.currentTime);
  g.gain.linearRampToValueAtTime(0.012, ac.currentTime + 6);
  nodes.push({ stop: () => { try { osc.stop(); trem.stop(); } catch { /* */ } } });
}

/** Start the ambience. Safe to call repeatedly; only inits once. */
export function startAmbience() {
  if (started) { if (ctx?.state === "suspended") ctx.resume(); return; }
  const AC = (window.AudioContext || (window as any).webkitAudioContext);
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  muted = localStorage.getItem(LS_KEY) === "1";
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);
  startWind(ctx, master);
  startCrickets(ctx, master);
  scheduleBirds(ctx, master);
  started = true;
}

/** Toggle mute; persists across sessions. Returns the new muted state. */
export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(LS_KEY, muted ? "1" : "0");
  if (master && ctx) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(muted ? 0 : 0.9, t + 0.25);
  }
  return muted;
}

export function isMuted(): boolean {
  return localStorage.getItem(LS_KEY) === "1";
}

/** Fully stop & release audio (on game exit). */
export function stopAmbience() {
  if (birdTimer) clearTimeout(birdTimer);
  if (windLFO) clearInterval(windLFO);
  birdTimer = windLFO = null;
  nodes.forEach((n) => n.stop?.());
  nodes.length = 0;
  if (ctx) { try { ctx.close(); } catch { /* */ } }
  ctx = null; master = null; started = false;
}
