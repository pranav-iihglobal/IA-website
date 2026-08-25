/**
 * Cloudinary delivery helpers.
 *
 * Pure string manipulation — safe in both server and client components, no
 * SDK import (the Node SDK stays server-only for signing and deletion).
 *
 * Every public image goes through `f_auto,q_auto` so Cloudinary picks the
 * best format (AVIF/WebP) and quality per browser.
 */

/** Named transforms used across the site. */
export const CLD = {
  /** Product card thumbnail — matches the card's 16:9-ish crop. */
  cardThumb: "f_auto,q_auto,c_fill,g_auto,w_800,h_600",
  /** Product detail hero. */
  productDetail: "f_auto,q_auto,c_limit,w_1200",
  /** Blog cover image. */
  blogCover: "f_auto,q_auto,c_fill,g_auto,w_1600,h_900",
  /** Small square thumb for admin lists and testimonial photos. */
  thumb: "f_auto,q_auto,c_fill,g_auto,w_240,h_240",
} as const;

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes("res.cloudinary.com") && url.includes("/upload/"));
}

/**
 * Insert a transformation into a Cloudinary delivery URL.
 * Non-Cloudinary URLs (e.g. /products/floramax.jpg from /public) pass through
 * untouched so local assets keep working.
 */
export function cldUrl(
  url: string | null | undefined,
  transform: string = CLD.cardThumb,
): string | null {
  if (!url) return null;
  if (!isCloudinaryUrl(url)) return url;
  // .../image/upload/<existing?>/v123/folder/name.jpg
  return url.replace("/upload/", `/upload/${transform}/`);
}
