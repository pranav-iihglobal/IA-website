# App icons

Drop your own artwork in here using these exact names — the manifest
and the root layout reference them by path:

| File | Size | Used for |
| --- | --- | --- |
| `icon-192.png` | 192x192 | Android launcher, manifest `purpose: any` |
| `icon-512.png` | 512x512 | Splash screen, install prompt, stores |
| `icon-maskable-192.png` | 192x192 | Manifest `purpose: maskable` |
| `icon-maskable-512.png` | 512x512 | Manifest `purpose: maskable` |
| `apple-touch-icon.png` | 180x180 | iOS home screen |
| `favicon-32.png` | 32x32 | Browser tab fallback |

Maskable icons are cropped by the launcher to a circle, squircle or
rounded square, so keep everything meaningful inside the middle 80%
(a circle of diameter 0.8 x the icon width). Everything else can be cut.

`npm run icons` fills in any file that is missing, generated from
public/logo.svg. It never overwrites a file you put here — run
`npm run icons -- --force` if you do want it to.
