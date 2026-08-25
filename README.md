# IKSARVA Agritech — iksarva.com

Marketing website for **IKSARVA Agritech Private Limited**, a biofertilizer company based in North Gujarat, India, plus an admin panel for managing products, testimonials and blog posts.

Built with Next.js 15 (App Router), TypeScript, TailwindCSS v4, MongoDB Atlas (Mongoose) and Cloudinary. Public pages are statically generated with ISR and re-generate instantly when an admin saves.

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values (see Setup below)
npm run check-connection       # verifies MongoDB + Cloudinary credentials
npm run seed                   # one-off: imports existing content into MongoDB
npm run dev                    # http://localhost:3000  ·  admin at /admin
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve build |
| `npm run seed` | Imports the bundled products, testimonials and articles into MongoDB (idempotent — upserts by slug) |
| `npm run check-seed` | Validates what the seed would write against the zod schemas — no database needed |
| `npm run check-connection` | Pings MongoDB and Cloudinary with your env credentials |
| `npm run hash-password -- 'pw'` | Generates the bcrypt hash for `ADMIN_PASSWORD_HASH` |

## ✏️ Site content (one file)

**All contact details, copy and config live in [`lib/content.ts`](lib/content.ts)** — WhatsApp number (`SITE.whatsappNumber`), phone, email, address, founder details, and every page's text in both languages. Contact details and founder names are filled in; edit them there if they change.

**Language:** the site is bilingual with **Gujarati as the default**; visitors switch to English with the header toggle. All Gujarati copy lives in `lib/content.ts` (UI + pages) and `content/learn/gu/*.md` (article translations) — it was drafted conversationally, so **review it with a native speaker** and edit freely. If any string is ever set to a `[GU: …]` placeholder, the site automatically falls back to English for it.

**Images:** the real brand logo lives at `public/logo.svg` (header, footer) and `app/icon.svg` (favicon).

**Product pack shots:** drop a photo at `public/products/<slug>.jpg` (or `.png`/`.webp`) — `npk-consortia`, `mycorrhizal`, `floramax` — and the site automatically uses it on the product card and detail page from the next build (no code change; see `lib/product-images.ts`). Products without a photo fall back to the inline SVG placeholders in [`components/Illustrations.tsx`](components/Illustrations.tsx).

## Admin panel

Sign in at **/admin** with `ADMIN_EMAIL` and the password whose bcrypt hash is in `ADMIN_PASSWORD_HASH`. There is one admin account — no registration, no roles. Sessions are encrypted cookies (iron-session) that last 7 days; `middleware.ts` guards every `/admin/*` page and `/api/admin/*` route, and `/admin` is excluded from search engines.

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

### 3. Admin password

```bash
npm run hash-password -- 'your-strong-password'
```

It prints two forms. **`.env.local` needs the escaped one** (Next.js expands `$VAR` inside .env files, and bcrypt hashes are full of `$`); **Vercel's dashboard needs the raw one**. The app accepts either.

Generate `SESSION_SECRET` with `openssl rand -base64 32`.

### 4. Vercel

Add every variable from `.env.example` under **Settings → Environment Variables** (Production + Preview), then redeploy. Never commit `.env.local`.

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
scripts/                  seed, check-seed, check-connection, hash-password
middleware.ts             Guards /admin and /api/admin
```

## Notes

- **Fonts:** self-hosted via `next/font` — Laviossa for Latin text, Anek Gujarati for ગુજરાતી. Because Laviossa has no Gujarati glyphs, each script automatically gets the right face, even within one sentence.
- **SEO:** `metadataBase` is `https://iksarva.com`; every page sets a canonical URL and Open Graph tags; JSON-LD Organization (site-wide), Product (product pages) and Article (learn pages) schemas are embedded.
- **i18n:** deliberately lightweight — bilingual `{ en, gu }` fields plus a small React context. Gujarati is the default; empty Gujarati falls back to English. No i18n framework, no locale routing.
- **Free-tier discipline:** lean indexes, `.lean()` reads, 20-per-page admin lists, no polling, and no binaries in MongoDB.
