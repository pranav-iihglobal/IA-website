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

interface Crop extends Bi {
  emoji: string;
}

/**
 * Every crop our products serve — 100+ entries, each appearing exactly once.
 * (The strip is rendered twice in the DOM purely to make the scroll loop
 * seamless; with a list this long a crop never shows twice on screen.)
 * Emojis: Unicode has far fewer plant/food emojis than we have crops, so a
 * handful of close pairs share one — but no emoji is used more than twice,
 * and the two users are always spaced far apart in the strip.
 */
const CROPS: Crop[] = [
  /* Cereals & millets */
  { en: "Wheat", gu: "ઘઉં", emoji: "🌾" },
  { en: "Rice", gu: "ડાંગર", emoji: "🍚" },
  { en: "Maize", gu: "મકાઈ", emoji: "🌽" },
  { en: "Bajra", gu: "બાજરી", emoji: "🍞" },
  { en: "Jowar", gu: "જુવાર", emoji: "🎍" },
  { en: "Ragi", gu: "નાગલી", emoji: "🍂" },
  { en: "Barley", gu: "જવ", emoji: "🍺" },
  { en: "Amaranth", gu: "રાજગરો", emoji: "🌺" },
  /* Pulses */
  { en: "Chickpea", gu: "ચણા", emoji: "🧆" },
  { en: "Pigeon Pea", gu: "તુવેર", emoji: "🥣" },
  { en: "Moong", gu: "મગ", emoji: "🌱" },
  { en: "Urad", gu: "અડદ", emoji: "🌑" },
  { en: "Moth Bean", gu: "મઠ", emoji: "🍲" },
  { en: "Cowpea", gu: "ચોળા", emoji: "🌿" },
  { en: "Lentil", gu: "મસૂર", emoji: "🍜" },
  { en: "Kidney Bean", gu: "રાજમા", emoji: "🫘" },
  { en: "Field Pea", gu: "વટાણા", emoji: "🫛" },
  { en: "Val Bean", gu: "વાલ", emoji: "🍀" },
  { en: "Guar", gu: "ગુવાર", emoji: "☘️" },
  /* Oilseeds */
  { en: "Groundnut", gu: "મગફળી", emoji: "🥜" },
  { en: "Mustard", gu: "રાઈ", emoji: "🌼" },
  { en: "Castor", gu: "દિવેલા", emoji: "🌰" },
  { en: "Sesame", gu: "તલ", emoji: "🍘" },
  { en: "Soybean", gu: "સોયાબીન", emoji: "🥛" },
  { en: "Sunflower", gu: "સૂર્યમુખી", emoji: "🌻" },
  { en: "Safflower", gu: "કસુંબી", emoji: "🏵️" },
  { en: "Linseed", gu: "અળસી", emoji: "🫒" },
  /* Spices & herbs */
  { en: "Cumin", gu: "જીરું", emoji: "🌿" },
  { en: "Fennel", gu: "વરિયાળી", emoji: "🍃" },
  { en: "Coriander", gu: "ધાણા", emoji: "🪴" },
  { en: "Fenugreek", gu: "મેથી", emoji: "☘️" },
  { en: "Ajwain", gu: "અજમો", emoji: "🪻" },
  { en: "Dill", gu: "સૂવા", emoji: "🌲" },
  { en: "Chilli", gu: "મરચાં", emoji: "🌶️" },
  { en: "Turmeric", gu: "હળદર", emoji: "🍛" },
  { en: "Ginger", gu: "આદુ", emoji: "🫚" },
  { en: "Garlic", gu: "લસણ", emoji: "🧄" },
  /* Medicinal & aromatic */
  { en: "Isabgul", gu: "ઈસબગુલ", emoji: "🥛" },
  { en: "Ashwagandha", gu: "અશ્વગંધા", emoji: "💪" },
  { en: "Aloe Vera", gu: "કુંવારપાઠું", emoji: "🌵" },
  { en: "Tulsi", gu: "તુલસી", emoji: "🪷" },
  { en: "Mint", gu: "ફુદીનો", emoji: "🍬" },
  { en: "Lemongrass", gu: "લેમનગ્રાસ", emoji: "🍵" },
  { en: "Stevia", gu: "સ્ટીવિયા", emoji: "🍭" },
  /* Cash & fodder crops */
  { en: "Cotton", gu: "કપાસ", emoji: "☁️" },
  { en: "Sugarcane", gu: "શેરડી", emoji: "🎋" },
  { en: "Tobacco", gu: "તમાકુ", emoji: "🍂" },
  { en: "Lucerne", gu: "રજકો", emoji: "🌱" },
  { en: "Napier Grass", gu: "નેપિયર ઘાસ", emoji: "🐃" },
  /* Vegetables */
  { en: "Potato", gu: "બટાકા", emoji: "🥔" },
  { en: "Tomato", gu: "ટામેટાં", emoji: "🍅" },
  { en: "Onion", gu: "ડુંગળી", emoji: "🧅" },
  { en: "Brinjal", gu: "રીંગણ", emoji: "🍆" },
  { en: "Okra", gu: "ભીંડા", emoji: "🫑" },
  { en: "Cucumber", gu: "કાકડી", emoji: "🥒" },
  { en: "Bottle Gourd", gu: "દૂધી", emoji: "🍼" },
  { en: "Bitter Gourd", gu: "કારેલાં", emoji: "🥝" },
  { en: "Ridge Gourd", gu: "તુરિયાં", emoji: "🌙" },
  { en: "Sponge Gourd", gu: "ગલકાં", emoji: "🧽" },
  { en: "Ivy Gourd", gu: "ટીંડોળા", emoji: "🍒" },
  { en: "Pointed Gourd", gu: "પરવળ", emoji: "🍡" },
  { en: "Pumpkin", gu: "કોળું", emoji: "🎃" },
  { en: "Cabbage", gu: "કોબીજ", emoji: "🥬" },
  { en: "Cauliflower", gu: "ફુલાવર", emoji: "💮" },
  { en: "Broccoli", gu: "બ્રોકલી", emoji: "🥦" },
  { en: "Carrot", gu: "ગાજર", emoji: "🥕" },
  { en: "Beetroot", gu: "બીટ", emoji: "🍅" },
  { en: "Sweet Potato", gu: "શક્કરિયાં", emoji: "🍠" },
  { en: "Yam", gu: "સૂરણ", emoji: "🥔" },
  { en: "Colocasia", gu: "અળવી", emoji: "🪴" },
  { en: "Turnip", gu: "સલગમ", emoji: "🧅" },
  { en: "Lettuce", gu: "લેટ્યુસ", emoji: "🥗" },
  { en: "Spinach", gu: "પાલક", emoji: "🥬" },
  { en: "Drumstick", gu: "સરગવો", emoji: "🌳" },
  { en: "Curry Leaf", gu: "મીઠો લીમડો", emoji: "🍃" },
  { en: "Capsicum", gu: "શિમલા મરચું", emoji: "🫑" },
  { en: "Radish", gu: "મૂળા", emoji: "🥕" },
  /* Fruits */
  { en: "Pomegranate", gu: "દાડમ", emoji: "🍎" },
  { en: "Mango", gu: "કેરી", emoji: "🥭" },
  { en: "Banana", gu: "કેળાં", emoji: "🍌" },
  { en: "Lemon", gu: "લીંબુ", emoji: "🍋" },
  { en: "Sweet Lime", gu: "મોસંબી", emoji: "🥤" },
  { en: "Orange", gu: "સંતરા", emoji: "🍊" },
  { en: "Watermelon", gu: "તરબૂચ", emoji: "🍉" },
  { en: "Musk Melon", gu: "ટેટી", emoji: "🍈" },
  { en: "Guava", gu: "જામફળ", emoji: "🍐" },
  { en: "Papaya", gu: "પપૈયું", emoji: "🍑" },
  { en: "Chikoo", gu: "ચીકુ", emoji: "🌰" },
  { en: "Custard Apple", gu: "સીતાફળ", emoji: "🍏" },
  { en: "Grapes", gu: "દ્રાક્ષ", emoji: "🍇" },
  { en: "Coconut", gu: "નાળિયેર", emoji: "🥥" },
  { en: "Date Palm", gu: "ખારેક", emoji: "🌴" },
  { en: "Ber", gu: "બોર", emoji: "🍒" },
  { en: "Fig", gu: "અંજીર", emoji: "🍯" },
  { en: "Strawberry", gu: "સ્ટ્રોબેરી", emoji: "🍓" },
  { en: "Dragon Fruit", gu: "ડ્રેગન ફ્રૂટ", emoji: "🐉" },
  { en: "Amla", gu: "આમળાં", emoji: "🫒" },
  { en: "Jamun", gu: "જાંબુ", emoji: "🫐" },
  /* Flowers */
  { en: "Rose", gu: "ગુલાબ", emoji: "🌹" },
  { en: "Marigold", gu: "ગલગોટા", emoji: "🌼" },
  { en: "Jasmine", gu: "મોગરો", emoji: "🌸" },
  { en: "Chrysanthemum", gu: "સેવંતી", emoji: "🏵️" },
  { en: "Tuberose", gu: "રજનીગંધા", emoji: "💐" },
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
                className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-cornsilk"
              >
                <span className="text-base" aria-hidden="true">
                  {crop.emoji}
                </span>
                <T text={crop} />
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
