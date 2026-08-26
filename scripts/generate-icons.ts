/**
 * Fills in the app icons that an export is missing.
 *
 * Most icon generators (PWABuilder, RealFaviconGenerator, a designer's zip)
 * hand you a full ladder of ordinary icons and no **maskable** ones — and
 * maskable is the pair that actually matters on Android, because the launcher
 * crops every icon to its own shape. Worse, exported icons usually have a
 * transparent background, and a transparent maskable icon gets filled with
 * whatever the launcher feels like. So those are composited onto an opaque
 * brand tile at 60%, well inside the safe zone.
 *
 * Provenance, not timestamps, decides what gets rewritten. The script records
 * every file it wrote in `.generated.json` along with the source it used:
 *
 *   - a file it generated is regenerated when a better source appears
 *     (dropping in `android/launchericon-512x512.png` supersedes logo.svg),
 *   - a file it did not generate is never touched, because that is your own
 *     artwork,
 *   - a file it generated that a real export has since made redundant is
 *     deleted, so the repo does not carry two versions of the same icon.
 *
 *   npm run icons
 *   npm run icons -- --force     regenerate everything it owns
 */
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");
const LEDGER = path.join(ICONS_DIR, ".generated.json");

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

type Ledger = Record<string, { source: string }>;

async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(LEDGER, "utf8")) as Ledger;
  } catch {
    return {};
  }
}

/**
 * The best square artwork available, largest first.
 *
 * A real exported icon beats the logo SVG: the logo is a tall shield that has
 * to be letterboxed onto a square, whereas an exported icon is already
 * composed for one.
 */
const SOURCE_CANDIDATES = [
  "icons/android/launchericon-512x512.png",
  "icons/ios/1024.png",
  "icons/ios/512.png",
  "icons/icon-512.png",
  "logo.svg",
];

async function findSource(): Promise<{ buffer: Buffer; label: string }> {
  for (const relative of SOURCE_CANDIDATES) {
    const file = path.join(PUBLIC_DIR, relative);
    if (await exists(file)) {
      return { buffer: await readFile(file), label: relative };
    }
  }
  throw new Error(
    "No icon source found. Expected at least public/logo.svg to exist.",
  );
}

/** Centre `source` on an opaque square brand tile. */
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

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const { buffer: source, label } = await findSource();
  const previous = await readLedger();
  const ledger: Ledger = {};

  console.log(`Source: ${label}\n`);

  async function write(name: string, make: () => Promise<Buffer>) {
    const file = path.join(ICONS_DIR, name);
    const wasGenerated = name in previous;
    const isPresent = await exists(file);

    // Someone else's file. Leave it alone and forget we ever made one.
    if (isPresent && !wasGenerated && !FORCE) {
      console.log(`  ${name.padEnd(24)} kept — yours, not generated`);
      return;
    }

    const sourceChanged = previous[name]?.source !== label;
    if (isPresent && wasGenerated && !sourceChanged && !FORCE) {
      console.log(`  ${name.padEnd(24)} unchanged`);
      ledger[name] = { source: label };
      return;
    }

    await writeFile(file, await make());
    ledger[name] = { source: label };
    console.log(
      `  ${name.padEnd(24)} ${isPresent ? "regenerated" : "written"} from ${label}`,
    );
  }

  /**
   * Is a real exported icon already covering what this fallback is for?
   *
   * Asked independently of whether the fallback exists — otherwise a run
   * after the file has been deleted would happily write it back, and the
   * script would flip-flop on every invocation.
   */
  async function supersededBy(candidates: string[]) {
    for (const candidate of candidates) {
      if (await exists(path.join(PUBLIC_DIR, candidate))) return candidate;
    }
    return null;
  }

  /**
   * Drop a fallback a real export has made redundant. Keeping it would mean
   * two versions of the same icon in the repo, drifting apart the moment the
   * export is updated. Only ever deletes something this script wrote.
   */
  async function drop(name: string, reason: string) {
    const file = path.join(ICONS_DIR, name);
    if (!(await exists(file))) return;
    if (!(name in previous)) {
      console.log(`  ${name.padEnd(24)} kept — yours, though ${reason} exists`);
      ledger[name] = previous[name] ?? { source: "unknown" };
      return;
    }
    await rm(file);
    console.log(`  ${name.padEnd(24)} removed — ${reason} supersedes it`);
  }

  // The maskable pair. The whole reason this script exists, and always ours:
  // no exporter produces them.
  await write("maskable-192.png", () => tile(source, 192, MASKABLE_INSET));
  await write("maskable-512.png", () => tile(source, 512, MASKABLE_INSET));

  // Fallbacks, so the site is installable with no export at all. Once a real
  // export provides the same thing, lib/app-icons.ts prefers it and these go.
  const fallbacks: [string, string[], () => Promise<Buffer>][] = [
    [
      "icon-192.png",
      ["icons/android/launchericon-192x192.png"],
      () => tile(source, 192, 0.82),
    ],
    [
      "icon-512.png",
      ["icons/android/launchericon-512x512.png"],
      () => tile(source, 512, 0.82),
    ],
    ["apple-touch-icon.png", ["icons/ios/180.png"], () => tile(source, 180, 0.7)],
    ["favicon-32.png", ["icons/ios/32.png"], () => tile(source, 32, 0.82)],
  ];

  for (const [name, candidates, make] of fallbacks) {
    const covered = await supersededBy(candidates);
    if (covered) {
      await drop(name, covered);
      continue;
    }
    await write(name, make);
  }

  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);

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
      "Copy the folders in as your generator produced them:",
      "",
      "```",
      "public/icons/android/launchericon-{48,72,96,144,192,512}x{...}.png",
      "public/icons/ios/{16,32,180,512,1024,...}.png",
      "```",
      "",
      "Then run `npm run icons`. It generates the maskable pair from your",
      "largest icon and removes any fallback the export has made redundant.",
      "",
      "## Maskable icons",
      "",
      "Android crops `purpose: maskable` icons to the launcher's own shape —",
      "circle, squircle, rounded square — so anything outside the middle 80%",
      "can be cut off. Exported icons are also usually transparent, and a",
      "transparent maskable icon gets filled with whatever the launcher picks.",
      "Both reasons these are composed separately, at 60% on an opaque brand",
      "tile, rather than reusing the exported art directly.",
      "",
      "## What is generated",
      "",
      "`.generated.json` records which files this script wrote and from which",
      "source. A file listed there is regenerated when a better source appears;",
      "a file not listed is treated as your own artwork and never touched.",
      "Delete the entry (or the file) to hand ownership back to the script.",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
