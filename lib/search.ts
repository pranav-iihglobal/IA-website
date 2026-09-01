/**
 * Turning what someone typed into a search box into a safe Mongo query.
 *
 * Lives outside lib/admin/ deliberately: that module reaches for the session
 * and the database, and this has to stay importable by a plain tsx script so
 * the filters built on it can be checked without a server or a connection.
 */

/**
 * Escape every regex metacharacter, so the input is matched literally.
 *
 * Without this a stray `(` — the second half of a phone number pasted as
 * `(+91) 98…` — is an unterminated group, and `new RegExp` throws inside the
 * route rather than returning no results. `*` would be worse: it parses, and
 * quietly matches things nobody asked for.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A case-insensitive "contains" match on what was typed.
 *
 * Unanchored on purpose. People search a search box as they type, and by the
 * middle of a word — `Kher` must find Kherva, `Yog` must find Yogeshbhai. An
 * anchored match cannot do that, and a text index cannot either: it tokenises
 * and stems, so it matches whole terms only.
 */
export function searchRegex(input: string): RegExp {
  return new RegExp(escapeRegex(input), "i");
}
