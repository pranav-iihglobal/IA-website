"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { GU_PREFIX, localeOf } from "@/lib/i18n";

/**
 * An internal link that stays in the language you are reading.
 *
 * Without this, every link on a Gujarati page would drop you back into
 * English: the pages under /gu render the very same components as the
 * unprefixed ones, so a hard-coded href="/products" is correct on one and
 * wrong on the other.
 *
 * A client component so it can read the current pathname — which means a
 * server component can still render it, it just becomes a client leaf. That
 * is far less invasive than threading a locale prop through every page and
 * card on the site.
 *
 * Only for internal, localisable paths. Anything external should use
 * next/link directly.
 */

/**
 * Routes that exist at one address only, whatever language you are reading.
 *
 * The admin panel and the offline fallback have no /gu twin, so prefixing a
 * link to them produces a 404 — which is exactly what happened to the
 * footer's back-office link on every Gujarati page. Excluding them here is
 * safer than remembering to reach for next/link at each call site.
 */
const UNLOCALISED = ["/admin", "/offline", "/api"];

export function LocaleLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const pathname = usePathname();
  const locale = localeOf(pathname);

  // Absolute URLs, anchors and mailto/tel are left exactly as given.
  const localisable =
    href.startsWith("/") &&
    !href.startsWith(GU_PREFIX) &&
    !UNLOCALISED.some((p) => href === p || href.startsWith(`${p}/`));

  const localised =
    locale === "gu" && localisable
      ? `${GU_PREFIX}${href === "/" ? "" : href}`
      : href;

  return <Link href={localised} {...props} />;
}
