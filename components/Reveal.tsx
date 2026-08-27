"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper: children fade/slide in the first time they enter the
 * viewport. Pure CSS transitions (see globals.css) — the observer only adds a
 * class, so it costs nothing after the first reveal. Respects
 * prefers-reduced-motion via the CSS override.
 *
 * `immediate` is for anything above the fold, and it is not a nicety.
 * `.reveal` sets opacity:0 in the server-rendered HTML and only clears it
 * once the client has hydrated and an IntersectionObserver has fired. On the
 * home page that meant the hero headline — the Largest Contentful Paint
 * element — stayed invisible for 4.3 seconds on a throttled phone, and would
 * have stayed invisible forever if the JavaScript had failed to load. Content
 * you can already see when the page opens has nothing to reveal itself from.
 */
export function Reveal({
  children,
  className = "",
  direction = "up",
  delay = 0,
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
  delay?: number;
  /** Renders visible with no animation. Use for above-the-fold content. */
  immediate?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (immediate) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  // No `reveal` class at all: the element is simply visible from the start.
  const dirClass = immediate
    ? ""
    : direction === "left"
      ? "reveal reveal-left"
      : direction === "right"
        ? "reveal reveal-right"
        : "reveal";

  return (
    <div
      ref={ref}
      className={`${dirClass} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
