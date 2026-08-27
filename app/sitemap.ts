import type { MetadataRoute } from "next";
import { SITE } from "@/lib/content";
import { getDisplayProducts } from "@/lib/products-source";
import { getDisplayPosts } from "@/lib/posts-source";
import { localePath } from "@/lib/i18n";

/**
 * The sitemap, built from the DATABASE, in both languages.
 *
 * It used to be built from lib/content.ts and the bundled markdown, which
 * meant every product and article created in the admin panel was invisible to
 * Google: the pages existed, were rendered, were linked, and were never
 * submitted. Only the three seeded products and three seeded articles were
 * ever listed.
 *
 * Every page now has two addresses — the English one at the bare path and the
 * Gujarati one under /gu. Each is listed once with an `alternates.languages`
 * block naming its twin, which is the sitemap half of the hreflang contract:
 * the pages declare it in their <head> and the sitemap repeats it here, and
 * Google wants both to agree before it will treat them as one page in two
 * languages rather than two pages competing with each other.
 *
 * Both sources fall back to the bundled content when the database is
 * unreachable, so a Mongo outage degrades to the old sitemap rather than an
 * empty one — an empty sitemap is worse than a stale one, because Google
 * treats it as a statement that the pages are gone.
 */

type Entry = Omit<MetadataRoute.Sitemap[number], "url">;

/**
 * One page → its two localised URLs, each pointing at the other.
 *
 * No trailing slash on the home page: Next resolves the canonical link for
 * "/" to the bare origin, and a sitemap entry of ".../" would be a different
 * URL from the canonical it points at — the one contradiction that makes
 * Google distrust both.
 */
function bothLocales(path: string, entry: Entry): MetadataRoute.Sitemap {
  const url = (locale: "en" | "gu") =>
    `${SITE.url}${localePath(path, locale)}`.replace(/\/$/, "");
  const en = url("en");
  const gu = url("gu");
  const languages = { en, gu, "x-default": en };
  return [
    { ...entry, url: en, alternates: { languages } },
    { ...entry, url: gu, alternates: { languages } },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    ...bothLocales("/", { priority: 1, changeFrequency: "weekly" }),
    ...bothLocales("/products", { priority: 0.9, changeFrequency: "weekly" }),
    ...bothLocales("/about", { priority: 0.7, changeFrequency: "yearly" }),
    ...bothLocales("/dealers", { priority: 0.8, changeFrequency: "monthly" }),
    ...bothLocales("/testimonials", {
      priority: 0.7,
      changeFrequency: "weekly",
    }),
    ...bothLocales("/learn", { priority: 0.6, changeFrequency: "weekly" }),
    ...bothLocales("/contact", { priority: 0.8, changeFrequency: "yearly" }),
  ];

  const [products, articles] = await Promise.all([
    getDisplayProducts(),
    getDisplayPosts(),
  ]);

  const productPages = products.flatMap((p) =>
    bothLocales(`/products/${p.slug}`, {
      priority: p.featured ? 0.9 : 0.8,
      changeFrequency: "monthly",
    }),
  );

  const articlePages = articles.flatMap((a) =>
    bothLocales(`/learn/${a.slug}`, {
      // Real edit dates now, not just the original publish date — Google uses
      // lastmod to decide what is worth recrawling.
      lastModified: a.publishedAt ? new Date(a.publishedAt) : undefined,
      priority: 0.5,
      changeFrequency: "monthly",
    }),
  );

  return [...staticPages, ...productPages, ...articlePages];
}
