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

/** Simple placeholder headshot for team members. PLACEHOLDER for real photos. */
export function PersonPlaceholder({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Photo placeholder"
      fill="none"
    >
      <rect width="120" height="120" rx="60" fill="#C2CBA3" />
      <circle cx="60" cy="46" r="20" fill="#FCFCE4" />
      <path d="M24 104c6-22 19-32 36-32s30 10 36 32" fill="#FCFCE4" />
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
