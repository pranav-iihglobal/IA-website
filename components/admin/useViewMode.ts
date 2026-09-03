"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Cards or a table — remembered per device, per list.
 *
 * Cards are right on a phone. On a monitor three columns of cards show a
 * dozen rows where a table shows forty, and the CA scans numbers. The
 * choice is a fact about the device in front of you, not about the account,
 * so it lives in localStorage rather than on the user record.
 *
 * Read through `useSyncExternalStore`, the way the sidebar's folded groups
 * are: localStorage does not exist on the server, so the server snapshot is
 * "cards" and React swaps in the stored value without a hydration mismatch.
 * A private window or blocked site data lands on cards, which is fine.
 *
 * Below `lg` the table is never rendered whatever is stored — the callers
 * hide it — so a phone that once saved "table" on a monitor still gets
 * cards. The toggle itself is only shown from `lg` for the same reason.
 */
export type ViewMode = "cards" | "table";

const PREFIX = "iksarva.admin.view.";
const listeners = new Set<() => void>();

function read(key: string): ViewMode {
  try {
    return window.localStorage.getItem(PREFIX + key) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useViewMode(key: string): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => "cards" as ViewMode,
  );
  const setMode = useCallback(
    (next: ViewMode) => {
      try {
        window.localStorage.setItem(PREFIX + key, next);
      } catch {
        // Not remembered; still applies to this visit through the listeners.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );
  return [mode, setMode];
}
