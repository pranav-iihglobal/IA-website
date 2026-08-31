import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves the app icon set from whatever is actually on disk, at build time.
 *
 * Icon exports differ by tool — PWABuilder gives you android/ios/windows
 * folders, a designer might hand you six loose files — and a manifest that
 * lists a file which is not there is invalid, which breaks installability
 * outright. So nothing is hardcoded: every candidate is checked, and only
 * the ones present are listed.
 *
 * Server-only (it touches the filesystem). Import from manifest.ts and
 * layout.tsx, never from a client component.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");

function has(publicPath: string): boolean {
  return existsSync(path.join(PUBLIC_DIR, publicPath));
}

/** The first of these that exists, or null. */
function firstOf(...candidates: string[]): string | null {
  return candidates.find(has) ?? null;
}

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: "any" | "maskable";
}

/**
 * Icons shown as-is by the launcher.
 *
 * Listing the whole ladder rather than just 192 and 512 lets a launcher pick
 * the size it actually wants instead of downscaling the 512 every time.
 * PWABuilder's android/ folder is checked first, then the flat names this
 * repo generates.
 */
export function anyIcons(): ManifestIcon[] {
  const sizes = [48, 72, 96, 144, 192, 512];
  const icons: ManifestIcon[] = [];

  for (const size of sizes) {
    const src = firstOf(
      `/icons/android/launchericon-${size}x${size}.png`,
      `/icons/icon-${size}.png`,
      `/icons/ios/${size}.png`,
    );
    if (src) {
      icons.push({
        src,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any",
      });
    }
  }
  return icons;
}

/**
 * Icons the launcher crops to its own shape.
 *
 * Android masks these to a circle, squircle or rounded square, so the art
 * has to sit inside the middle 80%. A full-bleed icon listed as maskable
 * gets its edges shaved off — which is why these are kept separate from the
 * `any` set rather than reusing the same files.
 */
export function maskableIcons(): ManifestIcon[] {
  const icons: ManifestIcon[] = [];
  for (const size of [192, 512]) {
    const src = firstOf(
      `/icons/maskable-${size}.png`,
      `/icons/icon-maskable-${size}.png`,
    );
    if (src) {
      icons.push({
        src,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "maskable",
      });
    }
  }
  return icons;
}

/** 180x180, the only size iOS reads for the home screen. */
export function appleTouchIcon(): string | null {
  return firstOf("/icons/ios/180.png", "/icons/apple-touch-icon.png");
}

/**
 * PNG favicons, for browsers and crawlers that ignore the SVG one.
 *
 * Multiples of 48, which is what Google asks for. These were 16 and 32 —
 * below the recommended floor, and taken from the iOS set, which is the tall
 * cream arch. Google requires a SQUARE favicon and showed a generic globe in
 * the results instead of anything of ours.
 *
 * The purpose-built favicon-* files are checked FIRST. The iOS fallback is
 * kept for sizes they do not cover, but it must never win where a real
 * square favicon exists — /icons/ios/192.png does exist, and preferring it
 * would quietly reinstate the icon this set replaces.
 */
export function faviconPngs(): { url: string; sizes: string }[] {
  return [48, 96, 192]
    .map((size) => {
      const url = firstOf(
        `/icons/favicon-${size}.png`,
        `/icons/ios/${size}.png`,
      );
      return url ? { url, sizes: `${size}x${size}` } : null;
    })
    .filter((icon): icon is { url: string; sizes: string } => icon !== null);
}
