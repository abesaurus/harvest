#!/usr/bin/env node
/* verify round math matches the UI expectation, at several points in time */
const ROUND_MS = 2 * 24 * 60 * 60 * 1000;
const ROUND_EPOCH = Date.UTC(2026, 7, 28, 14, 0, 0); // 21:00 WIB

function roundInfo(now) {
  const elapsed = Math.max(0, now - ROUND_EPOCH);
  const index = Math.floor(elapsed / ROUND_MS);
  const startsAt = ROUND_EPOCH + index * ROUND_MS;
  const endsAt = startsAt + ROUND_MS;
  return { index: index + 1, startsAt, endsAt, remainingMs: Math.max(0, endsAt - now) };
}
function fmt(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}
const wib = t => new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });

const now = Date.now();
console.log('now (WIB)      :', wib(now));
console.log('epoch (WIB)    :', wib(ROUND_EPOCH), '\n');

for (const [label, t] of [
  ['now', now],
  ['+1h', now + 3600e3],
  ['boundary -30s', roundInfo(now).endsAt - 30e3],
  ['boundary exact', roundInfo(now).endsAt],
  ['boundary +1s', roundInfo(now).endsAt + 1000],
  ['+5 days', now + 5 * 86400e3],
]) {
  const r = roundInfo(t);
  const ending = r.remainingMs > 0 && r.remainingMs <= 3600e3;
  console.log(
    `${label.padEnd(15)} → ROUND ${String(r.index).padEnd(2)} ends in ${fmt(r.remainingMs).padEnd(15)}` +
    ` boundary=${wib(r.endsAt)} urgent=${ending}`
  );
}
