"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Fades and lifts page content in on every navigation.
 *
 * Keyed on the pathname, so React tears down the old subtree and mounts a
 * fresh one — which restarts the CSS animation without any JS timing. No
 * exit animation: the App Router has already swapped the content by the time
 * we could play one, and a fake delay to fit one in would make the site feel
 * slower, not smoother.
 *
 * `prefers-reduced-motion` disables the whole thing in CSS (see .route-fade),
 * so this component still renders — it just doesn't move.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-fade">
      {children}
    </div>
  );
}
