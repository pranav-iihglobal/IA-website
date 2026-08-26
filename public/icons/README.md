# App icons

`lib/app-icons.ts` resolves this folder at build time and lists only the
files that actually exist, so an icon export can be dropped in whole
without renaming anything.

## Dropping in an export

Copy the folders in as your generator produced them:

```
public/icons/android/launchericon-{48,72,96,144,192,512}x{...}.png
public/icons/ios/{16,32,180,512,1024,...}.png
```

Then run `npm run icons`. It generates the maskable pair from your
largest icon and removes any fallback the export has made redundant.

## Maskable icons

Android crops `purpose: maskable` icons to the launcher's own shape —
circle, squircle, rounded square — so anything outside the middle 80%
can be cut off. Exported icons are also usually transparent, and a
transparent maskable icon gets filled with whatever the launcher picks.
Both reasons these are composed separately, at 60% on an opaque brand
tile, rather than reusing the exported art directly.

## What is generated

`.generated.json` records which files this script wrote and from which
source. A file listed there is regenerated when a better source appears;
a file not listed is treated as your own artwork and never touched.
Delete the entry (or the file) to hand ownership back to the script.
