/**
 * Who may sign in to the admin panel.
 *
 * ADMIN_ALLOWED_EMAILS is the authorization boundary. It is a comma-separated
 * list of addresses, and it is REQUIRED — with nothing configured, nobody
 * gets in.
 *
 * This used to defer to Google's OAuth "test users" list and allow everyone
 * when unset. That was wrong twice over:
 *
 *  - Test users are a consent-screen development feature, not access control.
 *    The restriction only applies while the OAuth app is in "Testing" status;
 *    publishing it, or making it Internal in a Workspace, silently opens
 *    sign-in to every Google account on earth.
 *  - An authorization check must never fail open. "Not configured" has to
 *    mean "deny", or a missing environment variable becomes a public door.
 *
 * The list is checked on every request, not only at sign-in — see
 * middleware.ts and lib/admin/api.ts. Sessions are JWTs valid for 14 days, so
 * a sign-in-only check would let someone keep access for a fortnight after
 * being removed from the list.
 */

/** Lowercased, trimmed — Google reports addresses in their canonical form. */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** The configured allowlist. Empty when the variable is unset or blank. */
export function getAllowedEmails(): string[] {
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (!raw) return [];
  return raw.split(",").map(normalize).filter(Boolean);
}

/** True when an allowlist has actually been configured. */
export function isAllowlistConfigured(): boolean {
  return getAllowedEmails().length > 0;
}

/**
 * True when this address may use the admin panel.
 *
 * Fails closed: no allowlist, no access. A missing or malformed email is
 * always rejected — there is nothing to check it against.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(normalize(email));
}
