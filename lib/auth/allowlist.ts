/**
 * Who may sign in to the admin panel.
 *
 * The primary gate is Google itself: the OAuth consent screen is kept in
 * "Testing" status, so only accounts listed as test users in Google Cloud can
 * complete the sign-in flow at all. Everyone else is stopped by Google before
 * the request ever reaches this app.
 *
 * ADMIN_ALLOWED_EMAILS is an OPTIONAL second gate, unset by default:
 *
 *   unset  → any Google account that clears the test-user list gets in.
 *   set    → only the listed addresses get in, whatever Google allows.
 *
 * It exists because the test-user gate disappears the moment the OAuth app is
 * published. If that ever happens, setting this one variable re-locks the
 * panel without a code change.
 */

/** Lowercased, trimmed — Google reports addresses in their canonical form. */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** The configured allowlist, or null when the variable is unset/empty. */
export function getAllowedEmails(): string[] | null {
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (!raw) return null;
  const emails = raw.split(",").map(normalize).filter(Boolean);
  return emails.length > 0 ? emails : null;
}

/**
 * True when this address may sign in.
 *
 * With no allowlist configured this defers entirely to Google. A missing or
 * malformed email is always rejected — there is nothing to check it against.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAllowedEmails();
  if (!allowed) return true;
  return allowed.includes(normalize(email));
}
