/**
 * Small formatting helpers shared by the public site and the admin panel.
 * Pure functions only — safe on either side of the server/client boundary.
 */

/** Human file size. Returns "" for 0 so an unknown size renders nothing. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Short date for admin rows, e.g. "26 Aug". */
export function formatShortDate(value: string | Date | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Publication date for an article, in both languages.
 *
 * Returned as a Bi so <T> can pick the reader's language, the same as every
 * other string on the site — a Gujarati reader should not get "27 August
 * 2026" in the middle of Gujarati prose. Includes the year, unlike
 * formatShortDate, because an article's age is part of how you judge it.
 */
export function formatArticleDate(value: string | Date | undefined): {
  en: string;
  gu: string;
} {
  if (!value) return { en: "", gu: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { en: "", gu: "" };
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return {
    en: date.toLocaleDateString("en-IN", options),
    // Falls back to the English rendering if the runtime lacks the Gujarati
    // locale data rather than throwing.
    gu: date.toLocaleDateString("gu-IN", options),
  };
}
