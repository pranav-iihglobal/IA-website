# App icons

`lib/app-icons.ts` resolves this folder at build time and lists only the
files that actually exist, so an icon export can be dropped in whole
without renaming anything.

## Dropping in an export

Copy the folders from your icon generator in as they come:

```
public/icons/android/launchericon-{48,72,96,144,192,512}x{...}.png
public/icons/ios/{16,32,180,192,512,1024,...}.png
public/icons/windows/...        # not used by the web manifest
```

Then run `npm run icons` once. Everything the manifest needs is picked
up automatically except the maskable pair, which almost no exporter
produces — the script generates those from your 512.

## Maskable icons

Android crops `purpose: maskable` icons to the launcher's own shape —
circle, squircle, rounded square. Anything outside the middle 80% can be
cut off, so these are generated at 60% on a brand-coloured tile rather
than reusing the full-bleed art.

| File | Size |
| --- | --- |
| `maskable-192.png` | 192x192 |
| `maskable-512.png` | 512x512 |

## Fallbacks

`icon-192.png`, `icon-512.png`, `apple-touch-icon.png` and
`favicon-32.png` are generated so the site is installable with no
export at all. Real exported icons take priority over them.

Nothing here is ever overwritten by `npm run icons`; use
`npm run icons -- --force` if you want it to.
