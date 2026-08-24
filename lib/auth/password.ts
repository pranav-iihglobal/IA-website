/**
 * bcrypt hashes contain `$` characters (e.g. `$2b$12$…`), and Next.js expands
 * `$VAR` references inside .env files — so an unescaped hash in .env.local is
 * silently truncated. The documented workaround is to escape each `$` as `\$`,
 * but Vercel's dashboard does NOT expand variables, so the value pasted there
 * must stay raw.
 *
 * To make both work, normalize on read: strip the backslash escapes.
 */
export function normalizePasswordHash(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\\\$/g, "$").trim();
}
