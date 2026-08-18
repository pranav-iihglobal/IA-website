/*
 * PLACEHOLDER ILLUSTRATIONS — all imagery on the site is inline SVG so pages
 * stay fast on slow connections. Each component below is marked for later
 * replacement with real photography/artwork (swap for <Image> from
 * next/image when real photos are ready — Vercel will serve WebP/AVIF
 * automatically).
 */

/** Hero illustration: plant with deep roots. PLACEHOLDER for real field photo. */
export function HeroRoots({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Illustration of a crop plant with deep healthy roots"
      fill="none"
    >
      <rect width="400" height="400" rx="24" fill="#F9ECC9" />
      {/* soil line */}
      <path d="M0 230h400v146a24 24 0 0 1-24 24H24a24 24 0 0 1-24-24V230Z" fill="#BA9470" />
      <path d="M0 230h400v18H0z" fill="#9E7A5C" />
      {/* sun */}
      <circle cx="322" cy="78" r="34" fill="#D47A42" />
      {/* stem and leaves */}
      <path d="M200 230V96" stroke="#5E7153" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M200 150c-34-6-52-26-54-54 30 2 50 20 54 54ZM200 118c34-6 52-26 54-54-30 2-50 20-54 54ZM200 190c-28-4-44-20-46-44 24 2 42 18 46 44ZM200 176c28-4 44-20 46-44-24 2-42 18-46 44Z"
        fill="#7F8F6E"
      />
      <path
        d="M200 150c-34-6-52-26-54-54M200 118c34-6 52-26 54-54M200 190c-28-4-44-20-46-44M200 176c28-4 44-20 46-44"
        stroke="#4A5A42"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* roots */}
      <path
        d="M200 230v92M200 250c-22 8-34 24-38 48M200 250c22 8 34 24 38 48M200 274c-34 4-52 16-62 38M200 274c34 4 52 16 62 38M200 296c-14 6-20 14-24 28M200 296c14 6 20 14 24 28"
        stroke="#FCFCE4"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* mycorrhizal dots */}
      <g fill="#C2CBA3">
        <circle cx="140" cy="300" r="4" />
        <circle cx="260" cy="304" r="4" />
        <circle cx="170" cy="330" r="4" />
        <circle cx="232" cy="332" r="4" />
        <circle cx="120" cy="330" r="3" />
        <circle cx="282" cy="330" r="3" />
      </g>
    </svg>
  );
}

/** Product art: 25g sachet (FloraMax). PLACEHOLDER for real pack shot. */
export function SachetArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Illustration of a 25 gram product sachet"
      fill="none"
    >
      <rect width="200" height="200" rx="16" fill="#FAF2E0" />
      <rect x="56" y="36" width="88" height="128" rx="10" fill="#5E7153" />
      <rect x="56" y="36" width="88" height="18" rx="9" fill="#4A5A42" />
      <rect x="68" y="70" width="64" height="52" rx="8" fill="#FCFCE4" />
      <path
        d="M100 82c8 5 12 11 12 17 0 8-5 13-12 13s-12-5-12-13c0-6 4-12 12-17Z"
        fill="#C66828"
      />
      <text
        x="100"
        y="146"
        textAnchor="middle"
        fill="#FCFCE4"
        fontFamily="Georgia, serif"
        fontSize="16"
        fontWeight="bold"
      >
        25g
      </text>
    </svg>
  );
}

/** Product art: root network (Mycorrhizal Bio-Fertilizer). PLACEHOLDER for real imagery. */
export function RootsArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Illustration of roots extended by fungal threads"
      fill="none"
    >
      <rect width="200" height="200" rx="16" fill="#FAF2E0" />
      <path d="M0 84h200v100a16 16 0 0 1-16 16H16a16 16 0 0 1-16-16V84Z" fill="#BA9470" />
      <path d="M100 84V40" stroke="#5E7153" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M100 62c-16-3-25-12-26-26 14 1 23 10 26 26ZM100 52c16-3 25-12 26-26-14 1-23 10-26 26Z"
        fill="#7F8F6E"
      />
      <path
        d="M100 84v70M100 100c-16 6-24 16-28 34M100 100c16 6 24 16 28 34M100 122c-24 2-36 10-44 26M100 122c24 2 36 10 44 26"
        stroke="#FCFCE4"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M72 134c-8 2-14 6-18 12M128 134c8 2 14 6 18 12M86 152c-6 4-9 8-11 14M114 152c6 4 9 8 11 14"
        stroke="#C2CBA3"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 5"
      />
    </svg>
  );
}

/** Product art: bacterial network (NPK Consortia). PLACEHOLDER for real imagery. */
export function NetworkArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Illustration of a network of beneficial bacteria"
      fill="none"
    >
      <rect width="200" height="200" rx="16" fill="#FAF2E0" />
      <path
        d="M100 100 60 60m40 40 44-32m-44 32-48 28m48-28 36 44m-36-44 4-56"
        stroke="#A9B489"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="18" fill="#5E7153" />
      <circle cx="60" cy="60" r="12" fill="#C66828" />
      <circle cx="144" cy="68" r="12" fill="#7F8F6E" />
      <circle cx="52" cy="128" r="12" fill="#BA9470" />
      <circle cx="136" cy="144" r="12" fill="#8A9A6E" />
      <circle cx="104" cy="44" r="9" fill="#D47A42" />
      <text
        x="100"
        y="105"
        textAnchor="middle"
        fill="#FCFCE4"
        fontFamily="Georgia, serif"
        fontSize="12"
        fontWeight="bold"
      >
        NPK
      </text>
    </svg>
  );
}

/**
 * Founder doodles — friendly illustrated stand-ins until real photos are
 * ready. "agri": field-operations co-founder with turban and leaf sprig;
 * "tech": technology co-founder with glasses.
 */
export function FounderDoodle({
  variant,
  className = "",
}: {
  variant: "agri" | "tech";
  className?: string;
}) {
  if (variant === "agri") {
    return (
      <svg
        viewBox="0 0 120 120"
        className={className}
        role="img"
        aria-label="Doodle of the agri science co-founder"
        fill="none"
      >
        <circle cx="60" cy="60" r="60" fill="#C2CBA3" />
        {/* kurta */}
        <path d="M22 108c6-24 20-34 38-34s32 10 38 34Z" fill="#5E7153" />
        <path d="M52 76l8 11 8-11" stroke="#FCFCE4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* head */}
        <circle cx="60" cy="49" r="19" fill="#C68B59" />
        {/* smile + eyes */}
        <circle cx="53" cy="50" r="2.2" fill="#3E2A20" />
        <circle cx="67" cy="50" r="2.2" fill="#3E2A20" />
        <path d="M53 58c2.5 3.5 4.5 4.5 7 4.5s4.5-1 7-4.5" stroke="#3E2A20" strokeWidth="2" strokeLinecap="round" />
        {/* turban */}
        <path d="M39 44c1-14 9-22 21-22s20 8 21 22c-6-8-12-11-21-11s-15 3-21 11Z" fill="#BA9470" />
        <path d="M39 44c6-6 12-9 21-9s15 3 21 9c0 2-1 4-3 4H42c-2 0-3-2-3-4Z" fill="#9E7A5C" />
        {/* leaf sprig on shoulder */}
        <path d="M86 88c6-8 6-14 2-20 -2 7-6 11-8 13" stroke="#4A5A42" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M88 72c4-1 7-4 8-8-5 0-8 2-10 5Z" fill="#4A5A42" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Doodle of the technology co-founder"
      fill="none"
    >
      <circle cx="60" cy="60" r="60" fill="#F9ECC9" />
      {/* shirt */}
      <path d="M22 108c6-24 20-34 38-34s32 10 38 34Z" fill="#8F4F33" />
      <path d="M52 76l8 9 8-9" fill="#FAF2E0" />
      {/* head */}
      <circle cx="60" cy="49" r="19" fill="#D09A6A" />
      {/* hair */}
      <path d="M41 46c0-13 8-21 19-21s19 8 19 21c-4-7-10-11-19-11s-15 4-19 11Z" fill="#3E2A20" />
      {/* glasses */}
      <circle cx="52" cy="51" r="7" stroke="#4A5A42" strokeWidth="2.5" />
      <circle cx="68" cy="51" r="7" stroke="#4A5A42" strokeWidth="2.5" />
      <path d="M59 51h2" stroke="#4A5A42" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="52" cy="52" r="2" fill="#3E2A20" />
      <circle cx="68" cy="52" r="2" fill="#3E2A20" />
      {/* smile */}
      <path d="M54 61c2 2.5 4 3.5 6 3.5s4-1 6-3.5" stroke="#3E2A20" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Organic wave divider between sections. */
export function WaveDivider({
  className = "",
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      className={`block h-8 w-full sm:h-12 ${flip ? "rotate-180" : ""} ${className}`}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M0 32C180 8 360 0 540 12s330 34 510 34 300-18 390-30v48H0V32Z" />
    </svg>
  );
}
