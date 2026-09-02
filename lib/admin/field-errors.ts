/**
 * The shape a rejected save takes: `{ "dealer.gstin": "That is not a valid…" }`.
 *
 * Lives here rather than in lib/admin/api.ts because that file imports
 * next/server, next/cache, @/auth and the Mongoose models — none of which a
 * client component can pull in. Both the API routes and the forms import this
 * one, so the key a form looks up and the key the server sends cannot drift
 * apart.
 */

/** Flatten zod issues into { "path.to.field": "message" } for the form. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fieldErrors(issues: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    /*
      A cross-field refinement has an empty path — "Add a quote or a video
      link" belongs to the record, not to any one input — so it is keyed "_"
      and shown as a form-level message.
    */
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Which error keys a change has made stale.
 *
 * Forms here hold their errors as `{ "dealer.gstin": "…" }` — the shape the
 * server sends — while the form itself hands back a whole new values object
 * rather than a patch. So the keys that changed are worked out by comparing
 * the two, one level into the nested groups, which is exactly as deep as the
 * error keys go.
 *
 * Errors used to be cleared only at the top of save(), so a field you had just
 * corrected stayed red until you submitted again and found out.
 */
export function changedKeys(before: object, after: object): string[] {
  const keys: string[] = [];
  const a0 = before as Record<string, unknown>;
  const b0 = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a0), ...Object.keys(b0)])) {
    const a = a0[key];
    const b = b0[key];
    if (a === b) continue;

    const nested =
      a && b && typeof a === "object" && typeof b === "object" &&
      !Array.isArray(a) && !Array.isArray(b);
    if (nested) {
      for (const sub of changedKeys(a as object, b as object)) {
        keys.push(`${key}.${sub}`);
      }
      continue;
    }
    keys.push(key);
  }
  return keys;
}

/** The same errors, minus anything the change has invalidated. */
export function clearChanged(
  errors: Record<string, string>,
  before: object,
  after: object,
): Record<string, string> {
  const stale = changedKeys(before, after);
  if (stale.length === 0) return errors;
  const next = { ...errors };
  for (const key of stale) delete next[key];
  return next;
}
