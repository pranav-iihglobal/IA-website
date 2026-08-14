"use client";

import dynamic from "next/dynamic";
import { HeroRoots } from "./Illustrations";

// three.js is heavy, so the scene loads lazily after first paint; the SVG
// illustration shows instantly and is swapped out when the 3D scene is ready.
const Scene = dynamic(() => import("./Hero3DScene"), {
  ssr: false,
  loading: () => <HeroRoots className="h-full w-full" />,
});

export function Hero3D() {
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-meringue to-cornsilk-dark/60 shadow-inner md:max-w-lg"
      aria-hidden="false"
    >
      <Scene />
    </div>
  );
}
