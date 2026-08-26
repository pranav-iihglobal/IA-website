# Install-dialog screenshots

Optional. Drop PNGs in here with these exact names and Chrome shows the
"richer install" dialog — a preview of the app — instead of just a name and
an icon. `app/manifest.ts` checks whether each file exists and only lists the
ones that are actually here, so a missing file is fine; a listed-but-missing
file would make the manifest invalid.

| File | Size | Shown on |
| --- | --- | --- |
| `mobile-home.png` | 1080x1920 (portrait) | Android install prompt |
| `mobile-products.png` | 1080x1920 (portrait) | Android install prompt |
| `desktop-home.png` | 1920x1080 (landscape) | Desktop Chrome install prompt |

Every `narrow` screenshot must be the same aspect ratio as the others, and
so must every `wide` one — Chrome rejects a mixed set. If you want different
sizes, change the `sizes` values in `app/manifest.ts` to match.
