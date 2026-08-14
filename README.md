# IKSARVA Agritech — iksarva.com

Marketing/informational website for **IKSARVA Agritech Private Limited**, a biofertilizer company based in North Gujarat, India. Built with Next.js 15 (App Router), TypeScript and TailwindCSS v4. Every page is statically generated at build time; the only client-side JavaScript is the mobile navigation and the EN/ગુજરાતી language toggle.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (all routes prerendered)
```

## ✏️ Fill in the placeholders (one file)

**Everything you need to replace lives in [`lib/content.ts`](lib/content.ts):**

| What | Where in `lib/content.ts` |
|---|---|
| WhatsApp number | `SITE.whatsappNumber` — digits only with country code, e.g. `"9198XXXXXXXX"` |
| Display phone | `SITE.phoneDisplay` |
| Address / PIN | `SITE.address` |
| Email | `SITE.email` |
| Founder names | `ABOUT.founders[].name` |

**Language:** the site is bilingual with **Gujarati as the default**; visitors switch to English with the header toggle. All Gujarati copy lives in `lib/content.ts` (UI + pages) and `content/learn/gu/*.md` (article translations) — it was drafted conversationally, so **review it with a native speaker** and edit freely. If any string is ever set to a `[GU: …]` placeholder, the site automatically falls back to English for it.

**Images:** the real brand logo lives at `public/logo.svg` (header, footer) and `app/icon.svg` (favicon).

**Product pack shots:** drop a photo at `public/products/<slug>.jpg` (or `.png`/`.webp`) — `npk-consortia`, `mycorrhizal`, `floramax` — and the site automatically uses it on the product card and detail page from the next build (no code change; see `lib/product-images.ts`). Products without a photo fall back to the inline SVG placeholders in [`components/Illustrations.tsx`](components/Illustrations.tsx).

## Adding Learn articles

Drop a new markdown file in `content/learn/` with this frontmatter:

```markdown
---
title: "Article title"
description: "One-line summary shown on the index and in search results."
date: "2026-09-01"
readingMinutes: 4
---

Article body in markdown…
```

It is picked up automatically at build time — index page, detail page, and sitemap.

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
  layout.tsx            Root layout — header, footer, Organization JSON-LD, metadata
  page.tsx              Home (hero, FloraMax feature, region strip, dealer CTA)
  products/page.tsx     Product index
  products/[slug]/      Product detail pages (FloraMax, Mycorrhizal, NPK Consortia)
  about/page.tsx        Mission, philosophy, team, region
  dealers/page.tsx      Dealer value proposition + WhatsApp CTA
  learn/page.tsx        Knowledge index (markdown-driven)
  learn/[slug]/         Article pages
  contact/page.tsx      WhatsApp / phone / location
  sitemap.ts            sitemap.xml (App Router metadata route)
  robots.ts             robots.txt
  icon.svg              Favicon (brand leaf mark)
components/
  LanguageProvider.tsx  EN/GU context (localStorage-persisted)
  T.tsx                 Bilingual text leaf — pages stay server components
  Header.tsx            Sticky nav + mobile menu + language toggle (client)
  Footer.tsx, WhatsAppButton.tsx, ProductCard.tsx, Illustrations.tsx
content/learn/*.md      Knowledge articles (add more here)
lib/
  content.ts            ★ ALL site copy, config and placeholders
  articles.ts           Markdown loader (build-time only)
```

## Notes

- **Fonts:** system stacks only (Georgia for display, Noto Sans Gujarati → system sans for body) — zero webfont downloads, so first paint is fast on budget phones and rural networks. Noto Sans Gujarati ships with Android and Windows, so ગુજરાતી renders natively.
- **SEO:** `metadataBase` is `https://iksarva.com`; every page sets a canonical URL and Open Graph tags; JSON-LD Organization (site-wide), Product (product pages) and Article (learn pages) schemas are embedded.
- **i18n:** deliberately lightweight — a JSON-style dictionary in `lib/content.ts` plus a small React context. No i18n framework, no locale routing.
