import { SITE } from "./content";

/**
 * The site's default social preview image.
 *
 * Next merges metadata shallowly: a page that defines `openGraph` REPLACES
 * the parent's object rather than filling in around it, so the root layout's
 * `images` was silently dropped by every single page that set a title. The
 * result was that no page on the site had an og:image — every link shared to
 * WhatsApp previewed as a grey box, which for this business is the main way
 * anyone sees a link at all.
 *
 * So every page spreads this in explicitly. Pages with a real image of their
 * own — a product photo, an article cover — pass theirs instead.
 */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `${SITE.shortName} — ${SITE.tagline}`,
} as const;

/** Page images if there are any, otherwise the site default. */
export function ogImages(
  images?: { url: string }[] | null,
): { url: string }[] {
  return images && images.length > 0 ? images : [OG_IMAGE];
}
