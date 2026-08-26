# IKSARVA Agritech — iksarva.com

Marketing website for **IKSARVA Agritech Private Limited**, a biofertilizer company based in North Gujarat, India, plus an admin panel for managing products, testimonials and blog posts.

Built with Next.js 15 (App Router), TypeScript, TailwindCSS v4, MongoDB Atlas (Mongoose) and Cloudinary. Public pages are statically generated with ISR and re-generate instantly when an admin saves.

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values (see Setup below)
npm run check-connection       # verifies Google sign-in, MongoDB + Cloudinary
npm run seed                   # one-off: imports existing content into MongoDB
npm run dev                    # http://localhost:3000  ·  admin at /admin
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve build |
| `npm run seed` | Imports the bundled products, testimonials and articles into MongoDB (idempotent — upserts by slug) |
| `npm run check-seed` | Validates what the seed would write against the zod schemas — no database needed |
| `npm run check-connection` | Checks the Google sign-in config and pings MongoDB and Cloudinary |

## ✏️ Site content (one file)

**All contact details, copy and config live in [`lib/content.ts`](lib/content.ts)** — WhatsApp number (`SITE.whatsappNumber`), phone, email, address, founder details, and every page's text in both languages. Contact details and founder names are filled in; edit them there if they change.

**Language:** the site is bilingual with **Gujarati as the default**; visitors switch to English with the header toggle. All Gujarati copy lives in `lib/content.ts` (UI + pages) and `content/learn/gu/*.md` (article translations) — it was drafted conversationally, so **review it with a native speaker** and edit freely. If any string is ever set to a `[GU: …]` placeholder, the site automatically falls back to English for it.

**Images:** the real brand logo lives at `public/logo.svg` (header, footer) and `app/icon.svg` (favicon).

**Product pack shots:** drop a photo at `public/products/<slug>.jpg` (or `.png`/`.webp`) — `npk-consortia`, `mycorrhizal`, `floramax` — and the site automatically uses it on the product card and detail page from the next build (no code change; see `lib/product-images.ts`). Products without a photo fall back to the inline SVG placeholders in [`components/Illustrations.tsx`](components/Illustrations.tsx).

## Admin panel

Sign in at **/admin** with **Google**. There is no password anywhere in this app, no user collection and no registration — see [Authentication](#authentication) below. `middleware.ts` guards every `/admin/*` page and `/api/admin/*` route, and `/admin` is excluded from search engines.

### Authentication

Google sign-in only. Nothing about auth touches MongoDB, so it costs the free-tier cluster nothing.

**How a sign-in works.** `/admin/login` offers one button. Google authenticates the director and redirects back to `/api/auth/callback/google`. The app then issues its own session — a JWT in a cookie, signed with `AUTH_SECRET`, valid for 14 days. Google is only consulted at sign-in; every request afterwards is authenticated by that cookie, which is why `AUTH_SECRET` matters as much as the Google credentials do.

**Who is allowed in.** Two gates, the second optional:

1. **Google's test-user list** — the OAuth consent screen is kept in **Testing** status, so only accounts listed there can complete sign-in at all. Everyone else is stopped by Google, on Google's own error page, before the request reaches this app.
2. **`ADMIN_ALLOWED_EMAILS`** *(optional, unset by default)* — a comma-separated list. Unset, access is whatever Google allows. Set, only those addresses get in.

**Adding a director:**

1. Google Cloud → **APIs & Services → OAuth consent screen → Test users → Add users** → their Google address.
2. If `ADMIN_ALLOWED_EMAILS` is set, append the address there too (Vercel → Settings → Environment Variables) and redeploy.

**Removing one:** delete them from the test-user list, and from `ADMIN_ALLOWED_EMAILS` if it is set. Their existing session cookie stays valid until it expires (up to 14 days) — rotate `AUTH_SECRET` to invalidate every session immediately.

> ⚠️ **Do not publish the OAuth app.** The consent screen must stay in **Testing**. Publishing removes the test-user restriction, and unless `ADMIN_ALLOWED_EMAILS` is set, any Google account could then sign in. If it is ever published, set `ADMIN_ALLOWED_EMAILS` first.

The production redirect URI `https://iksarva.com/api/auth/callback/google` must exist on the OAuth client, or sign-in fails on the live site with `redirect_uri_mismatch`.

**Audit trail:** every product, testimonial and post records `updatedBy` — the signed-in director's Google email — on create and update. Admin list rows show it as "last edited · date · who".

Three modules, each with search, status filter, pagination and delete-with-confirm:

- **Products** — full records: bilingual copy, benefits, dosage, images, and billing fields (`sku`, `hsnCode`, `gstRatePercent`, `packSizes[]`, `composition[]`, `regulatory`). The form shows a **live preview of the real public product card** as you type.
- **Testimonials** — farmer details, bilingual quote, optional photo, and an optional YouTube / Instagram / Facebook video link (validated and parsed on save).
- **Blog** — rich text (Tiptap) per language, cover image, tags, category, SEO fields, and draft / published / scheduled status.

Saving anything calls `revalidatePath` for the affected public URLs, so changes appear on the live site within seconds — no redeploy.

**Bilingual rule:** every publicly-visible field has English and Gujarati inputs. Gujarati is always optional — if it is blank, the site shows English to everyone.

**Drafts and scheduling:** drafts never render publicly. A scheduled post appears automatically once `publishAt` passes (on the next ISR revalidation, at most an hour).

### Images (Cloudinary)

Uploads go **straight from the browser to Cloudinary** using a signature minted by `/api/admin/sign-upload` — files never pass through the server and the API secret never reaches the browser. MongoDB stores only the `secure_url` and `public_id`, keeping the free 512 MB database for text. Everything is delivered with `f_auto,q_auto` (see `lib/images.ts`) so browsers get AVIF/WebP automatically. Deleting a record deletes its Cloudinary assets too.

Uploads are organised into `products/`, `testimonials/` and `blog/` folders.

### If the database is down

Every public page falls back to the content bundled in the repo (`lib/content.ts` and `content/learn/*.md`) if MongoDB is unreachable, and logs the failure. A database outage degrades the site to its pre-migration content rather than showing an empty page — verified by building with the database unreachable.

### Billing fields

`packSizes[].mrp` and `packSizes[].dealerPrice`, `sku`, `hsnCode` and `gstRatePercent` are stored for a future invoicing feature. **They are never sent to the browser**: public queries in `lib/db/queries.ts` use an explicit field projection (`PUBLIC_PRODUCT_FIELDS`) that omits them entirely. A future billing feature can read a product document and have everything it needs — pack, price, tax rate and HSN code — without another lookup.

## Setup

### 1. MongoDB Atlas (free M0)

1. Create a free **M0** cluster — choose **AWS Mumbai (ap-south-1)** so Indian visitors get the lowest latency.
2. **Database Access** → add a user with a password (Read and write to any database).
3. **Network Access** → add `0.0.0.0/0`. Vercel's serverless functions have no fixed IPs, so this is required; the database is still protected by the username, password and TLS.
4. **Connect → Drivers** → copy the connection string, replace `<db_username>`/`<password>`, and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/iksarva?retryWrites=true&w=majority`
5. Put it in `MONGODB_URI`, then run `npm run seed` once.

### 2. Cloudinary (free)

Dashboard → **Product Environment Credentials** → copy the cloud name, API key and API secret into `CLOUDINARY_*`. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` to the same cloud name.

### 3. Google sign-in

The OAuth client already exists: Google Cloud project **IKSARVA Admin** → OAuth client **iksarva-admin-web**.

1. **Credentials** → open the client → copy the **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. Confirm its **Authorised redirect URIs** contain both, exactly (no trailing slash):
   - `http://localhost:3000/api/auth/callback/google`
   - `https://iksarva.com/api/auth/callback/google`
3. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

Local development must run on **port 3000** — the registered redirect URI is `localhost:3000`, and Google rejects the callback from any other port.

### 4. Vercel

Add every variable from `.env.example` under **Settings → Environment Variables** (Production + Preview), then redeploy. Never commit `.env.local`.

## Installable app (PWA)

The site is installable — "Add to home screen" on a phone, or the install
icon in the desktop address bar — and previously-visited pages keep working
without a connection. Useful for a dealer or a field rep with patchy signal.

### Replacing the app icons

Drop your own PNGs into `public/icons/` with these exact names. The manifest
(`app/manifest.ts`) and the root layout reference them by path, so nothing
else needs changing:

| File | Size | Used for |
|---|---|---|
| `icon-192.png` | 192×192 | Android launcher |
| `icon-512.png` | 512×512 | Splash screen, install prompt |
| `icon-maskable-192.png` | 192×192 | Manifest `purpose: maskable` |
| `icon-maskable-512.png` | 512×512 | Manifest `purpose: maskable` |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `favicon-32.png` | 32×32 | Browser tab fallback |

The **maskable** pair is the one people usually get wrong: Android crops it
to whatever shape the launcher uses — circle, squircle, rounded square — so
everything meaningful has to sit inside the middle 80%. The outer ring can be
cut off. The other icons are shown as-is and can fill the tile.

`npm run icons` generates any file that is missing from `public/logo.svg`. It
never overwrites a file you put there yourself; add `-- --force` if you want
it to.

### Optional: install-dialog screenshots

Drop these into `public/screenshots/` and Chrome shows a preview of the app
in the install dialog instead of just a name and an icon:

| File | Size | Shown on |
|---|---|---|
| `mobile-home.png` | 1080×1920 | Android install prompt |
| `mobile-products.png` | 1080×1920 | Android install prompt |
| `desktop-home.png` | 1920×1080 | Desktop Chrome install prompt |

All of these are optional — `app/manifest.ts` checks which files exist and
lists only those, because a manifest that points at a missing screenshot is
invalid. Every portrait screenshot must share one aspect ratio, and every
landscape one another; Chrome rejects a mixed set.

### The service worker

`public/sw.js`, registered by `components/ServiceWorker.tsx` in production
only (a worker caching localhost is a reliable way to wonder why your changes
aren't showing up). The rules:

- **`/admin` and `/api` are never cached.** Caching an authenticated page
  would be a security bug, and a cached API response would show a director
  stale data they are about to edit.
- **Page navigations are network-first**, falling back to the cache and then
  to `/offline`. A good connection always wins; a bad one gets the last
  version you saw.
- **`/_next/static` is cache-first** — those URLs are content-hashed, so a
  cached copy can never be wrong.
- **Images and fonts are stale-while-revalidate.**

Bump `CACHE_VERSION` at the top of `public/sw.js` to evict everything on the
next deploy.

## Deploying to Vercel

1. **Push this repo to GitHub** (or GitLab/Bitbucket).
2. In [Vercel](https://vercel.com/new), click **Add New → Project** and import the repository. Vercel auto-detects Next.js — no build settings needed. Click **Deploy**.
3. **Add the production domain:** in the project → **Settings → Domains**:
   - Add `iksarva.com` (apex) — set it as the **primary/production domain**.
   - Add `www.iksarva.com` — Vercel will offer to **redirect it to `iksarva.com`**; accept (308 permanent redirect).

### DNS records at your domain registrar

Option A — keep your registrar's DNS, add two records:

| Type | Name / Host | Value |
|---|---|---|
| `A` | `@` (apex) | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

> Vercel's Domains screen shows the exact values to use at the moment you add the domain — if it displays a different A-record IP, use what it shows.

Option B — switch the domain's **nameservers to Vercel** (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) and Vercel manages all records automatically.

DNS changes can take up to a few hours to propagate. Vercel provisions HTTPS certificates automatically once the records resolve.

## Project structure

```
app/
  layout.tsx              Document shell: fonts, language context
  (site)/                 Public pages (route group — URLs unchanged)
    page.tsx              Home
    products/             Product index + [slug] detail (from MongoDB)
    testimonials/         Farmer stories (from MongoDB)
    learn/                Blog index + [slug] article (from MongoDB)
    about/ dealers/ contact/
  admin/
    login/                Sign-in page
    (dashboard)/          Authenticated area: dashboard, products, testimonials, blog
  api/admin/              Auth, products, testimonials, posts, Cloudinary signing
  sitemap.ts robots.ts icon.svg
components/
  admin/                  Admin UI: forms, lists, uploader, rich text editor
  ProductCard.tsx         Shared by the public site AND the admin live preview
  LanguageProvider.tsx T.tsx BiHtml.tsx Header.tsx Footer.tsx …
lib/
  content.ts              Site config, contact details, static copy
  db/                     Connection, Mongoose models, public queries
  schemas.ts              Shared zod schemas (client + server validation)
  products-source.ts      DB-first product reads with bundled fallback
  testimonials-source.ts  Same for testimonials
  posts-source.ts         Same for blog (falls back to content/learn/*.md)
  cloudinary.ts images.ts sanitize.ts auth/ admin/
content/learn/*.md        Original articles — kept as a fallback after seeding
scripts/                  seed, check-seed, check-connection
middleware.ts             Guards /admin and /api/admin
```

## Notes

- **Fonts:** self-hosted via `next/font` (nothing is requested from Google at runtime), in two pairs. **Display** — Laviossa for Latin, Anek Gujarati for ગુજરાતી. **Body and UI** — Montserrat for Latin, Noto Sans Gujarati for ગુજરાતી. Each stack leads with a Latin-only face, so the browser reaches past it for Gujarati characters by itself and each script gets the right font even within one sentence. Fonts cost ~377 KB on the home page, of which Noto Sans Gujarati is ~155 KB; dropping `--font-noto-gujarati` from `--font-body` in `globals.css` reverts Gujarati body text to Anek and reclaims it.
- **SEO:** `metadataBase` is `https://iksarva.com`; every page sets a canonical URL and Open Graph tags; JSON-LD Organization (site-wide), Product (product pages) and Article (learn pages) schemas are embedded.
- **i18n:** deliberately lightweight — bilingual `{ en, gu }` fields plus a small React context. Gujarati is the default; empty Gujarati falls back to English. No i18n framework, no locale routing.
- **Free-tier discipline:** lean indexes, `.lean()` reads, 20-per-page admin lists, no polling, and no binaries in MongoDB.
