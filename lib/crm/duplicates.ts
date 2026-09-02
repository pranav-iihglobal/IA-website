/**
 * Catching the same farmer being added twice.
 *
 * There is no unique index on phone, and there deliberately is not one: a
 * household shares a number, a dealer's staff share a number, and a hard
 * constraint would block a legitimate record at the moment somebody is
 * standing in a field trying to save it. But with 5,118 contacts and two
 * directors adding leads independently, duplicates are near-certain — and a
 * duplicated farmer splits their sampling history from their orders, which
 * breaks the exact question the sampling programme exists to answer.
 *
 * So: WARN, never block. The warning names the existing record and links to
 * it, so the person deciding has what they need to decide.
 */

/**
 * A stored number reduced to the ten digits that identify it.
 *
 * The same reduction `phoneSchema` applies on save — but records imported or
 * written before that still hold "+91 98250 12345" and "098250 12345", so the
 * lookup cannot assume the stored value is already clean.
 */
export function phoneKey(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return "";
}

/** Regex-escape, so a stored value can never be read as a pattern. */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match those ten digits however they happen to be written down.
 *
 * Anchored at BOTH ends. The field holds a phone number and nothing else, so
 * a stored value that merely contains these digits — "7 9825012345", a
 * mistyped eleventh digit — is a different number, and reporting it as the
 * same person is the failure this is meant to prevent. Separators are allowed
 * between the digits, and a country or trunk prefix before them, because that
 * is how the imported rows are written.
 */
export function phoneMatchPattern(key: string): RegExp | null {
  if (!/^\d{10}$/.test(key)) return null;
  const gap = "[\\s\\-()]*";
  const body = key.split("").map(escape).join(gap);
  return new RegExp(`^${gap}(\\+?91|0)?${gap}${body}${gap}$`);
}

/** The Mongo filter for "somebody already has this number". */
export function duplicatePhoneFilter(
  key: string,
  excludeId?: string,
): Record<string, unknown> | null {
  const pattern = phoneMatchPattern(key);
  if (!pattern) return null;
  return {
    $or: [{ phone: pattern }, { altPhone: pattern }],
    // Editing an existing record must not report the record as its own twin.
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  };
}
