"use client";

import { usePathname } from "next/navigation";
import { SITE } from "@/lib/content";
import { GU_PREFIX, localeOf } from "@/lib/i18n";

/**
 * Structured data with its URLs corrected for the language being read.
 *
 * The product and article pages render one component at two addresses, and
 * their JSON-LD was written when there was only one — every `url`,
 * `mainEntityOfPage` and breadcrumb `item` in it is an English address. Served
 * at /gu/products/floramax that is a direct contradiction: the page's
 * canonical says /gu/..., its structured data says /..., and Google is being
 * told two different things about which page it is looking at.
 *
 * So rather than thread a locale through every page, card and helper that
 * builds one of these objects, the fix is applied where the locale is already
 * known — here, at the point of rendering. Every site-absolute URL with a path
 * gains the /gu prefix on Gujarati pages.
 *
 * The bare origin is deliberately left alone: `SITE.url` on its own is the
 * organisation's identity in author/publisher, and the company does not have
 * a different identity per language.
 */
function localiseUrls<T>(value: T, prefix: string): T {
  if (typeof value === "string") {
    // Only site URLs that actually address a page — never the bare origin.
    return (
      value.startsWith(`${SITE.url}/`)
        ? `${SITE.url}${prefix}${value.slice(SITE.url.length)}`
        : value
    ) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => localiseUrls(v, prefix)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, localiseUrls(v, prefix)]),
    ) as T;
  }
  return value;
}

/**
 * @param data  The English structured data.
 * @param gu    The Gujarati variant, where the *content* differs and not just
 *              the URLs — a product description, an FAQ answer, a headline.
 *              Optional: objects that hold no prose need only `data`.
 */
export function LocaleJsonLd({ data, gu }: { data: unknown; gu?: unknown }) {
  const locale = localeOf(usePathname() ?? "/");
  if (locale !== "gu") {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    );
  }

  const localised = localiseUrls(gu ?? data, GU_PREFIX);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(localised) }}
    />
  );
}
