/**
 * The three CRM lists, and the query each one is.
 *
 * Customers, dealers and leads are one collection filtered three ways. That
 * mapping used to live inside ContactWorkspace, which is a client component —
 * fine while the browser was the only thing that ran the query. The pages now
 * render the first page on the server, so both sides need it, and it has to be
 * one definition or the two will disagree about what a "dealer" is.
 */

export type Scope = "customers" | "dealers" | "leads";

export const SCOPE_QUERY: Record<Scope, Record<string, string>> = {
  customers: { kind: "customer", channel: "b2c" },
  dealers: { kind: "customer", channel: "b2b" },
  leads: { kind: "lead" },
};

/**
 * A canonical string for one list query.
 *
 * The client uses it to recognise the query the server already ran, so it can
 * skip a redundant fetch on mount. Sorted rather than raw, because insertion
 * order is not something two files should have to agree on by accident — that
 * would work until someone reordered a field and quietly reintroduced the
 * extra round trip this exists to avoid.
 */
export function listQueryKey(params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(sorted).toString();
}
