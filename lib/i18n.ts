import type { Lang } from "./content";

/**
 * Locale routing.
 *
 * Both languages used to live at one URL behind a client-side toggle, which
 * meant a crawler only ever saw one of them — the English half of the site
 * was unreachable to search entirely. Language is now part of the path, so
 * each version has its own address, its own canonical, and can rank on its
 * own keywords.
 *
 * English is unprefixed and Gujarati sits under /gu. The default locale
 * carries no prefix because it is what a stranger and a crawler land on, and
 * a redirect on the way in is a cost paid by every first visit.
 */
export const LOCALES = ["en", "gu"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const GU_PREFIX = "/gu";

/** The Lang the rest of the app already speaks. Same values, different name. */
export function toLang(locale: Locale): Lang {
  return locale;
}

/** "/products" + "gu" → "/gu/products". The root stays "/gu", not "/gu/". */
export function localePath(path: string, locale: Locale): string {
  const clean = path === "/" ? "" : path;
  return locale === DEFAULT_LOCALE ? clean || "/" : `${GU_PREFIX}${clean}`;
}

/** Strip the locale prefix off a real pathname, for building its twin. */
export function stripLocale(pathname: string): string {
  if (pathname === GU_PREFIX) return "/";
  if (pathname.startsWith(`${GU_PREFIX}/`)) return pathname.slice(GU_PREFIX.length);
  return pathname;
}

export function localeOf(pathname: string): Locale {
  return pathname === GU_PREFIX || pathname.startsWith(`${GU_PREFIX}/`)
    ? "gu"
    : "en";
}

/**
 * canonical + hreflang for one page.
 *
 * The canonical is self-referencing — each locale is its own page, not a
 * duplicate of the other — and the two are declared as alternates of each
 * other so Google serves the right one per searcher. x-default points at
 * English, which is the version to show when no language matches.
 */
export function alternatesFor(path: string, locale: Locale) {
  return {
    canonical: localePath(path, locale),
    languages: {
      en: localePath(path, "en"),
      gu: localePath(path, "gu"),
      "x-default": localePath(path, "en"),
    },
  };
}
