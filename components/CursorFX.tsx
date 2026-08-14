"use client";

import { useEffect, useRef } from "react";

/**
 * Custom cursor: an alloy-orange dot with a trailing olive ring that grows
 * over links/buttons, plus little seed particles that scatter as you move —
 * like sowing seeds across the page. Desktop pointers only; disabled on
 * touch devices and for prefers-reduced-motion users.
 */
export function CursorFX() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!finePointer || reducedMotion) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.body.classList.add("cursor-fx");
    dot.style.opacity = "0";
    ring.style.opacity = "0";

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let raf = 0;
    let lastSeed = 0;

    const seedColors = ["#A9B489", "#BA9470", "#C66828", "#7F8F6E"];

    const spawnSeed = (x: number, y: number) => {
      const seed = document.createElement("span");
      seed.className = "cursor-seed";
      const dx = (Math.random() - 0.5) * 40;
      seed.style.setProperty("--seed-dx", `${dx}px`);
      seed.style.left = `${x - 5}px`;
      seed.style.top = `${y - 5}px`;
      const color = seedColors[Math.floor(Math.random() * seedColors.length)];
      seed.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10"><ellipse cx="5" cy="5" rx="4.5" ry="2.8" fill="${color}" transform="rotate(${Math.floor(Math.random() * 180)} 5 5)"/></svg>`;
      seed.addEventListener("animationend", () => seed.remove());
      document.body.appendChild(seed);
    };

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.opacity = "1";
      ring.style.opacity = "";
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;

      const now = performance.now();
      if (now - lastSeed > 130) {
        lastSeed = now;
        spawnSeed(mouseX, mouseY);
      }
    };

    const onOver = (e: MouseEvent) => {
      const interactive = (e.target as Element | null)?.closest(
        "a, button, [role='button']",
      );
      ring.classList.toggle("is-hover", Boolean(interactive));
    };

    const onLeave = () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const tick = () => {
      // Ring trails the dot with a soft lerp.
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove("cursor-fx");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
