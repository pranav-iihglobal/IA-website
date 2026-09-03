/**
 * What somebody typed into the one search box, made ready for the queries.
 *
 * The case that matters is a number pasted from WhatsApp: "+91 98250 12345"
 * or "098250-12345". The contact search treats a digits-only query as a
 * phone prefix (lib/crm/filter.ts), but a pasted number carries spaces, a
 * plus and a country code, so it fell through to the name search and found
 * nobody. If the query is digits and separators and nothing else, it becomes
 * the bare local number; anything with a letter in it is left as typed.
 *
 * No imports, so the client can call it before the request goes out and the
 * route can call it again on the way in.
 */
export const SEARCH_MIN_LENGTH = 2;

export function normaliseSearch(raw: string): string {
  const text = raw.trim();
  if (!/^[\d\s\-+()]+$/.test(text)) return text;
  let digits = text.replace(/\D/g, "");
  // The same country and trunk prefixes phoneKey() strips, when the rest is
  // a whole ten-digit number.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** Long enough to be worth a round trip. */
export function searchable(raw: string): boolean {
  return normaliseSearch(raw).length >= SEARCH_MIN_LENGTH;
}
