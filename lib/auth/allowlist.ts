/**
 * Owners — the permanent, environment-level access list.
 *
 * ADMIN_ALLOWED_EMAILS holds the addresses that can always reach the admin
 * panel, whatever the database says. Everyone else is managed from inside the
 * panel (see lib/auth/directors.ts and /admin/directors).
 *
 * Two reasons it still exists rather than moving everything into the database:
 *
 *  - Lockout. The collection that grants access is itself edited through the
 *    panel. An empty collection, a bad delete or an Atlas outage must never
 *    be able to shut the last director out of the thing they would use to fix
 *    it. Owners are the way back in.
 *  - The edge. middleware.ts runs on the edge runtime, where Mongoose cannot
 *    run at all. This check is pure string work, so it is the one that can
 *    happen there.
 *
 * It fails closed. Nothing configured means no owners, and with an empty
 * database that means nobody gets in — which is the correct default for an
 * authorisation check, and the bug this file previously had.
 *
 * Note that Google's OAuth "test users" list is NOT an access control. It
 * only restricts anything while the consent screen is in Testing status;
 * publishing the app, or making it Internal in a Workspace, opens sign-in to
 * every Google account with no visible change here.
 */

/** Lowercased, trimmed — Google reports addresses in their canonical form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The configured owners. Empty when the variable is unset or blank. */
export function getOwnerEmails(): string[] {
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (!raw) return [];
  return raw.split(",").map(normalizeEmail).filter(Boolean);
}

/** True when at least one owner is configured. */
export function isOwnerConfigured(): boolean {
  return getOwnerEmails().length > 0;
}

/**
 * True when this address is a permanent owner.
 *
 * Edge-safe and synchronous. Being false does not mean "denied" — the address
 * may still be a director in the database. Use isAuthorisedEmail() from
 * lib/auth/directors.ts wherever a database is reachable.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const owners = getOwnerEmails();
  if (owners.length === 0) return false;
  return owners.includes(normalizeEmail(email));
}
