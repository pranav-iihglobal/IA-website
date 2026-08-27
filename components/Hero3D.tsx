"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HeroRoots } from "./Illustrations";

/*
  three.js and @react-three/fiber are 872 kB of JavaScript — more than the
  rest of the site put together. Loading it lazily was not enough: `dynamic`
  still fetches the moment the component mounts, so every visitor paid for it
  the instant the page hydrated, including a farmer on a phone on rural data
  who is here to read about a fertiliser.

  So it is now conditional, not merely deferred. The scene is a decorative
  flourish; HeroRoots is a real illustration, not a placeholder, and the page
  is complete with it. Anyone who does not clearly benefit keeps the SVG and
  never downloads the bundle at all.
*/
const Scene = dynamic(() => import("./Hero3DScene"), {
  ssr: false,
  loading: () => <HeroRoots className="h-full w-full" />,
});

/** Narrow shape of the Network Information API, which TS does not ship. */
interface Connection {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Whether this device should spend 872 kB on decoration.
 *
 * Read after mount, never during render: every input here is browser-only,
 * and guessing on the server then correcting on the client would mean
 * downloading the bundle before finding out we did not want it.
 */
function useCanAffordScene(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The scene is an ornament beside the headline; below lg it is not even
    // in the layout's second column. Phones get the illustration.
    const roomy = window.matchMedia("(min-width: 1024px)").matches;

    const connection = (
      navigator as Navigator & { connection?: Connection }
    ).connection;
    const thrifty =
      connection?.saveData === true ||
      ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");

    // Absent on Safari and Firefox, so only ever used to say no.
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    const weak = typeof memory === "number" && memory < 4;

    setOk(roomy && !reduced && !thrifty && !weak);
  }, []);

  return ok;
}

export function Hero3D() {
  const canAfford = useCanAffordScene();

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-meringue to-cornsilk-dark/60 shadow-inner md:max-w-lg"
      aria-hidden="false"
    >
      {canAfford ? <Scene /> : <HeroRoots className="h-full w-full" />}
    </div>
  );
}
