import fs from "fs";
import path from "path";

/**
 * Real product pack shots — automatic discovery at build time.
 *
 * Drop an image at public/products/<slug>.jpg (or .png / .webp), e.g.:
 *   public/products/npk-consortia.jpg
 *   public/products/mycho.jpg
 *   public/products/floramax.jpg
 * and the site swaps that product's SVG placeholder for the photo on the
 * next build — no code change needed. next/image serves it as WebP/AVIF in
 * responsive sizes on Vercel.
 *
 * Server-only helper: call it from Server Components (never from a module
 * with "use client").
 */

const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function getProductImage(slug: string): string | null {
  for (const ext of EXTENSIONS) {
    const rel = `/products/${slug}.${ext}`;
    if (fs.existsSync(path.join(process.cwd(), "public", rel))) {
      return rel;
    }
  }
  return null;
}
