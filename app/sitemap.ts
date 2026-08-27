import type { MetadataRoute } from "next";
import { SITE } from "@/lib/content";
import { getDisplayProducts } from "@/lib/products-source";
import { getDisplayPosts } from "@/lib/posts-source";

/**
 * The sitemap, built from the DATABASE.
 *
 * It used to be built from lib/content.ts and the bundled markdown, which
 * meant every product and article created in the admin panel was invisible to
 * Google: the pages existed, were rendered, were linked, and were never
 * submitted. Only the three seeded products and three seeded articles were
 * ever listed.
 *
 * Both sources fall back to the bundled content when the database is
 * unreachable, so a Mongo outage degrades to the old sitemap rather than an
 * empty one — an empty sitemap is worse than a stale one, because Google
 * treats it as a statement that the pages are gone.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, priority: 1, changeFrequency: "weekly" },
    { url: `${SITE.url}/products`, priority: 0.9, changeFrequency: "weekly" },
    { url: `${SITE.url}/about`, priority: 0.7, changeFrequency: "yearly" },
    { url: `${SITE.url}/dealers`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${SITE.url}/testimonials`, priority: 0.7, changeFrequency: "weekly" },
    { url: `${SITE.url}/learn`, priority: 0.6, changeFrequency: "weekly" },
    { url: `${SITE.url}/contact`, priority: 0.8, changeFrequency: "yearly" },
  ];

  const [products, articles] = await Promise.all([
    getDisplayProducts(),
    getDisplayPosts(),
  ]);

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE.url}/products/${p.slug}`,
    priority: p.featured ? 0.9 : 0.8,
    changeFrequency: "monthly",
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE.url}/learn/${a.slug}`,
    // Real edit dates now, not just the original publish date — Google uses
    // lastmod to decide what is worth recrawling.
    lastModified: a.publishedAt ? new Date(a.publishedAt) : undefined,
    priority: 0.5,
    changeFrequency: "monthly",
  }));

  return [...staticPages, ...productPages, ...articlePages];
}
