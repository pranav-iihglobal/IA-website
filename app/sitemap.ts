import type { MetadataRoute } from "next";
import { PRODUCTS, SITE } from "@/lib/content";
import { getAllArticles } from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, priority: 1 },
    { url: `${SITE.url}/products`, priority: 0.9 },
    { url: `${SITE.url}/about`, priority: 0.7 },
    { url: `${SITE.url}/dealers`, priority: 0.8 },
    { url: `${SITE.url}/learn`, priority: 0.6 },
    { url: `${SITE.url}/contact`, priority: 0.8 },
  ];

  const productPages: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: `${SITE.url}/products/${p.slug}`,
    priority: p.flagship ? 0.9 : 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: `${SITE.url}/learn/${a.slug}`,
    lastModified: a.date ? new Date(a.date) : undefined,
    priority: 0.5,
  }));

  return [...staticPages, ...productPages, ...articlePages];
}
