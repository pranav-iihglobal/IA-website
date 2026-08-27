import { SITE } from "@/lib/content";

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
 */
export function BreadcrumbJsonLd({
  trail,
}: {
  /** Ordered from the site root inward. Paths are relative, e.g. "/products". */
  trail: { name: string; path: string }[];
}) {
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${SITE.url}${crumb.path}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
