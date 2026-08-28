import { useState } from "react";
import { UI } from "./UiIcon";
import { PHRVT_TOKEN, RH_EXPLORER } from "./wallet";

/* ═══════════════════════════════════════════════════════════
   CopyCA — the $PHRVT contract address with a one-tap copy button
   and a link to the explorer. Falls back to a manual selection copy
   when the async clipboard API is unavailable (http / older browsers).
   ═══════════════════════════════════════════════════════════ */

export function shortCA(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function copyText(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(t); return true; }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export default function CopyCA({
  full = false, label = "$PHRVT", token = PHRVT_TOKEN,
}: { full?: boolean; label?: string; token?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (await copyText(token)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <div className="ca-bar" title={token}>
      <span className="ca-tick">{label}</span>
      <code className="ca-addr">{full ? token : shortCA(token)}</code>
      <button className={`ca-copy ${copied ? "ok" : ""}`} onClick={onCopy} aria-label="Copy contract address">
        {copied ? <UI.check /> : <UI.copy />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <a className="ca-view" href={`${RH_EXPLORER}/token/${token}`} target="_blank" rel="noreferrer" aria-label="View on explorer">
        View
      </a>
    </div>
  );
}
