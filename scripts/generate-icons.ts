/**
 * Renders the PWA icon set from the one source SVG.
 *
 * The logo is a tall shield (roughly 0.7:1), so it cannot be a square icon on
 * its own — it gets centred on an olive square instead. Two families:
 *
 *  - `any`      — the shield fills most of the tile, for launchers that show
 *                 the icon as-is.
 *  - `maskable` — the same shield at 60% inside the safe zone, because
 *                 Android crops maskable icons to whatever shape the launcher
 *                 uses (circle, squircle, rounded square) and anything in the
 *                 outer 20% can be cut off.
 *
 * Run with `npm run icons` after changing public/logo.svg.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.join(process.cwd(), "public", "logo.svg");
const OUT_DIR = path.join(process.cwd(), "public", "icons");

/** --color-olive, the brand green the header and sidebar already use. */
const BACKGROUND = "#5e7153";

const TARGETS = [
  { size: 192, name: "icon-192.png", inset: 0.82 },
  { size: 512, name: "icon-512.png", inset: 0.82 },
  { size: 192, name: "icon-maskable-192.png", inset: 0.6 },
  { size: 512, name: "icon-maskable-512.png", inset: 0.6 },
  // iOS ignores the manifest and reads apple-touch-icon; it also composites
  // onto its own rounded rect, so it wants the padded version.
  { size: 180, name: "apple-touch-icon.png", inset: 0.7 },
];

/**
 * Hand-made artwork beats anything generated from a logo, so a file that is
 * already there is left alone. Pass --force to regenerate everything.
 */
const FORCE = process.argv.includes("--force");

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = await readFile(SOURCE);
  let kept = 0;

  for (const { size, name, inset } of TARGETS) {
    if (!FORCE && (await exists(path.join(OUT_DIR, name)))) {
      console.log(`  ${name.padEnd(26)} kept (already present)`);
      kept++;
      continue;
    }
    // The shield is taller than it is wide, so height is the limiting side.
    const glyphHeight = Math.round(size * inset);

    const glyph = await sharp(svg, { density: 600 })
      .resize({ height: glyphHeight, fit: "contain" })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BACKGROUND,
      },
    })
      .composite([{ input: glyph, gravity: "center" }])
      .png()
      .toFile(path.join(OUT_DIR, name));

    console.log(`  ${name.padEnd(26)} ${size}x${size}`);
  }

  // Favicon: the same shield, small, for browsers that ignore the SVG icon.
  if (FORCE || !(await exists(path.join(OUT_DIR, "favicon-32.png")))) {
    const favicon = await sharp(svg, { density: 600 })
      .resize({ height: 26, fit: "contain" })
      .png()
      .toBuffer();
    await sharp({
      create: { width: 32, height: 32, channels: 4, background: BACKGROUND },
    })
      .composite([{ input: favicon, gravity: "center" }])
      .png()
      .toFile(path.join(OUT_DIR, "favicon-32.png"));
    console.log("  favicon-32.png             32x32");
  } else {
    console.log("  favicon-32.png             kept (already present)");
    kept++;
  }

  await writeFile(
    path.join(OUT_DIR, "README.md"),
    [
      "# App icons",
      "",
      "Drop your own artwork in here using these exact names — the manifest",
      "and the root layout reference them by path:",
      "",
      "| File | Size | Used for |",
      "| --- | --- | --- |",
      "| `icon-192.png` | 192x192 | Android launcher, manifest `purpose: any` |",
      "| `icon-512.png` | 512x512 | Splash screen, install prompt, stores |",
      "| `icon-maskable-192.png` | 192x192 | Manifest `purpose: maskable` |",
      "| `icon-maskable-512.png` | 512x512 | Manifest `purpose: maskable` |",
      "| `apple-touch-icon.png` | 180x180 | iOS home screen |",
      "| `favicon-32.png` | 32x32 | Browser tab fallback |",
      "",
      "Maskable icons are cropped by the launcher to a circle, squircle or",
      "rounded square, so keep everything meaningful inside the middle 80%",
      "(a circle of diameter 0.8 x the icon width). Everything else can be cut.",
      "",
      "`npm run icons` fills in any file that is missing, generated from",
      "public/logo.svg. It never overwrites a file you put here — run",
      "`npm run icons -- --force` if you do want it to.",
      "",
    ].join("\n"),
  );

  if (kept > 0) {
    console.log(
      `\n${kept} file(s) left as they were. Use --force to regenerate them.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
