"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper: children fade/slide in the first time they enter the
 * viewport. Pure CSS transitions (see globals.css) — the observer only adds a
 * class, so it costs nothing after the first reveal. Respects
 * prefers-reduced-motion via the CSS override.
 */
export function Reveal({
  children,
  className = "",
  direction = "up",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

  const dirClass =
    direction === "left"
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
