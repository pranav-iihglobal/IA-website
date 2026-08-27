# IKSARVA Agritech — iksarva.com

Marketing website for **IKSARVA Agritech Private Limited**, a biofertilizer company based in North Gujarat, India, plus an admin panel for managing products, testimonials and blog posts.

Built with Next.js 16 (App Router), TypeScript, TailwindCSS v4, MongoDB Atlas (Mongoose) and Cloudinary. Public pages are statically generated with ISR and re-generate instantly when an admin saves.

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
| `npm run check-auth` | Drives the admin guard with a minted session cookie — needs a running server; add a URL to check a deployed one |
| `npm run users -- list` | Manage who can sign in and what they may do, from a terminal |
| `npm run check-models` | Validates every Mongoose model against a minimal document — no database needed |

## ✏️ Site content (one file)

**All contact details, copy and config live in [`lib/content.ts`](lib/content.ts)** — WhatsApp number (`SITE.whatsappNumber`), phone, email, address, founder details, and every page's text in both languages. Contact details and founder names are filled in; edit them there if they change.

**Language:** the site is bilingual with **Gujarati as the default**; visitors switch to English with the header toggle. All Gujarati copy lives in `lib/content.ts` (UI + pages) and `content/learn/gu/*.md` (article translations) — it was drafted conversationally, so **review it with a native speaker** and edit freely. If any string is ever set to a `[GU: …]` placeholder, the site automatically falls back to English for it.

**Images:** the real brand logo lives at `public/logo.svg` (header, footer) and `app/icon.svg` (favicon).

**Product pack shots:** drop a photo at `public/products/<slug>.jpg` (or `.png`/`.webp`) — `npk-consortia`, `mycorrhizal`, `floramax` — and the site automatically uses it on the product card and detail page from the next build (no code change; see `lib/product-images.ts`). Products without a photo fall back to the inline SVG placeholders in [`components/Illustrations.tsx`](components/Illustrations.tsx).

## Admin panel

Sign in at **/admin** with **Google**. There is no password anywhere in this app and no registration — the `users` collection records who may sign in and what they may do, never how they prove who they are. See [Authentication](#authentication) below. `proxy.ts` guards every `/admin/*` page and `/api/admin/*` route, and `/admin` is excluded from search engines.

### Authentication

Google sign-in only. Authentication costs the cluster nothing — no session store, no password hashes. Authorisation is a database read, one indexed `findOne` per request.

**How a sign-in works.** `/admin/login` offers one button. Google authenticates the person and redirects back to `/api/auth/callback/google`. The app then issues its own session — a JWT in a cookie, signed with `AUTH_SECRET`, valid for 14 days. Google is only consulted at sign-in; every request afterwards is authenticated by that cookie, which is why `AUTH_SECRET` matters as much as the Google credentials do.

**Who is allowed in, and as what.** One collection, managed at **/admin/users**. Add someone by their Google address, pick a role, and they can sign in immediately; change or revoke it and their next request reflects it. No environment variable, no redeploy.

| Role | Can |
|---|---|
| **Owner** | Everything, including adding and removing people |
| **Admin** | All content — writing, publishing, deleting. Cannot change who has access |
| **Editor** | Writes and edits content, uploads images. Cannot delete or publish |
| **Viewer** | Reads everything in the panel. Changes nothing |

Roles nest, so each is the one above it plus more.

**A role alone is too coarse for real jobs**, so access is also settable **per module**. Each of Products, Testimonials and Blog can be set to **No access / View / Edit / Full** for one person, overriding what their role would give. An accountant becomes a Viewer with Testimonials and Blog set to *No access* — they see the products list for SKU, HSN and GST and nothing else, and the Blog link is not in their nav at all. A copywriter becomes a Viewer with Blog set to *Edit* and everything else *No access*.

A module left on **Follow role** is not a copy of what the role grants today — it genuinely follows, so changing someone's role later moves that module with it. Only explicitly-set modules stay put. That is why the overrides are stored sparsely rather than as a full grid.

Suspending is the usual way to cut someone off — their record stays, so the "last edited by" lines on old content still resolve to a person.

Access is never tested by role name. Every decision resolves to a permission string (`products:write`, `posts:publish`, `users:manage`, …) resolved against role **and** module overrides by `can()` in [`lib/auth/permissions.ts`](lib/auth/permissions.ts). Adding a module later means adding it to `MODULES`, adding its permissions, and naming them in the routes — not revisiting every route to ask which roles are now allowed.

Enforced at three depths, because hiding a link is a courtesy and not a control: the nav omits modules you cannot read, `requirePageAccess()` redirects if you type the URL anyway, and `requirePermission()` refuses the API call underneath. `media:upload` is granted to anyone who can edit *something*, so a blog-only editor can still add a cover image and a viewer cannot obtain a signed upload URL.

The first owner is created from a terminal, because the page that grants access sits behind the login it controls:

```bash
npm run users -- add you@gmail.com owner "Your Name"
npm run users -- list
npm run users -- role someone@gmail.com editor
npm run users -- module accounts@iksarva.com posts none     # hide the blog
npm run users -- module accounts@iksarva.com posts follow   # back to the role
npm run users -- suspend someone@gmail.com
npm run users -- remove someone@gmail.com
npm run users -- migrate     # one-off, imports an old `directors` collection
```

That script talks to MongoDB directly and never asks who you are, so guard it the way you guard `MONGODB_URI`. It is also the way back in if every owner is ever locked out.

It **fails closed**: no users means nobody signs in, and an unreachable database refuses everyone rather than letting anyone through. Three guards protect the panel from being made unusable — you cannot change your own access, the last active owner cannot be removed, suspended or demoted, and nobody can grant a role above their own.

Enforced in three places:

| Where | Runtime | Checks |
|---|---|---|
| `signIn` callback (`auth.ts`) | Node | The database. Refuses to mint a session at all |
| `proxy.ts` | Edge | Only that a session exists — see below |
| `requirePermission()` (`lib/admin/api.ts`) and the dashboard layout | Node | The database, on every request, for the specific permission |

**The session deliberately carries no role.** An earlier version cached an `admin` flag on the token for the proxy to read, and it locked out every user — `request.auth` in the proxy is a Session, not the JWT, and the flag was never copied across. The fix was not to copy it more carefully but to stop duplicating authorisation state into a runtime that cannot verify it. A session can only exist if the `signIn` callback approved it against the database, so its existence is all the edge needs; what the person may actually do is read from MongoDB in Node on every request. That is also why a demotion takes effect instantly rather than at token expiry.

`npm run check-auth` drives both directions against a running server, including a cookie that forges `role: "owner"` — which must get nowhere.

The config is split across `auth.config.ts` (edge-safe) and `auth.ts` (reaches the database) because Mongoose cannot run on the edge; importing `auth.ts` from the proxy fails the build.

> ⚠️ **Google's "test users" list is not access control.** It only restricts anything while the OAuth consent screen is in **Testing** status. Publishing the app — or making it **Internal** in a Workspace — opens sign-in to every Google account, with no warning and no visible change here. The User collection is what actually protects the panel.

**To cut off a session immediately** rather than on the person's next request, rotate `AUTH_SECRET`. Every session is a JWT signed with it, so changing it invalidates all of them at once.

The production redirect URI `https://iksarva.com/api/auth/callback/google` must exist on the OAuth client, or sign-in fails on the live site with `redirect_uri_mismatch`.

**Audit trail:** every product, testimonial and post records `updatedBy` — the signed-in user's Google email — on create and update. Admin list rows show it as "last edited · date · who".

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
4. **Create yourself as the first owner** once the database is connected:
   `npm run users -- add you@gmail.com owner`. Everyone after that is added
   from /admin/users.

Local development must run on **port 3000** — the registered redirect URI is `localhost:3000`, and Google rejects the callback from any other port.

### 4. Vercel

Add every variable from `.env.example` under **Settings → Environment Variables** (Production + Preview), then redeploy. Never commit `.env.local`.

## Installable app (PWA)

The site is installable — "Add to home screen" on a phone, or the install
icon in the desktop address bar — and previously-visited pages keep working
without a connection. Useful for a dealer or a field rep with patchy signal.

### Adding your own app icons

`lib/app-icons.ts` resolves `public/icons/` at build time and lists only the
files that are actually there, so an icon export can be dropped in whole
without renaming anything. Copy the folders in exactly as your generator
produced them:

```
public/icons/android/launchericon-{48,72,96,144,192,512}x{...}.png
public/icons/ios/{16,32,180,...}.png
public/icons/windows/...          # kept, but unused by the web manifest
```

Then run this once:

```bash
npm run icons
```

Everything the manifest needs is picked up automatically **except the
maskable pair**, which almost no exporter produces — the script generates
those from your 512.

#### Why maskable matters

Android crops `purpose: maskable` icons to whatever shape the launcher uses:
circle, squircle, rounded square. Anything outside the middle 80% can be cut
off. Listing a full-bleed icon as maskable gets its edges shaved, which is
why the script composes these separately, at 60% on a brand-coloured tile,
instead of reusing the exported art.

#### Fallbacks

`icon-192.png`, `icon-512.png`, `apple-touch-icon.png` and `favicon-32.png`
are generated from `public/logo.svg` so the site is installable with no
export at all. A real exported icon always takes priority over them.

`npm run icons` never overwrites a file that is already there — add
`-- --force` if you want it to.

### Optional: install-dialog screenshots

Drop these into `public/screenshots/` and Chrome shows a preview of the app
in the install dialog instead of just a name and an icon:

| File | Size | Shown on |
|---|---|---|
| `mobile-home.png` | 1080×1920 | Android install prompt |
| `mobile-products.png` | 1080×1920 | Android install prompt |
| `desktop-home.png` | 1920×1080 | Desktop Chrome install prompt |

All optional — `app/manifest.ts` checks which files exist and lists only
those, because a manifest that points at a missing screenshot is invalid.
Every portrait screenshot must share one aspect ratio, and every landscape
one another; Chrome rejects a mixed set.

### The service worker

`public/sw.js`, registered by `components/ServiceWorker.tsx` in production
only (a worker caching localhost is a reliable way to wonder why your changes
aren't showing up). The rules:

- **`/admin` and `/api` are never cached.** Caching an authenticated page
  would be a security bug, and a cached API response would show someone
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
scripts/                  seed, check-seed, check-connection, check-auth, users
proxy.ts                  Guards /admin and /api/admin
```

## Notes

- **Fonts:** self-hosted via `next/font` (nothing is requested from Google at runtime), in two pairs. **Display** — Laviossa for Latin, Anek Gujarati for ગુજરાતી. **Body and UI** — Montserrat for Latin, Noto Sans Gujarati for ગુજરાતી. Each stack leads with a Latin-only face, so the browser reaches past it for Gujarati characters by itself and each script gets the right font even within one sentence. Fonts cost ~377 KB on the home page, of which Noto Sans Gujarati is ~155 KB; dropping `--font-noto-gujarati` from `--font-body` in `globals.css` reverts Gujarati body text to Anek and reclaims it.
- **SEO:** `metadataBase` is `https://iksarva.com`; every page sets a canonical URL and Open Graph tags; JSON-LD Organization (site-wide), Product (product pages) and Article (learn pages) schemas are embedded.
- **i18n:** deliberately lightweight — bilingual `{ en, gu }` fields plus a small React context. Gujarati is the default; empty Gujarati falls back to English. No i18n framework, no locale routing.
- **Free-tier discipline:** lean indexes, `.lean()` reads, 20-per-page admin lists, no polling, and no binaries in MongoDB.
