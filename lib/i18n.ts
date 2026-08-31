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

/**
 * The clean route path, whatever the runtime handed us.
 *
 * usePathname() is not reliably the tidy path you would write in a link. On
 * Vercel the prerendered home page came back as "/index" — the name of the
 * static file, not the route — and the language toggle turned that into a
 * link to /gu/index, a 404, on the busiest page of the site. It never
 * reproduced under `next start`, which serves the same page as "/".
 *
 * Rather than trust the shape, normalise it once here: drop any query or
 * hash, fold a trailing "/index" back to its directory, and drop trailing
 * slashes. Everything that reads the pathname goes through this.
 */
export function normalizePath(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  let path = pathname.split(/[?#]/)[0];
  path = path.replace(/\/index$/, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/** Strip the locale prefix off a real pathname, for building its twin. */
export function stripLocale(pathname: string): string {
  const path = normalizePath(pathname);
  if (path === GU_PREFIX) return "/";
  if (path.startsWith(`${GU_PREFIX}/`)) return path.slice(GU_PREFIX.length);
  return path;
}

export function localeOf(pathname: string): Locale {
  const path = normalizePath(pathname);
  return path === GU_PREFIX || path.startsWith(`${GU_PREFIX}/`) ? "gu" : "en";
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
