/**
 * Fills in the app icons that are missing.
 *
 * Most icon exports (PWABuilder, RealFaviconGenerator, a designer's zip) give
 * you a full ladder of ordinary icons and no **maskable** ones — and maskable
 * is the pair that actually matters on Android, because the launcher crops
 * every icon to its own shape. A full-bleed icon listed as maskable comes out
 * with its edges shaved off.
 *
 * So this script:
 *   1. finds the best square source it can (your own 512 if you dropped one
 *      in, otherwise public/logo.svg),
 *   2. writes any missing `any` icon from it,
 *   3. writes the maskable pair by shrinking that source to 60% on a brand
 *      background, which keeps everything inside the safe zone.
 *
 * It never overwrites a file that is already there — hand-made artwork always
 * wins. Pass --force to regenerate everything anyway.
 *
 *   npm run icons
 *   npm run icons -- --force
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");

/** --color-olive, the brand green the header and sidebar already use. */
const BACKGROUND = "#5e7153";

/**
 * Android crops maskable icons to a circle, squircle or rounded square. The
 * spec's safe zone is a circle of 80% diameter, so 60% of the width leaves
 * comfortable room on every shape.
 */
const MASKABLE_INSET = 0.6;

const FORCE = process.argv.includes("--force");

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * The best square artwork available, largest first.
 *
 * A real icon beats the logo SVG: the logo is a tall shield that has to be
 * letterboxed onto a square, whereas an exported icon is already composed.
 */
async function findSource(): Promise<{ buffer: Buffer; label: string }> {
  const candidates = [
    "icons/android/launchericon-512x512.png",
    "icons/icon-512.png",
    "icons/ios/1024.png",
    "icons/ios/512.png",
  ];
  for (const relative of candidates) {
    const file = path.join(PUBLIC_DIR, relative);
    if (await exists(file)) {
      return { buffer: await readFile(file), label: relative };
    }
  }
  return {
    buffer: await readFile(path.join(PUBLIC_DIR, "logo.svg")),
    label: "logo.svg (no exported icon found)",
  };
}

/** Centre `source` on a square brand-coloured tile. */
async function tile(source: Buffer, size: number, inset: number) {
  const glyph = await sharp(source, { density: 600 })
    .resize({
      width: Math.round(size * inset),
      height: Math.round(size * inset),
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toBuffer();
}

async function write(name: string, make: () => Promise<Buffer>) {
  const file = path.join(ICONS_DIR, name);
  if (!FORCE && (await exists(file))) {
    console.log(`  ${name.padEnd(26)} kept`);
    return false;
  }
  await writeFile(file, await make());
  console.log(`  ${name.padEnd(26)} written`);
  return true;
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const { buffer: source, label } = await findSource();
  console.log(`Source: ${label}\n`);

  // The maskable pair — the whole reason this script exists.
  await write("maskable-192.png", () => tile(source, 192, MASKABLE_INSET));
  await write("maskable-512.png", () => tile(source, 512, MASKABLE_INSET));

  // Fallbacks, only used when there is no exported icon at that size.
  // lib/app-icons.ts prefers icons/android/* and icons/ios/* over these.
  for (const size of [192, 512]) {
    await write(`icon-${size}.png`, () => tile(source, size, 0.82));
  }
  await write("apple-touch-icon.png", () => tile(source, 180, 0.7));
  await write("favicon-32.png", () => tile(source, 32, 0.82));

  await writeFile(
    path.join(ICONS_DIR, "README.md"),
    [
      "# App icons",
      "",
      "`lib/app-icons.ts` resolves this folder at build time and lists only the",
      "files that actually exist, so an icon export can be dropped in whole",
      "without renaming anything.",
      "",
      "## Dropping in an export",
      "",
      "Copy the folders from your icon generator in as they come:",
      "",
      "```",
      "public/icons/android/launchericon-{48,72,96,144,192,512}x{...}.png",
      "public/icons/ios/{16,32,180,192,512,1024,...}.png",
      "public/icons/windows/...        # not used by the web manifest",
      "```",
      "",
      "Then run `npm run icons` once. Everything the manifest needs is picked",
      "up automatically except the maskable pair, which almost no exporter",
      "produces — the script generates those from your 512.",
      "",
      "## Maskable icons",
      "",
      "Android crops `purpose: maskable` icons to the launcher's own shape —",
      "circle, squircle, rounded square. Anything outside the middle 80% can be",
      "cut off, so these are generated at 60% on a brand-coloured tile rather",
      "than reusing the full-bleed art.",
      "",
      "| File | Size |",
      "| --- | --- |",
      "| `maskable-192.png` | 192x192 |",
      "| `maskable-512.png` | 512x512 |",
      "",
      "## Fallbacks",
      "",
      "`icon-192.png`, `icon-512.png`, `apple-touch-icon.png` and",
      "`favicon-32.png` are generated so the site is installable with no",
      "export at all. Real exported icons take priority over them.",
      "",
      "Nothing here is ever overwritten by `npm run icons`; use",
      "`npm run icons -- --force` if you want it to.",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
