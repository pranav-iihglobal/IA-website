"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Fades and lifts page content in when you navigate.
 *
 * Keyed on the pathname, so React tears down the old subtree and mounts a
 * fresh one — which restarts the CSS animation without any JS timing. No exit
 * animation: the App Router has already swapped the content by the time we
 * could play one, and a fake delay to fit one in would make the site feel
 * slower, not smoother.
 *
 * Deliberately NOT applied on the first load. The animation is
 * `route-fade-in ... both`, and `both` applies the from-state before the
 * animation starts — so the whole page began at opacity 0 and faded in over
 * 260ms on arrival. Largest Contentful Paint does not complete until the
 * content is actually visible, so this was charging every cold visit a
 * quarter of a second of LCP to transition from nothing to something. There
 * is no previous page to transition from on the first load; the polish is
 * only meaningful between pages.
 *
 * `prefers-reduced-motion` disables the whole thing in CSS (see .route-fade),
 * so this component still renders — it just doesn't move.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  /*
    The path this component first rendered with. The <div> is keyed, not the
    component, so state here survives navigation.
  */
  const [initialPath] = useState(pathname);
  /*
    Latched once you have navigated at all, so coming BACK to the first page
    later still animates. Without it, returning to where you started would be
    the one navigation that did not.
  */
  const [everNavigated, setEverNavigated] = useState(false);

  useEffect(() => {
    if (pathname !== initialPath) setEverNavigated(true);
  }, [pathname, initialPath]);

  const animate = everNavigated || pathname !== initialPath;

  return (
    <div key={pathname} className={animate ? "route-fade" : undefined}>
      {children}
    </div>
  );
}
