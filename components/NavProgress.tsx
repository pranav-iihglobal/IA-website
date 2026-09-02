"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin progress bar across the top during a navigation.
 *
 * The App Router gives no "navigation started" event, so this listens for
 * the click on an internal link — the moment the user commits — and clears
 * when the pathname changes. That covers link navigation, which is all of
 * it here; a browser back/forward is instant from the client cache and
 * never shows the bar.
 *
 * The bar creeps toward 90% rather than tracking real progress, because
 * there is no real number to track. It only appears after 120ms, so a fast
 * navigation flashes nothing at all.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const creep = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (creep.current) {
      clearInterval(creep.current);
      creep.current = null;
    }
  };

  // A completed navigation is the only "done" signal we get.
  useEffect(() => {
    stop();
    setProgress((current) => {
      if (current === null) return null;
      // Run to 100, then fade out.
      timers.current.push(setTimeout(() => setProgress(null), 260));
      return 100;
    });
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest?.("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page, or only the query/hash changed — no route swap to wait for.
      if (url.pathname === window.location.pathname) return;

      stop();
      timers.current.push(
        setTimeout(() => {
          setProgress(8);
          creep.current = setInterval(() => {
            setProgress((p) => {
              if (p === null) return null;
              // Ease off as it approaches the cap, so it never looks stuck
              // at a hard edge.
              return p >= 90 ? p : p + (90 - p) * 0.12;
            });
          }, 180);
        }, 120),
      );
    }

    /*
      Capture phase, not bubble. React attaches its own listeners at the root
      container, so next/link calls preventDefault() on the way up — by the
      time a bubbling listener on `document` sees the event, defaultPrevented
      is already true and every navigation looks cancelled.
    */
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stop();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <div
        className="admin-progress h-full bg-alloy transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress ?? 0}%`,
          opacity: progress === null ? 0 : 1,
        }}
      />
    </div>
  );
}
