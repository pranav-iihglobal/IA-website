/** Decorative ambient elements — pure CSS animations, zero JS. */

function Leaf({ color = "#A9B489" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" aria-hidden="true">
      <path
        d="M12 2c5 3.5 8 8 8 12a8 8 0 1 1-16 0c0-4 3-8.5 8-12Z"
        fill={color}
        opacity="0.85"
      />
      <path d="M12 6v14" stroke="#4A5A42" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/**
 * Scattered drifting leaves for section backgrounds. Absolutely positioned,
 * pointer-events-none; parent must be `relative overflow-hidden`.
 */
export function FloatingLeaves() {
  const leaves: {
    top: string;
    left?: string;
    right?: string;
    size: string;
    delay: string;
    color: string;
    anim: string;
  }[] = [
    { top: "12%", left: "4%", size: "h-8 w-8", delay: "0s", color: "#A9B489", anim: "animate-drift" },
    { top: "65%", left: "8%", size: "h-6 w-6", delay: "-4s", color: "#CBAF8A", anim: "animate-float" },
    { top: "20%", right: "6%", size: "h-7 w-7", delay: "-8s", color: "#7F8F6E", anim: "animate-drift" },
    { top: "72%", right: "10%", size: "h-5 w-5", delay: "-2s", color: "#D47A42", anim: "animate-float" },
    { top: "40%", left: "46%", size: "h-4 w-4", delay: "-6s", color: "#C2CBA3", anim: "animate-drift" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {leaves.map((l, i) => (
        <div
          key={i}
          className={`absolute ${l.size} ${l.anim} opacity-70`}
          style={{
            top: l.top,
            left: l.left,
            right: l.right,
            animationDelay: l.delay,
          }}
        >
          <Leaf color={l.color} />
        </div>
      ))}
    </div>
  );
}

import { T } from "./T";
import type { Bi } from "@/lib/content";

/**
 * Every crop we serve — each appears exactly once in the list. (The strip is
 * rendered twice in the DOM purely to make the scroll loop seamless; with a
 * list this long, a crop never shows twice on screen at the same time.)
 */
const CROPS: Bi[] = [
  { en: "Potato", gu: "બટાકા" },
  { en: "Pomegranate", gu: "દાડમ" },
  { en: "Cumin", gu: "જીરું" },
  { en: "Ashwagandha", gu: "અશ્વગંધા" },
  { en: "Watermelon", gu: "તરબૂચ" },
  { en: "Musk Melon", gu: "ટેટી" },
  { en: "Castor", gu: "દિવેલા" },
  { en: "Cotton", gu: "કપાસ" },
  { en: "Wheat", gu: "ઘઉં" },
  { en: "Maize", gu: "મકાઈ" },
  { en: "Fennel", gu: "વરિયાળી" },
  { en: "Isabgul", gu: "ઈસબગુલ" },
  { en: "Groundnut", gu: "મગફળી" },
  { en: "Mustard", gu: "રાઈ" },
  { en: "Bajra", gu: "બાજરી" },
  { en: "Chickpea", gu: "ચણા" },
  { en: "Sesame", gu: "તલ" },
  { en: "Guar", gu: "ગુવાર" },
  { en: "Moong", gu: "મગ" },
  { en: "Pigeon Pea", gu: "તુવેર" },
  { en: "Tomato", gu: "ટામેટાં" },
  { en: "Chilli", gu: "મરચાં" },
  { en: "Onion", gu: "ડુંગળી" },
  { en: "Garlic", gu: "લસણ" },
  { en: "Okra", gu: "ભીંડા" },
  { en: "Brinjal", gu: "રીંગણ" },
  { en: "Cucumber", gu: "કાકડી" },
  { en: "Lemon", gu: "લીંબુ" },
  { en: "Guava", gu: "જામફળ" },
  { en: "Papaya", gu: "પપૈયું" },
  { en: "Banana", gu: "કેળાં" },
  { en: "Sugarcane", gu: "શેરડી" },
  { en: "Lucerne", gu: "રજકો" },
];

/** Infinite scrolling strip of the crops we serve. Pauses on hover. */
export function CropsMarquee() {
  return (
    <div className="overflow-hidden bg-olive py-3" aria-hidden="true">
      <div className="animate-marquee flex w-max items-center">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-8 pr-8">
            {CROPS.map((crop, i) => (
              <span
                key={`${half}-${i}`}
                className="flex items-center gap-8 whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-cornsilk"
              >
                <T text={crop} />
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-laurel-light" fill="currentColor">
                  <path d="M6 0c1.5 2 2.5 4 2.5 6S7.5 10 6 12C4.5 10 3.5 8 3.5 6S4.5 2 6 0Z" />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="sr-only">
        Crops we serve: {CROPS.map((c) => c.en).join(", ")} — across North
        Gujarat.
      </p>
    </div>
  );
}
