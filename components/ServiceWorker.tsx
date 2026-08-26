"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Deliberately not registered in development: a worker caching localhost is
 * a reliable source of "why is my change not showing up". It also stays out
 * of the way on first paint — registration waits for `load`, so it never
 * competes with the page's own requests.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration is not worth bothering anyone about — the
        // site works fine without it.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
