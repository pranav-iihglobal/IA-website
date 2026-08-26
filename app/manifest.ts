import { existsSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { anyIcons, maskableIcons } from "@/lib/app-icons";
import { SITE } from "@/lib/content";

/**
 * Screenshots power Chrome's richer install dialog — the one that shows the
 * app before you install it instead of a bare name and icon. They are
 * optional: drop the files into public/screenshots and they appear here on
 * the next build. A manifest that lists a missing screenshot is invalid, so
 * each one is only included if the file is actually on disk.
 *
 * Android wants at least one `narrow` (phone) shot; `wide` is what desktop
 * Chrome shows. Give both if you have them.
 */
const SCREENSHOTS: {
  src: string;
  sizes: string;
  form_factor: "narrow" | "wide";
  label: string;
}[] = [
  {
    src: "/screenshots/mobile-home.png",
    sizes: "1080x1920",
    form_factor: "narrow",
    label: "IKSARVA home page on a phone",
  },
  {
    src: "/screenshots/mobile-products.png",
    sizes: "1080x1920",
    form_factor: "narrow",
    label: "Product range",
  },
  {
    src: "/screenshots/desktop-home.png",
    sizes: "1920x1080",
    form_factor: "wide",
    label: "IKSARVA home page",
  },
];

function availableScreenshots() {
  return SCREENSHOTS.filter((shot) =>
    existsSync(path.join(process.cwd(), "public", shot.src)),
  );
}

/**
 * Web app manifest, served at /manifest.webmanifest.
 *
 * Gujarati-first, matching the site itself: a farmer who installs this to
 * their home screen should see the name they recognise. `lang: "gu"` tells
 * the launcher which script the name is in.
 *
 * `id` is set explicitly so the install identity survives a change of
 * start_url later — without it the browser derives the id from start_url and
 * a change orphans the existing installs.
 */
export default function manifest(): MetadataRoute.Manifest {
  const screenshots = availableScreenshots();
  const icons = [...anyIcons(), ...maskableIcons()];
  // Reuse whichever 192 actually exists, rather than naming a file that may
  // not be in this particular icon export.
  const shortcutIcon = icons.find((icon) => icon.sizes === "192x192");
  const withIcon = (name: string, short: string, url: string) => ({
    name,
    short_name: short,
    url,
    ...(shortcutIcon
      ? { icons: [{ src: shortcutIcon.src, sizes: shortcutIcon.sizes }] }
      : {}),
  });
  return {
    id: "/",
    name: `${SITE.shortName} — ${SITE.tagline}`,
    // Not SITE.shortName ("IKSARVA Agritech") — a home-screen label is
    // truncated past about 12 characters, and the brand is the first word.
    short_name: "IKSARVA",
    description:
      "ઉત્તર ગુજરાતમાં બનેલાં જૈવિક ખાતર — માયકોરાઇઝા કલ્ચર, NPK બેક્ટેરિયા અને બાયોસ્ટિમ્યુલન્ટ. Biofertilizers made in North Gujarat.",
    lang: "gu",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // --color-meringue-light, so the splash screen matches the hero band
    // rather than flashing white before the page paints.
    background_color: "#faf2e0",
    // --color-olive, the header colour, which the browser tints its chrome to.
    theme_color: "#5e7153",
    categories: ["business", "shopping", "education"],
    icons,
    ...(screenshots.length > 0 ? { screenshots } : {}),
    shortcuts: [
      withIcon("પ્રોડક્ટ્સ", "પ્રોડક્ટ્સ", "/products"),
      withIcon("ખેડૂતોના અનુભવ", "અનુભવ", "/testimonials"),
      withIcon("જાણકારી", "જાણકારી", "/learn"),
    ],
  };
}
