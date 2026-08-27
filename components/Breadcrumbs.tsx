import { SITE, resolveText, type Bi, type Lang } from "@/lib/content";
import { LocaleJsonLd } from "./LocaleJsonLd";

/**
 * BreadcrumbList structured data.
 *
 * Both the product and article pages already render a visible "‹ All
 * products" link, but the trail was never described to Google — so a result
 * showed a bare URL where it could have shown
 * iksarva.com › Products › FloraMax. That is a real click-through
 * difference on a phone, where the URL is truncated anyway.
 *
 * Markup only, no visual output: the visible breadcrumb already exists, and
 * duplicating it would be worse for readers, not better.
 *
 * Names are bilingual and paths are relative, because each page has an
 * English and a Gujarati address. LocaleJsonLd picks the variant and rewrites
 * the URLs, so the trail always agrees with the canonical of the page it is
 * on rather than pointing back at the other language.
 */
export function BreadcrumbJsonLd({
  trail,
}: {
  /** Ordered from the site root inward. Paths are relative, e.g. "/products". */
  trail: { name: Bi; path: string }[];
}) {
  const build = (lang: Lang) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: resolveText(crumb.name, lang),
      item: `${SITE.url}${crumb.path}`,
    })),
  });

  return <LocaleJsonLd data={build("en")} gu={build("gu")} />;
}
