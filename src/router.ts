import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   router.ts — tiny History API router (no dependencies)
   "/"      → landing page (connect wallet only)
   "/farm"  → the game
   ═══════════════════════════════════════════════════════════ */

const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }

/** Current pathname, normalised (no trailing slash, always lowercase). */
export function currentPath(): string {
  let p = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (p === "") p = "/";
  return p;
}

/** Push a new path without reloading the page. */
export function navigate(to: string, replace = false) {
  if (currentPath() === to.replace(/\/+$/, "").toLowerCase()) return;
  if (replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  notify();
  window.scrollTo(0, 0);
}

/** Subscribe to route changes (back/forward + programmatic navigate). */
export function useRoute(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const update = () => setPath(currentPath());
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => { listeners.delete(update); window.removeEventListener("popstate", update); };
  }, []);

  return path;
}
